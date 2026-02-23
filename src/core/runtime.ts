import type { Session } from "@supabase/supabase-js";
import type { CoreState } from "./states";
import type { AuthEvent } from "./events";
import { AuthEventType, AuthStateStatus } from "./constants";
import { reducer, setReducerLogLevel } from "./reducer";
import type { AppState, MapStateSnapshot } from "./types";
import { createLogger, type LogLevel } from "./logger";

const DEFAULT_LOAD_CONTEXT_TIMEOUT_MS = 10_000;
const DEFAULT_INITIALIZE_APP_TIMEOUT_MS = 30_000;
const DEFAULT_AUTHENTICATING_TIMEOUT_MS = 30_000;

export interface RuntimeOptions<C, D> {
  loadContext?: (session: Session) => Promise<C>;
  mapState?: (snapshot: MapStateSnapshot<C>) => D;
  initializeApp?: (snapshot: {
    session: Session;
    context: C;
  }) => void | Promise<void>;
  loadContextTimeoutMs?: number;
  initializeAppTimeoutMs?: number;
  authenticatingTimeoutMs?: number;
  logLevel?: LogLevel;
}

function computeAppState<C, D>(
  state: CoreState<C>,
  mapState: RuntimeOptions<C, D>["mapState"],
): AppState<C, D> {
  if (state.status !== AuthStateStatus.AUTH_READY) {
    return state as AppState<C, D>;
  }
  if (mapState && state.context != null) {
    const snapshot: MapStateSnapshot<C> = {
      status: state.status,
      session: state.session,
      context: state.context,
    };
    const base = mapState(snapshot);
    return {
      ...base,
      session: state.session,
      context: state.context,
    } as AppState<C, D>;
  }
  return state as AppState<C, D>;
}

export class SupamachineCore<C, D> {
  private state: CoreState<C> = {
    status: AuthStateStatus.START,
    context: null,
  };
  private sessionForLoading: Session | null = null;
  private authenticatingTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<
    (coreState: CoreState<C>, appState: AppState<C, D>) => void
  >();
  private loadContextTimeoutMs: number;
  private initializeAppTimeoutMs: number;
  private authenticatingTimeoutMs: number;
  private log: ReturnType<typeof createLogger>;

  constructor(private readonly options: RuntimeOptions<C, D>) {
    this.loadContextTimeoutMs =
      options.loadContextTimeoutMs ?? DEFAULT_LOAD_CONTEXT_TIMEOUT_MS;
    this.initializeAppTimeoutMs =
      options.initializeAppTimeoutMs ?? DEFAULT_INITIALIZE_APP_TIMEOUT_MS;
    this.authenticatingTimeoutMs =
      options.authenticatingTimeoutMs ?? DEFAULT_AUTHENTICATING_TIMEOUT_MS;
    const level = options.logLevel ?? 2;
    this.log = createLogger("core", level);
    setReducerLogLevel(level);
  }

  setLogLevel(level: LogLevel) {
    this.log = createLogger("core", level);
    setReducerLogLevel(level);
  }

  async updateContext(updater: (current: C) => C | Promise<C>): Promise<void> {
    if (this.state.status !== AuthStateStatus.AUTH_READY) {
      return;
    }
    const current = this.state.context;
    if (current == null) {
      return;
    }
    const next = await updater(current);
    if (next !== current) {
      this.state = { ...this.state, context: next };
      this.emit();
    }
  }

  async refreshContext(session: Session): Promise<void> {
    if (this.state.status !== AuthStateStatus.AUTH_READY) {
      return;
    }
    const { loadContext } = this.options;
    if (!loadContext) {
      this.state = { ...this.state, session };
      this.emit();
      return;
    }
    try {
      this.log.debug("refreshContext: reloading context in place");
      const context = await loadContext(session);
      this.state = { ...this.state, session, context };
      this.emit();
    } catch (error) {
      this.log.error("refreshContext: loadContext failed", error);
    }
  }

