import type { Session } from '@supabase/supabase-js'

export type AuthEvent =
  | { type: 'START' }
  | { type: 'SESSION_FOUND'; session: Session }
  | { type: 'NO_SESSION' }
  | { type: 'SIGNED_OUT' }
  | { type: 'PROFILE_LOADED'; profile: unknown }
  | { type: 'ERROR'; error: Error }
