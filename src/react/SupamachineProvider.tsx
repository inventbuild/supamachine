import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { SupamachineCore } from '../core/runtime'
import { attachSupabase } from '../supabase/adapter'
import { AuthState } from '../core/states'
import { SupabaseClient } from '@supabase/supabase-js'

const SupamachineContext = createContext<AuthState | null>(null)

export function SupamachineProvider({
  supabase,
  loadProfile,
  children,
}: {
  supabase: SupabaseClient
  loadProfile: (userId: string) => Promise<unknown>
  children: React.ReactNode
}) {
  const coreRef = useRef<SupamachineCore | null>(null)

  if (!coreRef.current) {
    coreRef.current = new SupamachineCore(loadProfile)
    attachSupabase(coreRef.current, supabase)
    coreRef.current.dispatch({ type: 'START' })
  }

  const [state, setState] = useState<AuthState>(
    coreRef.current.getSnapshot()
  )

  useEffect(() => {
    return coreRef.current!.subscribe(setState)
  }, [])

  return (
    <SupamachineContext.Provider value={state}>
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