  beginAuth() {
    this.dispatch({ type: AuthEventType.AUTH_INITIATED });
  }

  cancelAuth() {
    this.dispatch({ type: AuthEventType.AUTH_CANCELLED });
  }

  dispatch(event: AuthEvent<C>) {
    const prevState = this.state;
    this.state = reducer<C>(this.state, event);

    if (event.type === AuthEventType.AUTH_CHANGED) {
      this.sessionForLoading = event.session ?? null;
    }

    this.emit();

    // AUTHENTICATING timeout management
    if (
      this.state.status === AuthStateStatus.AUTHENTICATING &&
      prevState.status !== AuthStateStatus.AUTHENTICATING
    ) {
      this.authenticatingTimer = setTimeout(() => {
        this.log.warn("authenticating timeout — cancelling");
        this.dispatch({ type: AuthEventType.AUTH_CANCELLED });
      }, this.authenticatingTimeoutMs);
    }
    if (
      prevState.status === AuthStateStatus.AUTHENTICATING &&
      this.state.status !== AuthStateStatus.AUTHENTICATING
    ) {
      if (this.authenticatingTimer) {
        clearTimeout(this.authenticatingTimer);
        this.authenticatingTimer = null;
      }
    }

    if (
      this.state.status === AuthStateStatus.CONTEXT_LOADING &&
      prevState.status !== AuthStateStatus.CONTEXT_LOADING
    ) {
      const session = this.sessionForLoading;
      if (session && this.options.loadContext) {
        this.log.debug("entered CONTEXT_LOADING, loading context");
        this.loadContextWithTimeout(session);
      } else if (session && !this.options.loadContext) {
        this.log.debug("no loadContext, resolving with empty context");
        this.dispatch({
          type: AuthEventType.CONTEXT_RESOLVED,
          context: {} as C,
        });
      }
    } else if (
      this.state.status === AuthStateStatus.SIGNED_OUT &&
      prevState.status !== AuthStateStatus.SIGNED_OUT
    ) {
      this.sessionForLoading = null;
      this.log.debug("signed out");
    } else if (
      this.state.status === AuthStateStatus.INITIALIZING &&
      prevState.status === AuthStateStatus.CONTEXT_LOADING
    ) {
      this.log.debug("entered INITIALIZING, running initializeApp");
      this.initializeAppWithTimeout();
    }
  }

  private async loadContextWithTimeout(session: Session) {
    const loadContext = this.options.loadContext;
    if (!loadContext) return;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("loadContext timeout")),
        this.loadContextTimeoutMs,
      ),
    );

    try {
      const context = await Promise.race([
        loadContext(session),
        timeoutPromise,
      ]);

      this.dispatch({
        type: AuthEventType.CONTEXT_RESOLVED,
        context,
      });
    } catch (error) {
      this.log.error("loadContext failed", error);
      this.dispatch({
        type: AuthEventType.ERROR_CONTEXT,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async initializeAppWithTimeout() {
    const { initializeApp } = this.options;
    if (!initializeApp || this.state.status !== AuthStateStatus.INITIALIZING) {
      return;
    }

    const { session, context } = this.state;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("initializeApp timeout")),
        this.initializeAppTimeoutMs,
      ),
    );

    try {
      await Promise.race([initializeApp({ session, context }), timeoutPromise]);
      this.dispatch({ type: AuthEventType.INITIALIZED });
    } catch (error) {
      this.log.error("initializeApp failed", error);
      this.dispatch({
        type: AuthEventType.ERROR_INITIALIZING,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  subscribe(fn: (coreState: CoreState<C>, appState: AppState<C, D>) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getSnapshot(): CoreState<C> {
    return this.state;
  }

  getAppState(): AppState<C, D> {
    return computeAppState(this.state, this.options.mapState);
  }

  private emit() {
    const appState = computeAppState(this.state, this.options.mapState);
    for (const l of this.listeners) l(this.state, appState);
  }
}
