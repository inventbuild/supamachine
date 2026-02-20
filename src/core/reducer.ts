import { AuthState } from './states'
import { AuthEvent } from './events'
import { AuthStateStatus, AuthEventType, ErrorType } from './constants'

export function reducer(state: AuthState, event: AuthEvent): AuthState {
  switch (state.status) {
    case AuthStateStatus.START:
      if (event.type === AuthEventType.START) {
        return { status: AuthStateStatus.CHECKING }
      }
      break

    case AuthStateStatus.CHECKING:
      if (event.type === AuthEventType.SESSION_FOUND) {
        return {
          status: AuthStateStatus.SIGNED_IN,
          session: event.session,
          user: event.session.user,
        }
      }
      if (event.type === AuthEventType.NO_SESSION) {
        return { status: AuthStateStatus.SIGNED_OUT }
      }
      if (event.type === AuthEventType.ERROR && event.errorType === ErrorType.CHECKING) {
        return { status: AuthStateStatus.ERROR_CHECKING, error: event.error }
      }
      break

    case AuthStateStatus.SIGNED_IN:
      if (event.type === AuthEventType.CONTEXT_LOADED) {
        return {
          status: AuthStateStatus.AUTH_READY,
          session: state.session,
          user: state.user,
          userData: event.userData,
          context: event.context,
        }
      }
      if (event.type === AuthEventType.ERROR && event.errorType === ErrorType.CONTEXT) {
        return {
          status: AuthStateStatus.ERROR_CONTEXT,
          error: event.error,
          session: state.session,
          user: state.user,
        }
      }
      if (event.type === AuthEventType.SIGNED_OUT) {
        return { status: AuthStateStatus.SIGNED_OUT, context: undefined }
      }
      break

    case AuthStateStatus.AUTH_READY:
      if (event.type === AuthEventType.SIGNED_OUT) {
        return { status: AuthStateStatus.SIGNED_OUT, context: undefined }
      }
      if (event.type === AuthEventType.ERROR && event.errorType === ErrorType.AUTH) {
        return { status: AuthStateStatus.ERROR_AUTH, error: event.error }
      }
      break

    case AuthStateStatus.SIGNED_OUT:
      if (event.type === AuthEventType.SESSION_FOUND) {
        return {
          status: AuthStateStatus.SIGNED_IN,
          session: event.session,
          user: event.session.user,
        }
      }
      if (event.type === AuthEventType.CONTEXT_LOADED) {
        return {
          status: AuthStateStatus.SIGNED_OUT,
          context: event.context,
        }
      }
      break

    case AuthStateStatus.ERROR_CHECKING:
    case AuthStateStatus.ERROR_CONTEXT:
    case AuthStateStatus.ERROR_AUTH:
      if (event.type === AuthEventType.SESSION_FOUND) {
        return {
          status: AuthStateStatus.SIGNED_IN,
          session: event.session,
          user: event.session.user,
        }
      }
      if (event.type === AuthEventType.NO_SESSION) {
        return { status: AuthStateStatus.SIGNED_OUT, context: undefined }
      }
      break
  }

  return state
}
