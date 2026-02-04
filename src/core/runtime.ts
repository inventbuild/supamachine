import { AuthState } from './states'
import { AuthEvent } from './events'
import { reducer } from './reducer'

export class SupamachineCore {
  private state: AuthState = { status: 'INIT' }
  private listeners = new Set<(s: AuthState) => void>()

  constructor(
    private readonly loadProfile: (userId: string) => Promise<unknown>
  ) {}

  dispatch(event: AuthEvent) {
    this.state = reducer(this.state, event)
    this.emit()

    if (this.state.status === 'SIGNED_IN') {
      this.loadProfile(this.state.user.id)
        .then(profile => {
          this.dispatch({ type: 'PROFILE_LOADED', profile })
        })
        .catch(error => {
          this.dispatch({ type: 'ERROR', error })
        })
    }
  }

  subscribe(fn: (s: AuthState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot() {
    return this.state
  }

  private emit() {
    for (const l of this.listeners) l(this.state)
  }
}
