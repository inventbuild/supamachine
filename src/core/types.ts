import type { Session, User } from "@supabase/supabase-js";
import type { CoreState } from "./states";
import { AuthStateStatus } from "./constants";

/**
 * API-facing types for Supamachine.
 *
 * @remarks
 * These types describe the auth state and helpers returned from
 * {@link useSupamachine}.
 *
 * @typeParam C - Custom context type loaded for an authenticated user.
 * @typeParam D - Optional custom app states derived from the context.
 */

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

type WithSessionContext<C, T> = T extends { status: string }
  ? T & { session: Session; context: C }
  : never;

export type MapStateSnapshot<C> = {
  /**
   * Underlying core status. Always {@link AuthStateStatus.AUTH_READY} here.
   */
  status: typeof AuthStateStatus.AUTH_READY;
  /**
   * Current Supabase session for the user.
   */
  session: Session;
  /**
   * Loaded app context for the user.
   */
  context: C;
};

export type AppState<C, D = void> = [D] extends [void]
  ? CoreState<C>
  :
      | Exclude<CoreState<C>, { status: typeof AuthStateStatus.AUTH_READY }>
      | WithSessionContext<C, D>;

export type DefaultActions = {
  /**
   * Signs the current user out.
   */
  signOut: () => void | Promise<unknown>;
};

export type SupamachineActions<A = Record<string, never>> = DefaultActions & A;

export interface SupamachineProviderProps<
  C,
  D extends CustomStateConstraint | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
> {
  /**
   * Loads your app-specific context for an authenticated session.
   */
  loadContext?: (session: Session) => Promise<C>;
  /**
   * Runs once after context is loaded, before the app enters the ready state.
   */
  initializeApp?: (snapshot: {
    session: Session;
    context: C;
  }) => void | Promise<void>;
  /**
   * Derives your custom app states from the loaded context.
   */
  mapState?: [D] extends [void]
    ? never
    : (snapshot: MapStateSnapshot<C>) => D;
  /**
   * Auth actions to expose via {@link useSupamachine}. Merged with default
   * {@link DefaultActions.signOut | signOut}.
   */
  actions?: A;
  children: React.ReactNode;
}

export type UseSupamachineReturn<
  C,
  D extends CustomStateConstraint | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
> = {
  /**
   * Current combined auth state.
   */
  state: AppState<C, D>;
  /**
   * Safely updates the stored context in place.
   */
  updateContext: (updater: (current: C) => C | Promise<C>) => Promise<void>;
  /**
   * Re-runs {@link SupamachineProviderProps.loadContext | loadContext} with a
   * fresh session and swaps in the new context.
   */
  refreshContext: (session: Session) => Promise<void>;
  /**
   * Marks that the user has started an auth flow (for example opening a login
   * screen).
   */
  beginAuth: () => void;
  /**
   * Cancels an in-progress auth flow and returns to the previous state.
   */
  cancelAuth: () => void;
  /**
   * Auth actions available to your UI, including the default
   * {@link DefaultActions.signOut | signOut}.
   */
  actions: SupamachineActions<A>;
};
