import { AuthState } from './states'
import { AuthEvent } from './events'
import { AuthEventType, AuthStateStatus, ErrorType } from './constants'
import { reducer } from './reducer'
import type {
  LoadContext,
  DeriveAppState,
  InitializeApp,
  ContextUpdater,
  AppState,
  AppContext,
  SessionLike,
} from './types'
import { createLogger, type LogLevel } from './logger'

const DEFAULT_LOAD_CONTEXT_TIMEOUT_MS = 10_000
const DEFAULT_INITIALIZE_APP_TIMEOUT_MS = 30_000

function computeAppState(
  state: AuthState,
  deriveAppState: DeriveAppState | undefined
): AppState {
  const context =
    state.status === AuthStateStatus.AUTH_READY
      ? state.context ?? null
      : state.status === AuthStateStatus.SIGNED_OUT && 'context' in state
        ? state.context ?? null
        : null
  return deriveAppState
    ? deriveAppState(state, context)
    : state.status
}

export class SupamachineCore {
  private state: AuthState = { status: AuthStateStatus.START }
  private listeners = new Set<(coreState: AuthState, appState: AppState) => void>()
  private contextUpdaters: ContextUpdater[] = []
  private loadContextTimeoutMs: number
  private initializeAppTimeoutMs: number
  private log: ReturnType<typeof createLogger>

  constructor(
    private readonly loadContext: LoadContext,
    private readonly deriveAppState?: DeriveAppState,
    private readonly initializeApp?: InitializeApp,
    options?: {
      loadContextTimeoutMs?: number
      initializeAppTimeoutMs?: number
      logLevel?: LogLevel
    }
  ) {
    this.loadContextTimeoutMs =
      options?.loadContextTimeoutMs ?? DEFAULT_LOAD_CONTEXT_TIMEOUT_MS
    this.initializeAppTimeoutMs =
      options?.initializeAppTimeoutMs ?? DEFAULT_INITIALIZE_APP_TIMEOUT_MS
    this.log = createLogger('core', options?.logLevel ?? 2)
  }

  setContextUpdaters(updaters: ContextUpdater[]) {
    this.contextUpdaters = updaters
  }

  setLogLevel(level: LogLevel) {
    this.log = createLogger('core', level)
  }

  async updateContext() {
    if (this.state.status !== AuthStateStatus.AUTH_READY) {
      return
    }

    let updatedContext = this.state.context
    for (const updater of this.contextUpdaters) {
      const result = await updater(this.state, updatedContext)
      updatedContext = result
    }

    if (updatedContext !== this.state.context) {
      this.log.debug('context changed, reloading')
      await this.loadContextWithTimeout(this.state.session)
    }
  }

  dispatch(event: AuthEvent) {
    const prevState = this.state
    this.state = reducer(this.state, event)

    this.emit()

    if (
      this.state.status === AuthStateStatus.SIGNED_IN &&
      prevState.status !== AuthStateStatus.SIGNED_IN
    ) {
      this.log.debug('transitioned to SIGNED_IN, loading context')
      this.loadContextWithTimeout(this.state.session)
    } else if (
      this.state.status === AuthStateStatus.SIGNED_OUT &&
      prevState.status !== AuthStateStatus.SIGNED_OUT
    ) {
      this.log.debug('transitioned to SIGNED_OUT, loading context')
      this.loadContextWithTimeout(null)
    } else if (
      this.state.status === AuthStateStatus.AUTH_READY &&
      prevState.status !== AuthStateStatus.AUTH_READY
    ) {
      this.log.debug('transitioned to AUTH_READY, running initializeApp')
      this.initializeAppWithTimeout()
    }
  }

  private async loadContextWithTimeout(session: SessionLike | null) {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('loadContext timeout')),
        this.loadContextTimeoutMs
      )
    )

    try {
      const result = await Promise.race([
        this.loadContext(session),
        timeoutPromise,
      ])

      this.dispatch({
        type: AuthEventType.CONTEXT_LOADED,
        userData: result.userData ?? null,
        context: (result.context ?? {}) as AppContext,
      })
    } catch (error) {
      this.log.error('loadContext failed', error)
      if (this.state.status === AuthStateStatus.SIGNED_IN) {
        this.dispatch({
          type: AuthEventType.ERROR,
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: ErrorType.CONTEXT,
        })
      }
      // When signed out, loadContext failure is non-fatal; we stay in SIGNED_OUT
    }
  }

  private async initializeAppWithTimeout() {
    if (
      !this.initializeApp ||
      this.state.status !== AuthStateStatus.AUTH_READY
    ) {
      return
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('initializeApp timeout')),
        this.initializeAppTimeoutMs
      )
    )

    try {
      await Promise.race([
        this.initializeApp({
          session: this.state.session,
          user: this.state.user,
          userData: this.state.userData,
          context: this.state.context,
        }),
        timeoutPromise,
      ])
    } catch (error) {
      this.log.error('initializeApp failed', error)
    }
  }

  subscribe(fn: (coreState: AuthState, appState: AppState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot() {
    return this.state
  }

  getAppState(): AppState {
    return computeAppState(this.state, this.deriveAppState)
  }

  private emit() {
    const appState = computeAppState(this.state, this.deriveAppState)
    for (const l of this.listeners) l(this.state, appState)
  }
}
