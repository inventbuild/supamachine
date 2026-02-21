import { SupamachineCore } from '../core/runtime'
import type { SupabaseClient, AuthChangeEvent } from '@supabase/supabase-js'
import { AuthEventType } from '../core/constants'
import { createLogger, type LogLevel } from '../core/logger'

const DEFAULT_GET_SESSION_TIMEOUT_MS = 10_000

export function attachSupabase(
  core: SupamachineCore,
  supabase: SupabaseClient,
  options?: {
    getSessionTimeoutMs?: number
    logLevel?: LogLevel
  }
): () => void {
  const timeoutMs = options?.getSessionTimeoutMs ?? DEFAULT_GET_SESSION_TIMEOUT_MS
  const log = createLogger('adapter', options?.logLevel ?? 2)

  const getSessionPromise = supabase.auth.getSession()
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('getSession timeout')), timeoutMs)
  )

  Promise.race([getSessionPromise, timeoutPromise])
    .then(({ data, error }) => {
      if (error) {
        core.dispatch({
          type: AuthEventType.ERROR_CHECKING,
          error: new Error(error.message),
        })
      } else if (data.session) {
        core.dispatch({ type: AuthEventType.SESSION_FOUND, session: data.session })
      } else {
        core.dispatch({ type: AuthEventType.NO_SESSION })
      }
    })
    .catch((error) => {
      core.dispatch({
        type: AuthEventType.ERROR_CHECKING,
        error: error instanceof Error ? error : new Error(String(error)),
      })
    })

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event: AuthChangeEvent, session) => {
      switch (event) {
        case 'INITIAL_SESSION':
          if (session) {
            core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
          } else {
            core.dispatch({ type: AuthEventType.NO_SESSION })
          }
          break

        case 'SIGNED_IN':
          if (session) {
            core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
          }
          break

        case 'SIGNED_OUT':
          core.dispatch({ type: AuthEventType.SIGNED_OUT })
          break

        case 'TOKEN_REFRESHED':
          break

        case 'USER_UPDATED':
          if (session) {
            core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
          }
          break

        case 'PASSWORD_RECOVERY':
          if (session) {
            core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
          }
          break

        case 'MFA_CHALLENGE_VERIFIED':
          if (session) {
            core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
          }
          break

        default: {
          const _exhaustive: never = event
          log.warn(`unhandled auth event: ${event}`)
        }
      }
    }
  )

  return () => {
    subscription.unsubscribe()
  }
}
