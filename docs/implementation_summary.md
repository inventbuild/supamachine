# Supamachine Implementation Summary

## Completed Changes

### 1. State Renaming & New Error States
- ✅ `INIT` → `START` (initial state)
- ✅ `READY` → `AUTH_READY`
- ✅ `ERROR_INIT` → `ERROR_CHECKING`
- ✅ All states defined in `AuthStateStatus` enum and reused everywhere

### 2. Event Model Updates
- ✅ `PROFILE_LOADED` → `CONTEXT_LOADED` (includes both userData and context)
- ✅ `ERROR` events now include `errorType: 'CHECKING' | 'CONTEXT' | 'AUTH'`
- ✅ Token refresh events (`TOKEN_REFRESHED`) filtered out in adapter (no-op)

### 3. Core Runtime (`src/core/runtime.ts`)
- ✅ `loadProfile` → `loadContext` (generalized to include AsyncStorage, deep links, etc.)
- ✅ `loadContext` wrapped in timeout (default 10s, configurable)
- ✅ `initializeApp` callback with timeout (default 30s, configurable)
- ✅ `deriveAppState` pure function runs on every core state transition
- ✅ `contextUpdaters` array for listening to context changes (deep links, etc.)
- ✅ `updateContext()` method to trigger context reload when updaters detect changes
- ✅ Strict error handling: `loadContext` failures → `ERROR_CONTEXT` (no try-catch in user code)

### 4. Supabase Adapter (`src/supabase/adapter.ts`)
- ✅ `getSession()` wrapped in timeout (default 10s, configurable)
- ✅ Timeout failures → `ERROR_CHECKING`
- ✅ `TOKEN_REFRESHED` events filtered out (no state transition)
- ✅ All Supabase auth events handled explicitly: `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`, `PASSWORD_RECOVERY`; default case logs warning

### 5. Reducer (`src/core/reducer.ts`)
- ✅ Handles all new states (`AUTH_READY`, `ERROR_CHECKING`, `ERROR_CONTEXT`, `ERROR_AUTH`)
- ✅ `TOKEN_REFRESHED` events are no-ops (filtered by adapter, but reducer handles gracefully)
- ✅ Error recovery: error states can recover on `SESSION_FOUND` or `NO_SESSION`
- ✅ Proper transitions for all state combinations

### 6. React Provider (`src/react/SupamachineProvider.tsx`)
- ✅ Updated API: `loadContext`, `deriveAppState`, `initializeApp`, `contextUpdaters`
- ✅ Returns `coreState` and `appState` via `useSupamachine()`. `appState` is purely derived (never mutable); when `deriveAppState` is unspecified, `appState` equals `coreState.status`. `contextUpdaters` optional.
- ✅ Configurable timeouts via `options` prop
- ✅ `contextUpdaters` can be updated dynamically
- ✅ `logLevel` option: `'none' | 'error' | 'warn' | 'info' | 'debug'`. Logs use `[Supamachine][subsystem] message` format.

### 7. Type System (`src/core/types.ts`)
- ✅ `LoadContext`: `(session: SessionLike | null) => Promise<LoadContextResult>` — works when signed in or out
- ✅ `DeriveAppState`: `(coreState: AuthState, context: AppContext | null) => AppState` — returns string
- ✅ `AppState`: `string` (not unknown)
- ✅ `InitializeApp`: `(ctx) => Promise<void>`
- ✅ `ContextUpdater`: `(coreState: AuthState, currentContext: AppContext) => AppContext | Promise<AppContext>` — receives coreState
- ✅ All types exported from main `index.ts`

### 8. Specification Updates
- ✅ Updated `supamachine_spec.md` with all clarifications
- ✅ Documented error states, timeouts, context system
- ✅ Updated lifecycle diagram

## Key Design Decisions

### Context System
- `loadContext` returns both `userData` (profile) and `context` (AsyncStorage, deep links, etc.)
- `contextUpdaters` receive `(coreState, currentContext)` and can update context; allow apps to listen for external changes (e.g., deep link received)
- When context changes, `updateContext()` triggers a reload

### Derived App State
- Pure function that runs on **every** core state transition
- Receives `coreState` and `context` (null when not `AUTH_READY`)
- Returns app-specific state (e.g., `NEEDS_PASSWORD`, `APP_READY`)
- No side effects allowed

### Error Handling
- **Strict failure modes**: No try-catch in `loadContext` - failures transition to `ERROR_CONTEXT`
- **Timeout protection**: Both `loadContext` and `initializeApp` wrapped in timeouts
- **Recovery**: Error states can recover on new session/auth events

### Token Refresh
- `TOKEN_REFRESHED` events filtered out at adapter level
- Reducer handles them as no-ops (defensive)
- No state changes occur for token refresh

## Next Steps for PhotoPhlo Integration

1. **Create `loadContext` function**:
   ```ts
   async function loadContext(session: SessionLike | null) {
     const [pendingEmail, passwordReset, skipWelcome] = await Promise.all([
       AsyncStorage.getItem(PENDING_SIGNUP_EMAIL_KEY),
       AsyncStorage.getItem(PASSWORD_RESET_KEY),
       AsyncStorage.getItem(SKIP_WELCOME_SCREEN_KEY),
     ])
     if (!session) {
       return { context: { pendingEmail, passwordReset, skipWelcome } }
     }
     const profile = await getProfile(session.user.id)
     return {
       userData: profile,
       context: { pendingEmail, passwordReset, skipWelcome },
     }
   }
   ```

2. **Create `deriveAppState` function**:
   ```ts
   function deriveAppState(state: AuthState, context: AppContext | null): string {
     if (state.status === 'AUTH_READY') {
       const { userData, context: ctx } = state
       if (userData.deleted_at) return 'ACCOUNT_DELETED'
       if (!state.user.user_metadata?.passwordSet) return 'NEEDS_PASSWORD'
       if (!state.user.user_metadata?.onboarded) return 'NEEDS_ONBOARDING'
       return 'APP_READY'
     }
     if (state.status === 'SIGNED_OUT' && context?.pendingEmail) {
       return 'PENDING_VERIFICATION'
     }
     return state.status
   }
   ```

3. **Create `initializeApp` function** (moves `postLogin` logic):
   ```ts
   async function initializeApp(ctx) {
     await postLogin(ctx.session)
     // Register notifications, etc.
   }
   ```

4. **Create deep link updater**:
   ```ts
   async function deepLinkUpdater(context: AppContext) {
     const url = await Linking.getInitialURL()
     return { ...context, deepLink: url }
   }
   ```

5. **Update `app/index.tsx`**:
   - Remove `onAuthStateChange` navigation logic
   - Use `auth.appState` (and `auth.coreState` if needed) for single navigation decision
   - Declarative: "if appState is X, navigate to Y"

## IDE / TypeScript Setup

- **`setTimeout`, `console`**: `tsconfig.json` includes `"DOM"` in `lib` so the IDE recognizes browser/React Native globals.
- **React types**: `@types/react` is in `devDependencies` for JSX and React API types.

## Testing Checklist

- [ ] Unit tests for reducer transitions
- [ ] Test `loadContext` timeout behavior
- [ ] Test `initializeApp` timeout behavior
- [ ] Test `getSession` timeout behavior
- [ ] Test `TOKEN_REFRESHED` filtering
- [ ] Test error recovery paths
- [ ] Test `contextUpdaters` triggering reloads
- [ ] Test `deriveAppState` on all state transitions
