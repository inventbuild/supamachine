// API-facing types for Supamachine

import type { Session, User } from "@supabase/supabase-js";
import type { CoreState } from "./states";
import { AuthStateStatus } from "./constants";

// C: custom context type, D: custom additional states type

type DisallowedStatuses =
  | typeof AuthStateStatus.START
  | typeof AuthStateStatus.CHECKING
  | typeof AuthStateStatus.ERROR_CHECKING
  | typeof AuthStateStatus.SIGNED_OUT
  | typeof AuthStateStatus.CONTEXT_LOADING
  | typeof AuthStateStatus.ERROR_CONTEXT
  | typeof AuthStateStatus.INITIALIZING
  | typeof AuthStateStatus.ERROR_INITIALIZING
  | typeof AuthStateStatus.AUTH_READY;

type CustomStateConstraint = {
  status: Exclude<string, DisallowedStatuses>;
};

/** When D is void (default), returns CoreState. When D is custom states, returns Exclude<CoreState, AUTH_READY> | D */
export type AppState<C, D = void> = [D] extends [void]
  ? CoreState<C>
  : Exclude<CoreState<C>, { status: typeof AuthStateStatus.AUTH_READY }> | D;

export interface SupamachineProviderProps<C, D extends CustomStateConstraint | void = void> {
  loadContext?: (session: Session) => Promise<C>;
  initializeApp?: (snapshot: {
    session: Session;
    context: C;
  }) => void | Promise<void>;
  mapState?: [D] extends [void]
    ? never
    : (
        snapshot: Extract<
          CoreState<C>,
          { status: typeof AuthStateStatus.AUTH_READY }
        >,
      ) => D;
  children: React.ReactNode;
}

export type UseSupamachineReturn<C, D extends CustomStateConstraint | void = void> = {
  state: AppState<C, D>;
  updateContext: (updater: (current: C) => C | Promise<C>) => Promise<void>;
};
