# Supamachine — Design, Architecture, and Usage Specification

## Overview

Supamachine is a Supabase-auth–specific state machine library designed to provide deterministic authentication state with strong invariants for Expo and web applications.  
It replaces large, ambiguous AuthContext logic (session, loading, etc.) with a finite state model that guarantees what is safe to use at any moment.

Primary goals:

- Eliminate auth race conditions
- Provide strong state invariants
- Be Supabase-native (not provider-agnostic in v1)
- Remain lightweight and readable
- Be reusable across multiple projects (PhotoPhlo and future apps)

## Core Philosophy

### Strong Invariants

Each state guarantees specific facts, so when the machine is in a certain state, you know unequivocally what's true.

Examples:

- READY: session, user and user data are guaranteed present
- SIGNED_OUT: no valid session exists

## Scope

### Supabase-Specific

Supamachine is deliberately designed around Supabase Auth:

- Uses `getSession()`
- Uses `onAuthStateChange`
- Assumes client-side session persistence
- Supports async user data hydration

### Future goals

- Non-React bindings
- A new package beyond this one that supports generic multi-provider auth abstractions

Future adapters/bindings are possible, but not a current design target. Nonetheless, we should think ahead and try to architect `supamachine` with this in mind.

## High-Level Architecture

Supabase SDK <-> Supamachine Core <-> Client App

Supabase emits events, Supamachine determines truth, the app reads stable, predictable state.

```
           External World
        (Supabase Auth SDK)
                │
                ▼
         adapters/supabase
        (Event Normalization)
                │
                ▼
            core/
      (Pure State Machine)
                │
                ▼
           bindings/react
     (Hooks, Provider, DX layer)
                │
                ▼
              App UI

```

## Package Structure

```
supamachine/
├─ src/
│  ├─ core/                 # Pure state machine (no React, no Supabase, no platform APIs)
│  │  ├─ states.ts          # Auth state definitions + invariants
│  │  ├─ events.ts          # Normalized, internal, provider-agnostic event definitions
│  │  ├─ reducer.ts         # Pure, deterministic transition logic
│  │  ├─ runtime.ts         # Dispatch, subscriptions, effect orchestration
│  │  └─ types.ts           # Shared, exported core types (e.g. AuthState)
│  │
│  ├─ adapters/             # External systems → normalized machine events
│  │  └─ supabase/          # Supabase-specific event ingestion
│  │     ├─ attachSupabase.ts     # Maps Supabase callbacks → internal events
│  │     └─ types.ts              # Supabase-facing helper types (if necessary)
│  │
│  ├─ bindings/             # Machine → framework integrations (DX layer)
│  │  └─ react/             # React / Expo binding (current primary target)
│  │     ├─ SupamachineProvider.tsx  # Lifecycle + context bridge
│  │     └─ useSupamachine.ts       # Hook for consuming state snapshot
│  │
│  ├─ tests/                # Unit tests that prove the claimed strong invariants
│  │
│  ├─ examples/             # Example implementations
│  │  ├─ web/               # Example web application using Supamachine
│  │  └─ expo/              # Example Expo/React Native application using Supamachine
│  │
│  ├─ index.ts              # Public API surface (re-exports only)
│  └─ internal.ts           # (optional) non-public exports for testing/dev
│
├─ dist/                    # Build output (tsc) — gitignored, published
├─ package.json
├─ tsconfig.json
├─ README.md
└─ .gitignore

```

Key rule: The core layer must remain framework-agnostic and side-effect minimal.

## Core States and Invariants

| State          | Guaranteed Truth                             |
| -------------- | -------------------------------------------- |
| START          | Machine not started                          |
| CHECKING       | Session resolution in progress               |
| SIGNED_OUT     | No session                                   |
| SIGNED_IN      | Valid session + user                         |
| AUTH_READY     | Session + user + hydrated user data          |
| ERROR_CHECKING | Initial session check failed (timeout/error) |
| ERROR_CONTEXT  | Context loading failed (loadContext error)   |
| ERROR_AUTH     | Terminal auth error present                  |

State values are defined in `AuthStateStatus` and reused everywhere. State data lives inside the state object to enforce correctness at the type level.

## Event Model (Normalized)

Internal machine events (not raw SDK events):

- START
- SESSION_FOUND
- NO_SESSION
- SIGNED_OUT
- CONTEXT_LOADED (user data + AsyncStorage context loaded)
- ERROR (with error type: CHECKING, CONTEXT, or AUTH)

Adapters translate external SDK signals into these events. All [Supabase auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) are handled explicitly:

- `INITIAL_SESSION`, `SIGNED_IN` → SESSION_FOUND or NO_SESSION
- `SIGNED_OUT` → SIGNED_OUT
- `TOKEN_REFRESHED` → no-op (no state transition)
- `USER_UPDATED` → SESSION_FOUND (triggers context reload)
- `PASSWORD_RECOVERY` → SESSION_FOUND (recovery flow driven by URL/context from loadContext)
- Unknown events → warning logged

## How Supamachine Replaces AuthContext

### Typical Pattern

A large AuthContext providing:

- session
- loading
- auth methods
- profile logic

### Supamachine Pattern

- Supabase handles actions (sign in/out)
- Supamachine owns state truth
- UI reads `auth.status` only

Example:

```
const auth = useSupamachine()

switch (auth.appState.status) {
  case AuthStateStatus.AUTH_READY:
    return <MainApp />
  case AuthStateStatus.SIGNED_OUT:
    return <AuthStack />
  case AuthStateStatus.CHECKING:
    return <Splash />
}
```

## Provider Integration (e.g. Expo app)

