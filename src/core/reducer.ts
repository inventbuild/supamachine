import type { CoreState } from "./states";
import type { AuthEvent } from "./events";
import { AuthStateStatus, AuthEventType } from "./constants";
import { createLogger, type LogLevel, LogLevel as LL } from "./logger";

let log = createLogger("reducer", LL.WARN);

export function setReducerLogLevel(level: LogLevel) {
  log = createLogger("reducer", level);
}

/** Pre-context states use null; avoids TS inferring C = null from literal */
const NO_CONTEXT = null;

function invalidTransition<C>(
  state: CoreState<C>,
  event: AuthEvent<C>,
): CoreState<C> {
  log.warn(`invalid transition: ${state.status} + ${event.type}`);
  return state as CoreState<C>;
}

export function reducer<C>(
  state: CoreState<C>,
  event: AuthEvent<C>,
): CoreState<C> {
  let next: CoreState<C>;

  switch (state.status) {
    case AuthStateStatus.START:
      switch (event.type) {
        case AuthEventType.START:
          next = { status: AuthStateStatus.CHECKING, context: NO_CONTEXT };
          break;
        default:
          return invalidTransition(state, event) as CoreState<C>;
      }
      break;

    case AuthStateStatus.CHECKING:
      switch (event.type) {
        case AuthEventType.AUTH_CHANGED:
          if (event.session) {
            next = {
              status: AuthStateStatus.CONTEXT_LOADING,
              session: event.session,
              context: NO_CONTEXT,
            };
          } else {
            next = { status: AuthStateStatus.SIGNED_OUT, context: NO_CONTEXT };
          }
          break;
        case AuthEventType.ERROR_CHECKING:
          next = {
            status: AuthStateStatus.ERROR_CHECKING,
            error: event.error,
            context: NO_CONTEXT,
          };
          break;
        default:
          return invalidTransition(state, event) as CoreState<C>;
      }
      break;

    case AuthStateStatus.CONTEXT_LOADING:
      switch (event.type) {
        case AuthEventType.CONTEXT_RESOLVED:
          next = {
            status: AuthStateStatus.INITIALIZING,
            session: state.session,
            context: event.context,
          };
          break;
        case AuthEventType.ERROR_CONTEXT:
          next = {
            status: AuthStateStatus.ERROR_CONTEXT,
            session: state.session,
            error: event.error,
            context: NO_CONTEXT,
          };
          break;
        case AuthEventType.AUTH_CHANGED:
          if (!event.session) {
            next = { status: AuthStateStatus.SIGNED_OUT, context: NO_CONTEXT };
          } else {
            next = {
              status: AuthStateStatus.CONTEXT_LOADING,
              session: event.session,
              context: NO_CONTEXT,
            };
          }
          break;
        default:
          return invalidTransition(state, event) as CoreState<C>;
      }
      break;

    case AuthStateStatus.INITIALIZING:
      switch (event.type) {
        case AuthEventType.INITIALIZED:
          next = {
            status: AuthStateStatus.AUTH_READY,
            session: state.session,
            context: state.context,
          };
          break;
        case AuthEventType.ERROR_INITIALIZING:
          next = {
            status: AuthStateStatus.ERROR_INITIALIZING,
            error: event.error,
            session: state.session,
            context: state.context,
          };
          break;
        case AuthEventType.AUTH_CHANGED:
          if (!event.session) {
            next = { status: AuthStateStatus.SIGNED_OUT, context: NO_CONTEXT };
          } else {
            next = {
              status: AuthStateStatus.CONTEXT_LOADING,
              session: event.session,
              context: NO_CONTEXT,
            };
          }
          break;
        default:
          return invalidTransition(state, event) as CoreState<C>;
      }
      break;

    case AuthStateStatus.AUTH_READY:
      switch (event.type) {
        case AuthEventType.AUTH_CHANGED:
          if (!event.session) {
            next = { status: AuthStateStatus.SIGNED_OUT, context: NO_CONTEXT };
          } else {
            next = {
              status: AuthStateStatus.CONTEXT_LOADING,
              session: event.session,
              context: NO_CONTEXT,
            };
          }
          break;
        default:
          return invalidTransition(state, event) as CoreState<C>;
      }
      break;

    case AuthStateStatus.SIGNED_OUT:
      switch (event.type) {
        case AuthEventType.AUTH_CHANGED:
          if (event.session) {
            next = {
              status: AuthStateStatus.CONTEXT_LOADING,
              session: event.session,
              context: NO_CONTEXT,
            };
          } else {
            next = state;
          }
          break;
        default:
          return invalidTransition(state, event) as CoreState<C>;
      }
      break;

    case AuthStateStatus.ERROR_CHECKING:
    case AuthStateStatus.ERROR_CONTEXT:
    case AuthStateStatus.ERROR_INITIALIZING:
      switch (event.type) {
        case AuthEventType.AUTH_CHANGED:
          if (event.session) {
            next = {
              status: AuthStateStatus.CONTEXT_LOADING,
              session: event.session,
              context: NO_CONTEXT,
            };
          } else {
            next = { status: AuthStateStatus.SIGNED_OUT, context: NO_CONTEXT };
          }
          break;
        default:
          return invalidTransition(state, event) as CoreState<C>;
      }
      break;

    default: {
      const _exhaustive: never = state;
      throw new Error(`unknown state: ${(state as CoreState<C>).status}`);
    }
  }

  log.debug(`${state.status} + ${event.type} → ${next.status}`);
  return next as CoreState<C>;
}
