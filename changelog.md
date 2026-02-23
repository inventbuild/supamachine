# v0.3.3

- Added `refreshContext()` method: re-runs `loadContext()` and replaces `session` and `context` while staying in the `AUTH_READY` state. `mapState()` is then triggered.
- Changed response to the Supabase `USER_UPDATED` event to call `refreshContext()`

# v0.3.2

- Patch missing edge between `AUTH_READY` and `AUTHENTICATING`

# v0.3.1

- Add `AUTHENTICATING` state and change `CHECKING` to `CHECKING_SESSION`

# v0.3.0

- Initial publiic version
