import type { Session } from "@supabase/supabase-js";
import { AuthEventType } from "./constants";

export type AuthEvent<C> =
  | { type: typeof AuthEventType.START }

  // Auth state update (initial resolution or subsequent change)
  | { type: typeof AuthEventType.AUTH_CHANGED; session: Session | null }

  // App-initiated auth signals
  | { type: typeof AuthEventType.AUTH_INITIATED }
  | { type: typeof AuthEventType.AUTH_CANCELLED }

  // Context resolution
  | { type: typeof AuthEventType.CONTEXT_RESOLVED; context: C }

  // Initialization
  | { type: typeof AuthEventType.INITIALIZED }

  // Errors
  | { type: typeof AuthEventType.ERROR_CHECKING_SESSION; error: Error }
  | { type: typeof AuthEventType.ERROR_CONTEXT; error: Error }
  | { type: typeof AuthEventType.ERROR_INITIALIZING; error: Error };
