import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { SupamachineCore } from '../core/runtime'
import { attachSupabase } from '../supabase/adapter'
import { AuthState } from '../core/states'
import { AuthEventType } from '../core/constants'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  LoadContext,
  DeriveAppState,
  InitializeApp,
  ContextUpdater,
  AppState,
} from '../core/types'
import { parseLogLevel, LogLevel } from '../core/logger'

export type SupamachineOptions = {
  getSessionTimeoutMs?: number
  loadContextTimeoutMs?: number
  initializeAppTimeoutMs?: number
  /** 'none' | 'error' | 'warn' | 'info' | 'debug'. Default: 'warn'. Uses [Supamachine][subsystem] format. */
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug'
}

export interface SupamachineContextValue {
  coreState: AuthState
  appState: AppState
}

const SupamachineContext = createContext<SupamachineContextValue | null>(null)

export function SupamachineProvider({
  supabase,
  loadContext,
  deriveAppState,
  initializeApp,
  contextUpdaters,
  children,
  options,
}: {
  supabase: SupabaseClient
  loadContext: LoadContext
  deriveAppState?: DeriveAppState
  initializeApp?: InitializeApp
  contextUpdaters?: ContextUpdater[]
  children: React.ReactNode
  options?: SupamachineOptions
}) {
  const coreRef = useRef<SupamachineCore | null>(null)
  const [contextValue, setContextValue] =
    useState<SupamachineContextValue | null>(null)

  const logLevel =
    typeof options?.logLevel === 'string'
      ? parseLogLevel(options.logLevel)
      : options?.logLevel ?? LogLevel.WARN

  if (!coreRef.current) {
    coreRef.current = new SupamachineCore(
      loadContext,
      deriveAppState,
      initializeApp,
      {
        loadContextTimeoutMs: options?.loadContextTimeoutMs,
        initializeAppTimeoutMs: options?.initializeAppTimeoutMs,
        logLevel,
      }
    )
    coreRef.current.setContextUpdaters(contextUpdaters ?? [])
    attachSupabase(coreRef.current, supabase, {
      getSessionTimeoutMs: options?.getSessionTimeoutMs,
      logLevel,
    })
    coreRef.current.dispatch({ type: AuthEventType.START })

    setContextValue({
      coreState: coreRef.current.getSnapshot(),
      appState: coreRef.current.getAppState(),
    })
  }

  useEffect(() => {
    const unsubscribe = coreRef.current!.subscribe(
      (coreState: AuthState, appState: AppState) => {
        setContextValue({ coreState, appState })
      }
    )
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (coreRef.current) {
      coreRef.current.setContextUpdaters(contextUpdaters ?? [])
      coreRef.current.updateContext()
    }
  }, [contextUpdaters])

  if (!contextValue) {
    return null
  }

  return (
    <SupamachineContext.Provider value={contextValue}>
      {children}
    </SupamachineContext.Provider>
  )
}

export function useSupamachine() {
  const ctx = useContext(SupamachineContext)
  if (!ctx) {
    throw new Error('useSupamachine must be used within SupamachineProvider')
  }
  return ctx
}
