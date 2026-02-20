# PhotoPhlo Structural State Analysis

## Current State Machine (Implicit, Scattered)

PhotoPhlo currently has **two competing navigation decision-makers** that both react to auth state changes:

1. **`app/index.tsx`** - Initial routing logic (runs on mount + when `session`/`loading` change)
2. **`contexts/AuthContext.tsx`** - `onAuthStateChange` listener (runs on every Supabase auth event)

Both independently decide where to navigate based on overlapping conditions, causing:
- Race conditions
- Double navigation (blank screen issue)
- Unpredictable behavior

---

## All Structural States PhotoPhlo Can Be In

### Core Auth States (Supabase-level)

1. **INITIAL_LOADING** (`loading: true`, no session yet)
   - App just started, `getSession()` in progress
   - **Navigation**: Show splash/loading screen
   - **Supamachine**: `CHECKING`

2. **NO_SESSION** (`session: null`, `loading: false`)
   - User not signed in
   - **Navigation**: `/(auth)/login` (or `/(auth)/verify-otp` if `PENDING_SIGNUP_EMAIL_KEY` exists)
   - **Supamachine**: `SIGNED_OUT`

3. **SESSION_EXISTS** (`session: Session`, `loading: false`)
   - Valid Supabase session exists
   - **Navigation**: Depends on user metadata (see below)
   - **Supamachine**: `SIGNED_IN` → `AUTH_READY` (after profile loads)

### Derived App States (PhotoPhlo-specific)

4. **SESSION_BUT_DELETED** (`session` exists, `profile.deleted_at` set)
   - Account was soft-deleted
   - **Navigation**: `/(auth)/deleted-account`
   - **Supamachine**: `deriveAppState` → `ACCOUNT_DELETED`

5. **SESSION_BUT_NO_PASSWORD** (`session` exists, `user_metadata.passwordSet === false`)
   - OAuth user who hasn't set password yet
   - **Navigation**: `/(auth)/set-password`
   - **Supamachine**: `deriveAppState` → `NEEDS_PASSWORD`

6. **SESSION_BUT_NOT_ONBOARDED** (`session` exists, `passwordSet: true`, `onboarded: false`)
   - User set password but hasn't completed onboarding
   - **Navigation**: `/onboarding`
   - **Supamachine**: `deriveAppState` → `NEEDS_ONBOARDING`

7. **SESSION_READY** (`session` exists, `passwordSet: true`, `onboarded: true`, profile loaded)
   - Fully authenticated and ready to use app
   - **Navigation**: `/(tabs)/home` (or notification target)
   - **Supamachine**: `AUTH_READY` + `deriveAppState` → `APP_READY`

8. **PENDING_OTP_VERIFICATION** (`session: null`, `PENDING_SIGNUP_EMAIL_KEY` in AsyncStorage)
   - User started signup, waiting for OTP email
   - **Navigation**: `/(auth)/verify-otp`
   - **Supamachine**: `SIGNED_OUT` + `deriveAppState` → `PENDING_VERIFICATION` (needs AsyncStorage check)

9. **PASSWORD_RESET_FLOW** (`session` exists, `PASSWORD_RESET_KEY` in AsyncStorage)
   - User clicked password reset link
   - **Navigation**: `/(auth)/reset-password`
   - **Supamachine**: `deriveAppState` → `PASSWORD_RESET` (needs AsyncStorage check)

10. **FIRST_LAUNCH** (`SKIP_WELCOME_SCREEN_KEY` not set)
    - User never opened app before
    - **Navigation**: `/welcome`
    - **Supamachine**: Outside auth scope (handled by app-level logic)

---

## The Blank Screen Problem - Root Cause Analysis

### What Happens Currently

**Scenario**: User on `(tabs)/profile/settings` (fullScreenModal) taps "Log Out"

1. **`signOut()` called**:
   - `router.dismiss()` or `router.dismissTo("/(auth)/login")` runs immediately
   - Navigation starts: settings modal begins dismissing
   - **Session still valid** at this point

2. **After delay** (2s):
   - `supabase.auth.signOut()` completes
   - Supabase fires `onAuthStateChange('SIGNED_OUT', null)`

