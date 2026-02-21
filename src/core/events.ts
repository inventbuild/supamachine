import type { Session } from "@supabase/supabase-js";
import { AuthEventType } from "./constants";

export type AuthEvent<C> =
  | { type: typeof AuthEventType.START }

  // Auth resolution
  | { type: typeof AuthEventType.AUTH_RESOLVED; session: Session | null }
  | { type: typeof AuthEventType.AUTH_CHANGED; session: Session | null }

  // Context resolution
  | { type: "CONTEXT_RESOLVED"; context: C }

  // Initialization
  | { type: "INITIALIZED" }

  // Errors
  | { type: "ERROR_CHECKING"; error: Error }
  | { type: "ERROR_CONTEXT"; error: Error }
  | { type: "ERROR_INITIALIZING"; error: Error };
