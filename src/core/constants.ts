/**
 * Core machine states. Use these when checking state or in mapState.
 * Distinct from AuthEventType (event types that drive transitions).
 */
export const AuthStateStatus = {
  START: "START",
  CHECKING: "CHECKING",
  SIGNED_OUT: "SIGNED_OUT",
  CONTEXT_LOADING: "CONTEXT_LOADING",
  INITIALIZING: "INITIALIZING",
  AUTH_READY: "AUTH_READY",
  ERROR_CHECKING: "ERROR_CHECKING",
  ERROR_CONTEXT: "ERROR_CONTEXT",
  ERROR_INITIALIZING: "ERROR_INITIALIZING",
} as const;

export type AuthStateStatus =
  (typeof AuthStateStatus)[keyof typeof AuthStateStatus];

/**
 * Internal event types that drive the state machine.
 * Mapped from Supabase auth events by the adapter.
 */
export const AuthEventType = {
  START: "START",
  SESSION_FOUND: "SESSION_FOUND",
  NO_SESSION: "NO_SESSION",
  SIGNED_OUT: "SIGNED_OUT",
  CONTEXT_LOADED: "CONTEXT_LOADED",
  ERROR_CHECKING: "ERROR_CHECKING",
  ERROR_CONTEXT: "ERROR_CONTEXT",
  ERROR_AUTH: "ERROR_AUTH",
} as const;

export type AuthEventType = (typeof AuthEventType)[keyof typeof AuthEventType];