3. **Two listeners react simultaneously**:
   
   **A. AuthContext listener** (line 212-218):
   ```ts
   else if (event !== "INITIAL_SESSION" && !skipReplaceToLoginForAccountDeleteRef.current) {
     setIsSigningIn(false);
     router.dismissTo("/(auth)/login");  // ← Navigation #1
   }
   ```
   
   **B. `app/index.tsx` effect** (line 119-120):
   ```ts
   // No session → login
   router.replace("/(auth)/login");  // ← Navigation #2
   ```

4. **The conflict**:
   - Navigation #1 (`dismissTo`) tries to pop back to existing `(auth)/login` route
   - Navigation #2 (`replace`) tries to replace current route with `(auth)/login`
   - React Navigation gets confused: "Am I popping or replacing?"
   - **Result**: Brief blank screen (navigation state reset) → then animation

### Why Supamachine Would Fix This

**With Supamachine**:

1. **Single source of truth**: Only ONE place reads auth state (`useSupamachine()`)
2. **Deterministic state**: App knows exactly what state it's in (`AUTH_READY`, `SIGNED_OUT`, etc.)
3. **No competing listeners**: `app/index.tsx` would read `auth.status` and decide navigation ONCE
4. **No race conditions**: State machine guarantees transitions are atomic

**The fix**:
- `app/index.tsx` would have ONE effect that reads `auth.status`
- When `auth.status === 'SIGNED_OUT'`, navigate to login (once)
- No `onAuthStateChange` listener doing navigation
- Navigation logic becomes declarative based on state, not reactive to events

---

## Navigation Decision Matrix

| State | Session | Profile | passwordSet | onboarded | PENDING_SIGNUP | Navigation Target |
|-------|---------|---------|-------------|-----------|---------------|-------------------|
| INITIAL_LOADING | null | - | - | - | - | Splash/Loading |
| NO_SESSION | null | - | - | - | false | `/(auth)/login` |
| PENDING_OTP | null | - | - | - | true | `/(auth)/verify-otp` |
| DELETED | ✓ | deleted_at | - | - | - | `/(auth)/deleted-account` |
| NEEDS_PASSWORD | ✓ | ✓ | false | - | - | `/(auth)/set-password` |
| NEEDS_ONBOARDING | ✓ | ✓ | true | false | - | `/onboarding` |
| APP_READY | ✓ | ✓ | true | true | - | `/(tabs)/home` |

---

## How Supamachine Maps to PhotoPhlo States

### Core States (Supamachine)

| Supamachine State | PhotoPhlo Equivalent | Guarantees |
|-------------------|----------------------|------------|
| `INIT` | Before provider mounts | Machine not started |
| `CHECKING` | `loading: true` | Session resolution in progress |
| `SIGNED_OUT` | `session: null`, `loading: false` | No valid session |
| `SIGNED_IN` | `session: Session`, profile loading | Session + user exist, profile not yet loaded |
| `AUTH_READY` | `session: Session`, `profile: Profile` | Session + user + profile all present |
| `ERROR_HYDRATION` | Profile load failed | Session valid but profile load failed |
| `ERROR_CHECKING` | `getSession()` timeout | Initial session check failed |
| `ERROR_AUTH` | Auth operation failed | Terminal auth error |

### Derived States (via `deriveAppState`)

| Derived State | Core State | Additional Data | Navigation |
|---------------|------------|-----------------|------------|
| `ACCOUNT_DELETED` | `AUTH_READY` | `profile.deleted_at` | `/(auth)/deleted-account` |
| `NEEDS_PASSWORD` | `AUTH_READY` | `user.passwordSet === false` | `/(auth)/set-password` |
| `NEEDS_ONBOARDING` | `AUTH_READY` | `user.onboarded === false` | `/onboarding` |
| `APP_READY` | `AUTH_READY` | `passwordSet && onboarded && !deleted_at` | `/(tabs)/home` |
| `PENDING_VERIFICATION` | `SIGNED_OUT` | `PENDING_SIGNUP_EMAIL_KEY` exists | `/(auth)/verify-otp` |
| `PASSWORD_RESET` | `AUTH_READY` | `PASSWORD_RESET_KEY` exists | `/(auth)/reset-password` |

---

## Navigation Flow with Supamachine

### Current (Broken) Flow

```
User taps Sign Out
  ↓
signOut() → router.dismissTo()
  ↓
[2s delay]
  ↓
supabase.auth.signOut() completes
  ↓
onAuthStateChange fires
  ↓
┌─────────────────────────┬─────────────────────────┐
│ AuthContext listener    │ app/index.tsx effect     │
│ router.dismissTo(...)   │ router.replace(...)     │
└─────────────────────────┴─────────────────────────┘
  ↓                           ↓
CONFLICT → Blank screen → Animation
```

