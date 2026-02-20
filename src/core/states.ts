import type { Session, User } from '@supabase/supabase-js'
import { AuthStateStatus, ErrorType } from './constants'

export type UserData = unknown
export type AppContext = unknown

export type AuthState =
  | { status: typeof AuthStateStatus.START }
  | { status: typeof AuthStateStatus.CHECKING }
  | { status: typeof AuthStateStatus.SIGNED_OUT; context?: AppContext }
  | { status: typeof AuthStateStatus.SIGNED_IN; session: Session; user: User }
  | {
      status: typeof AuthStateStatus.AUTH_READY
      session: Session
      user: User
      userData: UserData | null
      context?: AppContext
    }
  | { status: typeof AuthStateStatus.ERROR_CHECKING; error: Error }
  | {
      status: typeof AuthStateStatus.ERROR_CONTEXT
      error: Error
      session: Session
      user: User
    }
  | { status: typeof AuthStateStatus.ERROR_AUTH; error: Error }
