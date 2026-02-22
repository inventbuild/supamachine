/**
 * Core machine states. Use these when checking state or in mapState.
 * Distinct from AuthEventType (event types that drive transitions).
 */
export const AuthStateStatus = {
  START: "START",
  CHECKING_SESSION: "CHECKING_SESSION",
  AUTHENTICATING: "AUTHENTICATING",
  SIGNED_OUT: "SIGNED_OUT",
  CONTEXT_LOADING: "CONTEXT_LOADING",
  INITIALIZING: "INITIALIZING",
  AUTH_READY: "AUTH_READY",
  ERROR_CHECKING_SESSION: "ERROR_CHECKING_SESSION",
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
  AUTH_CHANGED: "AUTH_CHANGED",
  AUTH_INITIATED: "AUTH_INITIATED",
  AUTH_CANCELLED: "AUTH_CANCELLED",
  CONTEXT_RESOLVED: "CONTEXT_RESOLVED",
  INITIALIZED: "INITIALIZED",
  ERROR_CHECKING_SESSION: "ERROR_CHECKING_SESSION",
  ERROR_CONTEXT: "ERROR_CONTEXT",
  ERROR_INITIALIZING: "ERROR_INITIALIZING",
} as const;

export type AuthEventType = (typeof AuthEventType)[keyof typeof AuthEventType];
