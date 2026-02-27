/**
 * Core machine states used by Supamachine.
 *
 * @remarks
 * Use these values when branching in your UI or inside `mapState`.
 * They are distinct from {@link AuthEventType}, which describes events.
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
