import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { SupamachineCore } from "../core/runtime";
import { attachSupabase } from "../supabase/adapter";
import { AuthEventType } from "../core/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupamachineProviderProps } from "../core/types";
import { parseLogLevel, LogLevel } from "../core/logger";

export type SupamachineOptions = {
  getSessionTimeoutMs?: number;
  loadContextTimeoutMs?: number;
  initializeAppTimeoutMs?: number;
  /** 'none' | 'error' | 'warn' | 'info' | 'debug'. Default: 'warn'. Uses [Supamachine][subsystem] format. */
  logLevel?: "none" | "error" | "warn" | "info" | "debug";
};

export interface SupamachineProviderPropsWithSupabase<C, D extends { status: string }>
  extends SupamachineProviderProps<C, D> {
  supabase: SupabaseClient;
}

export interface SupamachineContextValue<C, D extends { status: string }> {
  state: import("../core/types").AppState<C, D>;
  updateContext: (updater: (current: C) => C | Promise<C>) => Promise<void>;
}

const SupamachineContext = createContext<SupamachineContextValue<unknown, { status: string }> | null>(
  null,
);

export function SupamachineProvider<C, D extends { status: string }>({
  supabase,
  loadContext,
  mapState,
  initializeApp,
  children,
  options: opts = {},
}: SupamachineProviderPropsWithSupabase<C, D> & { options?: SupamachineOptions }) {
  const coreRef = useRef<SupamachineCore<C, D> | null>(null);
  const unsubAdapterRef = useRef<(() => void) | null>(null);
  const [contextValue, setContextValue] = useState<SupamachineContextValue<C, D> | null>(null);

  const logLevel =
    typeof opts.logLevel === "string" ? parseLogLevel(opts.logLevel) : opts.logLevel ?? LogLevel.WARN;

  if (!coreRef.current) {
    coreRef.current = new SupamachineCore<C, D>({
      loadContext,
      mapState,
      initializeApp,
      loadContextTimeoutMs: opts.loadContextTimeoutMs,
      initializeAppTimeoutMs: opts.initializeAppTimeoutMs,
      logLevel,
    });
    unsubAdapterRef.current = attachSupabase(coreRef.current, supabase, {
      getSessionTimeoutMs: opts.getSessionTimeoutMs,
      logLevel,
    });
    coreRef.current.dispatch({ type: AuthEventType.START });

    setContextValue({
      state: coreRef.current.getAppState(),
      updateContext: (updater) => coreRef.current!.updateContext(updater),
    });
  }

  useEffect(() => {
    const core = coreRef.current!;
    const unsubscribe = core.subscribe(() => {
      setContextValue({
        state: core.getAppState(),
        updateContext: (updater) => core.updateContext(updater),
      });
    });
    return () => {
      unsubscribe();
      unsubAdapterRef.current?.();
    };
  }, []);

  if (!contextValue) {
    return null;
  }

  return (
    <SupamachineContext.Provider value={contextValue as SupamachineContextValue<unknown, { status: string }>}>
      {children}
    </SupamachineContext.Provider>
  );
}

export function useSupamachine<C, D extends { status: string }>() {
  const ctx = useContext(SupamachineContext);
  if (!ctx) {
    throw new Error("useSupamachine must be used within SupamachineProvider");
  }
  return ctx as SupamachineContextValue<C, D>;
}
