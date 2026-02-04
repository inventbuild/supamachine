import type { Session, User } from '@supabase/supabase-js'

export type Profile = unknown

export type AuthState =
  | { status: 'INIT' }
  | { status: 'CHECKING' }
  | { status: 'SIGNED_OUT' }
  | { status: 'SIGNED_IN'; session: Session; user: User }
  | { status: 'READY'; session: Session; user: User; profile: Profile }
  | { status: 'ERROR'; error: Error }