### Proposed (Fixed) Flow with Supamachine

```
User taps Sign Out
  ↓
signOut() → router.dismissTo() [immediate, session still valid]
  ↓
[pop animation plays smoothly]
  ↓
supabase.auth.signOut() completes
  ↓
Supabase adapter → SESSION_FOUND → NO_SESSION event
  ↓
Supamachine transitions: AUTH_READY → SIGNED_OUT
  ↓
app/index.tsx reads auth.status === 'SIGNED_OUT'
  ↓
Single navigation decision: router.replace("/(auth)/login")
  ↓
No conflict, no blank screen
```

---

## Key Insights

### 1. The Blank Screen is a Navigation Conflict

**Not** a timing issue with Supabase signOut itself, but **two navigation systems fighting**:
- `AuthContext` listener doing `dismissTo`
- `app/index.tsx` effect doing `replace`

**Supamachine fix**: Single navigation decision point based on state, not reactive listeners.

### 2. Navigation Should Be Declarative, Not Reactive

**Current**: "When session changes, navigate"
**Better**: "When state is X, show route Y"

With Supamachine, `app/index.tsx` becomes:
```tsx
const auth = useSupamachine();

useEffect(() => {
  switch (auth.status) {
    case 'SIGNED_OUT':
      if (hasPendingVerification()) {
        router.replace("/(auth)/verify-otp");
      } else {
        router.replace("/(auth)/login");
      }
      break;
    case 'APP_READY':  // derived state
      router.replace("/(tabs)/home");
      break;
    // etc.
  }
}, [auth.status]);  // Single dependency
```

### 3. Side Effects Need Orchestration

**Current**: `postLogin()` runs in `onAuthStateChange` listener (deferred to setTimeout)
**With Supamachine**: `initializeApp` callback runs when transitioning to `AUTH_READY`

This ensures:
- Profile is loaded before `postLogin` runs
- Navigation happens after `postLogin` completes
- No race conditions

### 4. Derived States Solve the "Multiple Checks" Problem

**Current**: Every navigation decision checks:
- `session?.user?.user_metadata?.passwordSet`
- `session?.user?.user_metadata?.onboarded`
- `profile?.deleted_at`
- `PENDING_SIGNUP_EMAIL_KEY`
- `PASSWORD_RESET_KEY`

**With Supamachine**: `deriveAppState` computes ONE canonical state:
- `APP_READY` = all checks pass
- `NEEDS_PASSWORD` = passwordSet is false
- etc.

Navigation logic becomes: `if (auth.status === 'APP_READY') navigate(...)`

---

## Questions for Implementation

1. **AsyncStorage dependencies**: `PENDING_SIGNUP_EMAIL_KEY` and `PASSWORD_RESET_KEY` are outside Supabase. Should `deriveAppState` have access to AsyncStorage, or should these be handled differently?

2. **Deep links**: Password reset deep link (`photophlo://reset-password#...`) needs to be handled before auth state is known. Should this be outside Supamachine scope?

3. **Welcome screen**: `SKIP_WELCOME_SCREEN_KEY` is app-level, not auth-level. Should this be handled separately from Supamachine?

4. **Notification targets**: When app opens from notification, we want to navigate to specific route (chat/phlo) instead of home. Should this be handled by `deriveAppState` or outside Supamachine?

5. **Account deletion flow**: When user deletes account, we need to:
   - Set `skipReplaceToLoginForAccountDeleteRef` to prevent navigation
   - Navigate to `/(auth)/deleted-account`
   - Allow restore or sign out
   
   How should this flow work with Supamachine? Should `ACCOUNT_DELETED` be a core state or derived?

6. **Token refresh**: `TOKEN_REFRESHED` events shouldn't cause state changes (user stays in `AUTH_READY`). Should the Supabase adapter filter these out, or should the reducer handle them as no-ops?

7. **Profile load failures**: If `loadUserData` fails, should we:
   - Stay in `SIGNED_IN` (session valid, profile missing)?
   - Transition to `ERROR_HYDRATION`?
   - Retry automatically?

8. **getSession timeout**: Current code has 10s timeout. Should Supamachine:
   - Have configurable timeout?
   - Default to relying on `INITIAL_SESSION` event only?
   - Expose timeout as a config option?
