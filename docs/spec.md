# New simple spec

## States

### Core States

| State              | Guaranteed Truth                 |
| ------------------ | -------------------------------- |
| START              | Machine not started              |
| CHECKING           | Session resolution in progress   |
| ERROR_CHECKING     | Error checking Supabase Auth SDK |
| SIGNED_OUT         | No session                       |
| CONTEXT_LOADING    | Running loadContext()            |
| ERROR_CONTEXT      | Error running loadContext()      |
| INITIALIZING       | Running initializeApp()          |
| ERROR_INITIALIZING | Error running initializeApp()    |
| APP_READY          | Session + optional context       |

### Custom States

Instead structure types like this:

```ts
type CoreState =
  | { status: "SIGNED_OUT" }
  | { status: "CHECKING" }
  | { status: "CONTEXT_LOADING" }
  | { status: "INITIALIZING" }
  | { status: "APP_READY"; session: Session; context: C }
  | { status: "ERROR_*"; error: Error };
```

The developer defines:

```ts
type MyCustomState =
  | { status: "NEEDS_PASSWORD" }
  | { status: "NEEDS_ONBOARDING" }
  | { status: "MAIN_APP" };
```

Supamachine exports the public state as:

```ts
type AppState = Exclude<CoreState, { status: "APP_READY" }> | MyCustomState;
```

Now mapState has this signature:

```ts
function mapState(
  state: Extract<CoreLifecycleState, { status: "APP_READY" }>,
): AppState;
```

Internally, `mapState` can be bypassed entirely to ensure that custom states are only derived when the core state is ready:

```ts
if (core.status !== "APP_READY") {
  return core;
}

return mapState(core);
```

## API

`<SupamachineProvider<AppState, AppContext>>`

### `supabase`

(Required) Supabase client SDK instance

### `loadContext(session: Session) => AppContext`

(Optional) a pure function that retrieves any data desired for using the app, such as user profile data. `AppContext` type is defined by developer and passed to `SupamachineProvider`.

### `initializeApp(session: Session, context?: Context) => void`

(Optional) a function for side effects to be run after the user has been logged in (`coreState === SIGNED_IN`), such as setting the user's avatar. Does not have a return value, as anything that modifies context should use either `loadContext` or `updateContext`.

### `mapState(state: CoreState, session: Session, context: Context) => AppState`

(Optional) a pure function that allows the developer to output custom states dependent on app context. `AppState` type is defined by developer and passed to `SupamachineProvider`.

### `updateContext((current: AppContext) => AppContext)`

A method on `supamachine` that allows the developer to imperatively update `AppContext`.

```ts
// within <SupamachineProvider>
const MyComponent() => {
    const supamachine = useSupamachine();
    ...
    supamachine.updateContext((currentContext: AppContext) => {
        return {
            someKey: newValue,
            ...currentContext
        }
    });
}
```

## Use-Cases

### User completes onboarding step

Inside a screen:

```ts
supamachine.updateContext((ctx) => ({
  ...ctx,
  userData: {
    ...ctx.userData,
    onboardingComplete: true,
  },
}));
```

This immediately re-runs `mapState`, moving from `NEEDS_ONBOARDING` → `APP_READY`.

### Notification handling (warm and cold)

**Cold start:**

Check for notification taps in `loadContext()`:

```ts
async function loadContext(session) {
  const [userData, initialUrl, notificationUrl] = await Promise.all([
    fetchUserData(session),
    Linking.getInitialURL(),
    getInitialNotificationUrl(),
  ]);

  return {
    userData,
    initialUrl,
    notificationUrl,
  };
}
```

Then route as desired in `mapState()`.

**Warm start:**

Detect notification tap in e.g. `app/index.tsx`:

```ts
useEffect(() => {
  async function checkInitialUrl() {
    const url = await Linking.getInitialURL();
    if (url) {
      supamachine.updateContext((ctx) => ({
        ...ctx,
        initialUrl: url,
      }));
    }
  }

  checkInitialUrl();
}, []);
```

Then route as desired in `mapState()`.

### User Buys Subscription In-App

Flow:

- User completes Stripe Checkout.
- Your backend receives webhook.
- Backend updates DB: subscription_status = active.
- Frontend either polls, gets realtime update or refetches manually

With Supamachine, after user completes purchase, you call:

```ts
supamachine.updateContext((ctx) => ({
  ...ctx,
  subscription: newValue,
}));
```

Now `mapState` might go from `NEEDS_SUBSCRIPTION` → `APP_READY`.
