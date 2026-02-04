import { SupamachineCore } from '../core/runtime'
import { SupabaseClient } from '@supabase/supabase-js'

export function attachSupabase(
  core: SupamachineCore,
  supabase: SupabaseClient
) {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      core.dispatch({ type: 'SESSION_FOUND', session: data.session })
    } else {
      core.dispatch({ type: 'NO_SESSION' })
    }
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      core.dispatch({ type: 'SIGNED_OUT' })
    } else {
      core.dispatch({ type: 'SESSION_FOUND', session })
    }
  })
}
