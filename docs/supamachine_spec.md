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

- READY: session, user and profile are guaranteed present
- SIGNED_OUT: no valid session exists

## Intentional Scope

### Supabase-Specific (v1)

Supamachine is deliberately designed around Supabase Auth:

- Uses `getSession()`
- Uses `onAuthStateChange`
- Assumes client-side session persistence
- Supports async profile hydration

Not goals (v1):

- Generic multi-provider auth abstraction
- Replacing Supabase auth APIs
- Being a general FSM framework

Future adapters are possible, but not a current design target.

---

## High-Level Architecture

Supabase SDK → Supamachine Core → App UI / Navigation

Supabase emits events.  
Supamachine determines truth.  
The app reads stable state.

---

## Layered Package Structure

```
supamachine/
├─ src/
│  ├─ core/        # Pure state machine (no React, no Supabase)
│  ├─ supabase/    # Adapter that translates SDK events
│  ├─ react/       # Provider + hooks (DX layer)
│  └─ index.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

Key rule: The core layer must remain framework-agnostic and side-effect minimal.

---

## Core State Model (Recommended v1)

States:

- INIT
- CHECKING
- SIGNED_OUT
- SIGNED_IN
- READY
- ERROR

### State Invariants

| State      | Guaranteed Truth                  |
| ---------- | --------------------------------- |
| INIT       | Machine not started               |
| CHECKING   | Session resolution in progress    |
| SIGNED_OUT | No session                        |
| SIGNED_IN  | Valid session + user              |
| READY      | Session + user + hydrated profile |
| ERROR      | Terminal error present            |

State data should live inside the state object to enforce correctness at the type level.

---

## Event Model (Normalized)

Internal machine events (not raw SDK events):

- START
- SESSION_FOUND
- NO_SESSION
- SIGNED_OUT
- PROFILE_LOADED
- ERROR

Adapters translate external SDK signals into these events.

---

## How Supamachine Replaces AuthContext

### Typical Current Pattern

A large AuthContext providing:

- session
- loading
- auth methods
- profile logic
- edge-case guards

### Supamachine Pattern

- Supabase handles actions (sign in/out)
- Supamachine owns state truth
- UI reads `auth.status` only

Example:

```
const auth = useSupamachine()

switch (auth.status) {
  case 'READY':
    return <MainApp />
  case 'SIGNED_OUT':
    return <AuthStack />
  case 'CHECKING':
    return <Splash />
}
```

No boolean inference required.

---

## Provider Integration (Expo / PhotoPhlo)

```
<SupamachineProvider
  supabase={supabase}
  loadProfile={loadProfile}
>
  <App />
</SupamachineProvider>
```

Hook usage:

```
const auth = useSupamachine()
```

---

## What the Developer Must Provide

Required:

- A configured Supabase client

Recommended:

- `loadProfile(userId)` function for profile hydration

Supamachine does NOT:

- Create Supabase clients
- Replace auth methods
- Control navigation or UI

---

## Dependency Strategy

Peer Dependencies:

- react
- @supabase/supabase-js

Reason:  
The consuming app must own identity-bearing dependencies (React and the Supabase client).  
Supamachine observes them instead of installing duplicates.

---

## Local Development Workflow

### 1. Create Library Repo

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

cd photophlo
pnpm link --global @inventbuild/supamachine
```

Important:

- This does NOT modify PhotoPhlo package.json
- Enables live editing of the library

Run two terminals:

- Terminal A: `pnpm dev` (supamachine)
- Terminal B: `expo start` (PhotoPhlo)

If Metro cache misbehaves:

```
expo start -c
```

---

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

---

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

---

## Publishing to NPM (Future)

Recommended package name:
`@inventbuild/supamachine`

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
pnpm unlink --global @inventbuild/supamachine
pnpm add @inventbuild/supamachine
```

---

## Long-Term Design Principles

- Determinism over abstraction
- Invariants over boolean flags
- Supabase correctness over premature generalization
- Small, stable public API surface
- Pure core + thin adapters
- Dogfood in real apps before expanding scope

---

## One-Sentence Summary

Supamachine is a deterministic, Supabase-native auth state machine that centralizes authentication truth, enforces strong invariants, and cleanly separates async auth complexity from application UI and navigation logic.
