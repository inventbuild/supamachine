// API-facing types for Supamachine

import type { Session, User } from "@supabase/supabase-js";
import type { AuthState } from "./states";

/** Minimal session shape for loadContext. Supabase Session satisfies this. */
export type SessionLike = Pick<Session, "user">;

export type UserData = unknown;
export type AppContext = unknown;
export type AppState = string;

export interface LoadContextResult {
  userData?: UserData | null;
  context?: AppContext;
}

export type LoadContext = (
  session: SessionLike | null
) => Promise<LoadContextResult>;

export type DeriveAppState = (
  coreState: AuthState,
  context: AppContext | null
) => AppState;

export type InitializeApp = (ctx: {
  session: Session;
  user: User;
  userData: UserData;
  context?: AppContext;
}) => Promise<void>;

export type ContextUpdater = (
  coreState: AuthState,
  currentContext: AppContext
) => AppContext | Promise<AppContext>;
