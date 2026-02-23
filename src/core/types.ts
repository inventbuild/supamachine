// API-facing types for Supamachine

import type { Session, User } from "@supabase/supabase-js";
import type { CoreState } from "./states";
import { AuthStateStatus } from "./constants";

// C: custom context type, D: custom additional states type

type DisallowedStatuses =
  | typeof AuthStateStatus.START
  | typeof AuthStateStatus.CHECKING_SESSION
  | typeof AuthStateStatus.AUTHENTICATING
  | typeof AuthStateStatus.ERROR_CHECKING_SESSION
  | typeof AuthStateStatus.SIGNED_OUT
  | typeof AuthStateStatus.CONTEXT_LOADING
  | typeof AuthStateStatus.ERROR_CONTEXT
  | typeof AuthStateStatus.INITIALIZING
  | typeof AuthStateStatus.ERROR_INITIALIZING
  | typeof AuthStateStatus.AUTH_READY;

type CustomStateConstraint = {
  status: Exclude<string, DisallowedStatuses>;
};

/** mapState is only called when we have context. Custom states inherit guaranteed context. */
type WithSessionContext<C, T> = T extends { status: string }
  ? T & { session: Session; context: C }
  : never;

/** Snapshot passed to mapState. Context is guaranteed—mapState only runs when we have context to derive from. */
export type MapStateSnapshot<C> = {
  status: typeof AuthStateStatus.AUTH_READY;
  session: Session;
  context: C;
};

/** When D is void (default), returns CoreState. When D is custom states, returns core states | (D with session+context added) */
export type AppState<C, D = void> = [D] extends [void]
  ? CoreState<C>
  :
      | Exclude<CoreState<C>, { status: typeof AuthStateStatus.AUTH_READY }>
      | WithSessionContext<C, D>;

/** Default actions provided when none are passed. signOut is always available. */
export type DefaultActions = {
  signOut: () => void | Promise<unknown>;
};

/** User-provided auth actions (signIn, signOut, etc.). Merged with default signOut. */
export type SupamachineActions<A = Record<string, never>> = DefaultActions & A;

export interface SupamachineProviderProps<
  C,
  D extends CustomStateConstraint | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
> {
  loadContext?: (session: Session) => Promise<C>;
  initializeApp?: (snapshot: {
    session: Session;
    context: C;
  }) => void | Promise<void>;
  mapState?: [D] extends [void]
    ? never
    : (snapshot: MapStateSnapshot<C>) => D;
  /** Auth actions to expose via useSupamachine(). Merged with default signOut. */
  actions?: A;
  children: React.ReactNode;
}

export type UseSupamachineReturn<
  C,
  D extends CustomStateConstraint | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
> = {
  state: AppState<C, D>;
  updateContext: (updater: (current: C) => C | Promise<C>) => Promise<void>;
  refreshContext: (session: Session) => Promise<void>;
  beginAuth: () => void;
  cancelAuth: () => void;
  actions: SupamachineActions<A>;
};
