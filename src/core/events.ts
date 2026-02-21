import type { Session } from '@supabase/supabase-js'
import type { UserData, AppContext } from './types'
import { AuthEventType } from './constants'

export type AuthEvent =
  | { type: typeof AuthEventType.START }
  | { type: typeof AuthEventType.SESSION_FOUND; session: Session }
  | { type: typeof AuthEventType.NO_SESSION }
  | { type: typeof AuthEventType.SIGNED_OUT }
  | {
      type: typeof AuthEventType.CONTEXT_LOADED
      userData: UserData | null
      context: AppContext
    }
  | { type: typeof AuthEventType.ERROR_CHECKING; error: Error }
  | { type: typeof AuthEventType.ERROR_CONTEXT; error: Error }
  | { type: typeof AuthEventType.ERROR_AUTH; error: Error }