```
<SupamachineProvider
  supabase={supabase}
  loadContext={loadContext}           // required: loads user data + app context (AsyncStorage, etc.)
  deriveAppState={deriveAppState}     // optional: pure function that derives app-specific states
  initializeApp={initializeApp}       // optional: side effects run after AUTH_READY (e.g. postLogin)
  contextUpdaters={[deepLinkUpdater]} // optional: listeners for context changes (deep links, etc.)
  options={{ logLevel: 'warn' }}      // optional: 'none' | 'error' | 'warn' | 'info' | 'debug'
>
  <App />
</SupamachineProvider>
```

Hook usage:

```
const auth = useSupamachine()
```

## What the Developer Must Provide

Required:

- A configured Supabase client
- `loadContext(session)` function: `(session: SessionLike | null) => Promise<LoadContextResult>`
  - Called with `session` when signed in, `null` when signed out (so it can load AsyncStorage, deep links, etc. in both cases)
  - Returns `{ userData?, context? }`; `userData` for signed-in (profile), `context` for both (AsyncStorage, deep links)

Optional:

- `deriveAppState(coreState, context)` pure function that runs on every core state transition, returns `AppState` (string)
- `initializeApp(ctx)` runs after AUTH_READY transition, allows side effects (wrapped in timeout)
- `contextUpdaters`: Array of `(coreState, currentContext) => AppContext | Promise<AppContext>` — receive coreState and can update context

**Important**: `loadContext` must not use try-catch. Failures transition to `ERROR_CONTEXT`. Both `loadContext` and `initializeApp` are wrapped in timeouts at the core level.

Supamachine does NOT:

- Create Supabase clients
- Replace auth methods
- Control navigation or UI

## Derived App State

This is a mechanism to afford custom application state logic, such as "the user has a session but hasn't set their password yet."

`deriveAppState` must be a **pure, synchronous function** with **no side effects**. It receives the current core state and context, and returns an app-specific state.

`deriveAppState` runs on **every core state transition**, allowing the app to derive states like:

- `NEEDS_PASSWORD` (when `passwordSet === false`)
- `NEEDS_ONBOARDING` (when `onboarded === false`)
- `ACCOUNT_DELETED` (when `profile.deleted_at` exists)
- `PENDING_VERIFICATION` (when `PENDING_SIGNUP_EMAIL_KEY` in context)
- `APP_READY` (when all checks pass)

The app reads `auth.appState` (the final user-consumed state, type `string`). `appState` is **purely derived** — never mutable. When `deriveAppState` is unspecified, `appState` equals `coreState.status`. The public API exposes `coreState` (internal machine state) and `appState` (string, used for navigation and rendering).

## Supamachine lifecycle

```
START
  ↓
CHECKING (getSession with timeout)
  ↓
SIGNED_OUT  or SIGNED_IN
                  ↓
               CONTEXT_LOADING (loadContext with timeout)
                  ↓
               AUTH_READY  ← invariants satisfied (session + user + context)
                  ↓
               INITIALIZING (initializeApp runs with timeout)
                  ↓
               [App uses deriveAppState for app-specific states]
```

**Error paths**:

- `CHECKING` → `ERROR_CHECKING` (if getSession times out or fails)
- `CONTEXT_LOADING` → `ERROR_CONTEXT` (if loadContext fails or times out)
- Any other core state → `ERROR_AUTH` (if any other part of the core auth machine fails)

## Dependency Strategy

Peer Dependencies:

- react
- @supabase/supabase-js

Reason:  
The consuming app must own identity-bearing dependencies (React and the Supabase client).  
Supamachine observes them instead of installing duplicates.

## Local Development Workflow

### 1. Initialize Library Repo

```
~/Documents/supamachine
git init
pnpm install
```

### 2. Run Watch Build

```
pnpm dev   # tsc --watch
```

This continuously outputs compiled files to `dist/`.

### 3. Link Into PhotoPhlo

```
cd supamachine
pnpm link --global

cd my-app
pnpm link --global @inventbuild/supamachine
```

Important:

- No need to modify my-app's package.json
- Enables live editing of the library

Run two terminals:

- Terminal A (supamachine): `pnpm dev`
- Terminal B (my-app): e.g. `expo start`

## Build Process

During development:

- Use `tsc --watch`
- Do not manually rebuild on every change

Before release:

```
pnpm build
```

Outputs:

- dist/index.js
- dist/\*.d.ts

## Versioning (SemVer Guidance)

Format: MAJOR.MINOR.PATCH

While pre-1.0:

- Use 0.x.y
- Minor bumps may include breaking changes

Critical rule for Supamachine:
Changing state meanings or invariants = MAJOR change (future 1.x).

Examples:

- Bug fix → PATCH
- New optional feature → MINOR
- Changing READY guarantees → MAJOR

## Publishing to NPM (Future)

Use package name: `@inventbuild/supamachine`

Steps:

1. Ensure clean build (`pnpm build`)
2. Confirm `main` and `types` point to `dist/`
3. Add README + license
4. Publish:

```
npm publish --access public
```

Then install in apps:

```
pnpm add @inventbuild/supamachine
```

To switch from a linked dev version:

```
cd my-app
pnpm unlink --global @inventbuild/supamachine
pnpm add @inventbuild/supamachine
```

## Long-Term Design Principles

- Afford any scenario a real-world user might need
- Determinism over abstraction
- Invariants over boolean flags
- Supabase correctness over premature generalization
- Small, stable public API surface
- Pure core + thin adapters
- Dogfood in real apps before expanding scope

## One-Sentence Summary

Supamachine is a deterministic, Supabase-native authentication state machine that centralizes authentication truth, enforces strong invariants, and cleanly separates async auth complexity from application UI and navigation logic.
