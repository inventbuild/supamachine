import type { Session } from "@supabase/supabase-js";
import { AuthEventType } from "./constants";

export type AuthEvent<C> =
  | { type: typeof AuthEventType.START }

  // Auth state update (initial resolution or subsequent change)
  | { type: typeof AuthEventType.AUTH_CHANGED; session: Session | null }

  // Context resolution
  | { type: "CONTEXT_RESOLVED"; context: C }

  // Initialization
  | { type: "INITIALIZED" }

  // Errors
  | { type: "ERROR_CHECKING"; error: Error }
  | { type: "ERROR_CONTEXT"; error: Error }
  | { type: "ERROR_INITIALIZING"; error: Error };
