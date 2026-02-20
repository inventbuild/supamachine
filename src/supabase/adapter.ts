import { SupamachineCore } from '../core/runtime'
import { SupabaseClient } from '@supabase/supabase-js'
import { AuthEventType, ErrorType } from '../core/constants'
import { createLogger, type LogLevel } from '../core/logger'

const DEFAULT_GET_SESSION_TIMEOUT_MS = 10_000

/**
 * Supabase auth event names per https://supabase.com/docs/reference/javascript/auth-onauthstatechange
 */
const SB_EVENT = {
  INITIAL_SESSION: 'INITIAL_SESSION',
  SIGNED_IN: 'SIGNED_IN',
  SIGNED_OUT: 'SIGNED_OUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  USER_UPDATED: 'USER_UPDATED',
  PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
} as const

export function attachSupabase(
  core: SupamachineCore,
  supabase: SupabaseClient,
  options?: {
    getSessionTimeoutMs?: number
    logLevel?: LogLevel
  }
) {
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
          type: AuthEventType.ERROR,
          error: new Error(error.message),
          errorType: ErrorType.CHECKING,
        })
      } else if (data.session) {
        core.dispatch({ type: AuthEventType.SESSION_FOUND, session: data.session })
      } else {
        core.dispatch({ type: AuthEventType.NO_SESSION })
      }
    })
    .catch((error) => {
      if (error?.message === 'getSession timeout') {
        core.dispatch({
          type: AuthEventType.ERROR,
          error: new Error('getSession timeout'),
          errorType: ErrorType.CHECKING,
        })
      } else {
        core.dispatch({
          type: AuthEventType.ERROR,
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: ErrorType.CHECKING,
        })
      }
    })

  supabase.auth.onAuthStateChange((event: string, session) => {
    switch (event) {
      case SB_EVENT.INITIAL_SESSION:
        if (session) {
          core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
        } else {
          core.dispatch({ type: AuthEventType.NO_SESSION })
        }
        break

      case SB_EVENT.SIGNED_IN:
        if (session) {
          core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
        }
        break

      case SB_EVENT.SIGNED_OUT:
        core.dispatch({ type: AuthEventType.SIGNED_OUT })
        break

      case SB_EVENT.TOKEN_REFRESHED:
        // No state transition - session refresh is transparent
        break

      case SB_EVENT.USER_UPDATED:
        // User metadata changed - trigger context reload
        if (session) {
          core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
        }
        break

      case SB_EVENT.PASSWORD_RECOVERY:
        // Emitted when user lands on page with password recovery link.
        // Session exists; recovery flow is driven by URL/context (loadContext picks up deep link).
        if (session) {
          core.dispatch({ type: AuthEventType.SESSION_FOUND, session })
        }
        break

      default:
        log.warn(`unhandled auth event: ${event}`)
    }
  })
}
