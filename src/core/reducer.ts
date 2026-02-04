import { AuthState } from './states'
import { AuthEvent } from './events'

export function reducer(
  state: AuthState,
  event: AuthEvent
): AuthState {
  switch (state.status) {
    case 'INIT':
      if (event.type === 'START') {
        return { status: 'CHECKING' }
      }
      break

    case 'CHECKING':
      if (event.type === 'SESSION_FOUND') {
        return {
          status: 'SIGNED_IN',
          session: event.session,
          user: event.session.user,
        }
      }
      if (event.type === 'NO_SESSION') {
        return { status: 'SIGNED_OUT' }
      }
      break

    case 'SIGNED_IN':
      if (event.type === 'PROFILE_LOADED') {
        return {
          status: 'READY',
          session: state.session,
          user: state.user,
          profile: event.profile,
        }
      }
      break

    case 'READY':
      if (event.type === 'SIGNED_OUT') {
        return { status: 'SIGNED_OUT' }
      }
      break
  }

  return state
}
