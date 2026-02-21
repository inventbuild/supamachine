import type { Session } from "@supabase/supabase-js";
import { AuthStateStatus } from "./constants";
// import type { UserData, AppContext } from './types'

export type CoreState<C> =
  | { status: typeof AuthStateStatus.START; context: null }
  | { status: typeof AuthStateStatus.CHECKING; context: null }
  | {
      status: typeof AuthStateStatus.ERROR_CHECKING;
      error: Error;
      context: null;
    }
  | { status: typeof AuthStateStatus.SIGNED_OUT; context: C | null }

  // Get context (optional)
  | { status: typeof AuthStateStatus.CONTEXT_LOADING; session: Session }
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
