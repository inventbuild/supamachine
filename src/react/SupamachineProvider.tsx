import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SupamachineCore } from "../core/runtime";
import { attachSupabase } from "../supabase/adapter";
import { AuthEventType } from "../core/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupamachineProviderProps, SupamachineActions } from "../core/types";
import { parseLogLevel, LogLevel } from "../core/logger";

export type SupamachineOptions = {
  getSessionTimeoutMs?: number;
  loadContextTimeoutMs?: number;
  initializeAppTimeoutMs?: number;
  authenticatingTimeoutMs?: number;
  /** 'none' | 'error' | 'warn' | 'info' | 'debug'. Default: 'warn'. Uses [Supamachine][subsystem] format. */
  logLevel?: "none" | "error" | "warn" | "info" | "debug";
};

export interface SupamachineProviderPropsWithSupabase<
  C,
  D extends { status: string } | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
> extends SupamachineProviderProps<C, D, A> {
  supabase: SupabaseClient;
}

export interface SupamachineContextValue<
  C,
  D extends { status: string } | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
> {
  state: import("../core/types").AppState<C, D>;
  updateContext: (updater: (current: C) => C | Promise<C>) => Promise<void>;
  beginAuth: () => void;
  cancelAuth: () => void;
  actions: SupamachineActions<A>;
}

const defaultSignOut = (supabase: SupabaseClient) => () => {
  void supabase.auth.signOut();
};

const SupamachineContext = createContext<SupamachineContextValue<
  unknown,
  { status: string },
  Record<string, (...args: any[]) => any>
> | null>(null);

export function SupamachineProvider<
  C,
  D extends { status: string } | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
>({
  supabase,
  loadContext,
  mapState,
  initializeApp,
  actions: userActions,
  children,
  options: opts = {},
}: SupamachineProviderPropsWithSupabase<C, D, A> & { options?: SupamachineOptions }) {
  const coreRef = useRef<SupamachineCore<C, D> | null>(null);
  const unsubAdapterRef = useRef<(() => void) | null>(null);
  const [contextValue, setContextValue] = useState<SupamachineContextValue<C, D, A> | null>(null);

  const actions = useMemo(
    () =>
      ({
        signOut: defaultSignOut(supabase),
        ...userActions,
      }) as SupamachineActions<A>,
    [supabase, userActions],
  );

  const logLevel =
    typeof opts.logLevel === "string" ? parseLogLevel(opts.logLevel) : opts.logLevel ?? LogLevel.WARN;

  if (!coreRef.current) {
    coreRef.current = new SupamachineCore<C, D>({
      loadContext,
      mapState,
      initializeApp,
      loadContextTimeoutMs: opts.loadContextTimeoutMs,
      initializeAppTimeoutMs: opts.initializeAppTimeoutMs,
      authenticatingTimeoutMs: opts.authenticatingTimeoutMs,
      logLevel,
    });
    unsubAdapterRef.current = attachSupabase(coreRef.current, supabase, {
      getSessionTimeoutMs: opts.getSessionTimeoutMs,
      logLevel,
    });
    coreRef.current.dispatch({ type: AuthEventType.START });
  }

  // Stable references — coreRef.current is set once and never changes
  const updateContext = useCallback(
    (updater: (current: C) => C | Promise<C>) => coreRef.current!.updateContext(updater),
    [],
  );
  const beginAuth = useCallback(() => coreRef.current!.beginAuth(), []);
  const cancelAuth = useCallback(() => coreRef.current!.cancelAuth(), []);

  if (!contextValue) {
    setContextValue({
      state: coreRef.current.getAppState(),
      updateContext,
      beginAuth,
      cancelAuth,
      actions,
    });
  }

  useEffect(() => {
    const core = coreRef.current!;
    const unsubscribe = core.subscribe(() => {
      setContextValue({
        state: core.getAppState(),
        updateContext,
        beginAuth,
        cancelAuth,
        actions,
      });
    });
    return () => {
      unsubscribe();
      unsubAdapterRef.current?.();
    };
  }, [actions, updateContext, beginAuth, cancelAuth]);

  if (!contextValue) {
    return null;
  }

  return (
    <SupamachineContext.Provider
      value={contextValue as SupamachineContextValue<unknown, { status: string }, Record<string, (...args: any[]) => any>>}
    >
      {children}
    </SupamachineContext.Provider>
  );
}

export function useSupamachine<
  C,
  D extends { status: string } | void = void,
  A extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
>() {
  const ctx = useContext(SupamachineContext);
  if (!ctx) {
    throw new Error("useSupamachine must be used within SupamachineProvider");
  }
  return ctx as SupamachineContextValue<C, D, A>;
}
