# Supamachine

> Warning: under active development

A deterministic authentication state machine for Supabase web and mobile apps.

This is an early-stage library designed to make authentication easier and way less error-prone, especially as your app grows in complexity.

## Overview

Does this kind of auth code look familiar to you?

```
const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    // Sync only: update state immediately so UI can render
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

THERE'S GOT TO BE A BETTER WAY!

Now there is.

I was looking at my Supabase `AuthContext.tsx` in a client project and thought, "This should be a state machine." That night—and I'm not making this up—I actually dreamt about how I'd structure it. And here it is!

## Usage

`pnpm add @inventbuild/supamachine`

### Expo

In your Expo `app/_layout.tsx`:

```
import { SupamachineProvider } from '@inventbuild/supamachine`;

...

return (
  <SupamachineProvider
    supabase={supabase}
    loadProfile={loadProfile}
  >
    <App />
  </SupamachineProvider>
)

```

## Philosophy

Handling auth in your app is all about _states._ Complicated states. States such as "The user's account has been verified but they haven't set a password yet." If you're reading this then you already know how quickly this turns into a big bowl of spaghetti.

What Supamachine does is _explicitly_ and _completely_ define every possible authentication state your app can be in when using Supabase Auth, define transitions between those states, and allow you to do the work you actually want to accomplish such as render conditionally based on auth state in a simple way that is easy to read and easy to reason about.

But most importantly, it's deterministic. By capturing _all_ of these possible states and transitions, you no longer have to worry yourself about the many, many edge cases that crop up in practice and are probably unhandled (or underhandled) in your app. Let Supamachine worry about these for you!
