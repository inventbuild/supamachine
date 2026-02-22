import type { Session } from "@supabase/supabase-js";
import { AuthStateStatus } from "./constants";

/** context is always present: null before load, C once loaded */
export type CoreState<C> =
  | { status: typeof AuthStateStatus.START; context: null }
  | { status: typeof AuthStateStatus.CHECKING_SESSION; context: null }
  | { status: typeof AuthStateStatus.AUTHENTICATING; context: null }
  | {
      status: typeof AuthStateStatus.ERROR_CHECKING_SESSION;
      error: Error;
      context: null;
    }
  | { status: typeof AuthStateStatus.SIGNED_OUT; context: null }

  // AUTHENTICATED BELOW THIS POINT
  // Get context (optional)
  | { status: typeof AuthStateStatus.CONTEXT_LOADING; session: Session; context: null }
  | {
      status: typeof AuthStateStatus.ERROR_CONTEXT;
      error: Error;
      session: Session;
      context: null;
    }

  // Run initializeApp (optional)
  | {
      status: typeof AuthStateStatus.INITIALIZING;
      session: Session;
      context: C;
    }
  | {
      status: typeof AuthStateStatus.ERROR_INITIALIZING;
      error: Error;
      session: Session;
      context: C;
    }
  | {
      status: typeof AuthStateStatus.AUTH_READY;
      session: Session;
      context: C | null;
    };
