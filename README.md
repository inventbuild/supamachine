# Supamachine

A deterministic authentication state machine for Supabase web and mobile apps.

This is an early-stage library designed to make authentication easier and way less error-prone, especially as your app grows in complexity.

## Overview

Does this kind of auth code look familiar to you?

```ts
const {
  data: { subscription },
} = supabase.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
    setLoading(false);
  }
  if (session) {
    setSession(session);
  } else {
    setSession(null);
  }
  ...and so much more of this
});
```

**THERE'S GOT TO BE A BETTER WAY!**

Supamachine models auth as an explicit state machine with clear states (CHECKING, SIGNED_OUT, CONTEXT_LOADING, INITIALIZING, AUTH_READY, plus error states) and allows you to derive custom app states via `mapState`.

## Real-World Benefits

When I moved a client project from my original AuthContext to Supamachine, Supamachine turned ~300 lines of lifecycle orchestration (session management, auth state changes, post-login flow, navigation decisions) into ~50 lines of configuration (loadContext, initializeApp, mapState).

## Usage

`pnpm add @inventbuild/supamachine`

### Basic setup

```tsx
import {
  SupamachineProvider,
  useSupamachine,
  AuthStateStatus,
} from "@inventbuild/supamachine";

type MyContext = { userData: { name: string } };
type MyAppState = { status: "MAIN_APP"; session: Session; context: MyContext };

return (
  <SupamachineProvider<MyContext, MyAppState>
    supabase={supabase}
    loadContext={async (session) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      return { userData: data };
    }}
    mapState={(snapshot) => ({
      status: "MAIN_APP",
      session: snapshot.session,
      context: snapshot.context!,
    })}
  >
    <App />
  </SupamachineProvider>
);

function App() {
  const { state, updateContext } = useSupamachine<MyContext, MyAppState>();

  switch (state.status) {
    case AuthStateStatus.CHECKING_SESSION:
    case AuthStateStatus.CONTEXT_LOADING:
      return <Loading />;
    case AuthStateStatus.SIGNED_OUT:
      return <Login />;
    case "MAIN_APP":
      return <Home session={state.session} />;
    default:
      return <Loading />;
  }
}
```

### Provider API

- **supabase** (required) – Supabase client instance
- **loadContext(session)** – Optional. Fetches app context (e.g. user profile) after auth
- **initializeApp({ session, context })** – Optional. Side effects after context is loaded (e.g. set avatar)
- **mapState(snapshot)** – Optional. Maps the internal AUTH_READY state to your custom app states
- **actions** – Optional. Auth actions (signIn, signOut, etc.) to expose via `useSupamachine()`. Merged with a default `signOut` so you always have `actions.signOut()` available.
- **options** – Optional. `logLevel`, `getSessionTimeoutMs`, `loadContextTimeoutMs`, `initializeAppTimeoutMs`

### actions

This is an optional convenience for your imperative Supabase auth methods, like signInWith... and signOut, etc. Pass your auth actions to the provider; they're exposed via `useSupamachine().actions`. Since Supamachine responds to Supabase events, you don't need to use updateContext. A default `signOut` is included since it's simple (but can be overriden). Example usage:

```tsx
<SupamachineProvider
  supabase={supabase}
  actions={{
    signOut: () => supabase.auth.signOut(),
    signInWithOtp: (email) => supabase.auth.signInWithOtp({ email }),
    signInWithGoogle: () => { /* platform-specific */ },
  }}
>
```

```ts
const { state, actions } = useSupamachine();
actions.signOut();
actions.signInWithOtp("user@example.com");
```

If you omit `actions`, you still get `actions.signOut()` from the default.

### updateContext

Use `updateContext` to imperatively update context and trigger a re-run of `mapState`:

```ts
const { updateContext } = useSupamachine();
updateContext((current) => ({
  ...current,
  userData: { ...current.userData, onboardingComplete: true },
}));
```

### refreshContext

`refreshContext(session)` re-runs `loadContext` with a new session, updates context and session in place, re-runs `mapState`, and emits—without leaving AUTH_READY. The adapter uses it automatically for `USER_UPDATED` so metadata changes (e.g. from `updateUser`) don't trigger a full reload. Exposed via `useSupamachine()` if you need to call it manually.

## Philosophy

Handling auth in your app is all about _states._ Supamachine explicitly defines every possible state (CHECKING_SESSION, SIGNED_OUT, CONTEXT_LOADING, INITIALIZING, AUTH_READY, plus error states) and lets you extend with custom states via `mapState`. By capturing all states and transitions, edge cases are handled deterministically.
