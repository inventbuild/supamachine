import { AuthState } from './states'
import { AuthEvent } from './events'
import { AuthStateStatus, AuthEventType } from './constants'
import { createLogger, type LogLevel, LogLevel as LL } from './logger'

let log = createLogger('reducer', LL.WARN)

export function setReducerLogLevel(level: LogLevel) {
  log = createLogger('reducer', level)
}

function invalidTransition(state: AuthState, event: AuthEvent): AuthState {
  log.warn(`invalid transition: ${state.status} + ${event.type}`)
  return state
}

export function reducer(state: AuthState, event: AuthEvent): AuthState {
  let next: AuthState

  switch (state.status) {
    case AuthStateStatus.START:
      switch (event.type) {
        case AuthEventType.START:
          next = { status: AuthStateStatus.CHECKING, context: null }
          break
        default:
          return invalidTransition(state, event)
      }
      break

    case AuthStateStatus.CHECKING:
      switch (event.type) {
        case AuthEventType.SESSION_FOUND:
          next = {
            status: AuthStateStatus.SIGNED_IN,
            session: event.session,
            user: event.session.user,
            context: null,
          }
          break
        case AuthEventType.NO_SESSION:
          next = { status: AuthStateStatus.SIGNED_OUT, context: null }
          break
        case AuthEventType.ERROR_CHECKING:
          next = { status: AuthStateStatus.ERROR_CHECKING, error: event.error, context: null }
          break
        default:
          return invalidTransition(state, event)
      }
      break

    case AuthStateStatus.SIGNED_IN:
      switch (event.type) {
        case AuthEventType.CONTEXT_LOADED:
          next = {
            status: AuthStateStatus.AUTH_READY,
            session: state.session,
            user: state.user,
            userData: event.userData,
            context: event.context,
          }
          break
        case AuthEventType.ERROR_CONTEXT:
          next = {
            status: AuthStateStatus.ERROR_CONTEXT,
            error: event.error,
            session: state.session,
            user: state.user,
            context: null,
          }
          break
        case AuthEventType.SIGNED_OUT:
          next = { status: AuthStateStatus.SIGNED_OUT, context: null }
          break
        default:
          return invalidTransition(state, event)
      }
      break

    case AuthStateStatus.AUTH_READY:
      switch (event.type) {
        case AuthEventType.SIGNED_OUT:
          next = { status: AuthStateStatus.SIGNED_OUT, context: null }
          break
        case AuthEventType.SESSION_FOUND:
          next = {
            status: AuthStateStatus.SIGNED_IN,
            session: event.session,
            user: event.session.user,
            context: null,
          }
          break
        case AuthEventType.ERROR_AUTH:
          next = { status: AuthStateStatus.ERROR_AUTH, error: event.error, context: null }
          break
        default:
          return invalidTransition(state, event)
      }
      break

    case AuthStateStatus.SIGNED_OUT:
      switch (event.type) {
        case AuthEventType.SESSION_FOUND:
          next = {
            status: AuthStateStatus.SIGNED_IN,
            session: event.session,
            user: event.session.user,
            context: null,
          }
          break
        case AuthEventType.CONTEXT_LOADED:
          next = { status: AuthStateStatus.SIGNED_OUT, context: event.context }
          break
        default:
          return invalidTransition(state, event)
      }
      break

    case AuthStateStatus.ERROR_CHECKING:
    case AuthStateStatus.ERROR_CONTEXT:
    case AuthStateStatus.ERROR_AUTH:
      switch (event.type) {
        case AuthEventType.SESSION_FOUND:
          next = {
            status: AuthStateStatus.SIGNED_IN,
            session: event.session,
            user: event.session.user,
            context: null,
          }
          break
        case AuthEventType.NO_SESSION:
          next = { status: AuthStateStatus.SIGNED_OUT, context: null }
          break
        default:
          return invalidTransition(state, event)
      }
      break

    default: {
      const _exhaustive: never = state
      throw new Error(`unknown state: ${(state as AuthState).status}`)
    }
  }

  log.debug(`${state.status} + ${event.type} → ${next.status}`)
  return next
}
