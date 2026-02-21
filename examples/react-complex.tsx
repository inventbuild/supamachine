/**
 * Complex example: subscription-gated app with onboarding.
 *
 * Demonstrates:
 * - loadContext (fetch userProfile, subscriptionStatus, onboardingComplete)
 * - initializeApp (analytics, register fake realtime listener - side effects only, no context updates)
 * - mapState (derives NEEDS_VERIFICATION | NEEDS_PASSWORD | NEEDS_ONBOARDING | NEEDS_SUBSCRIPTION | MAIN_APP)
 * - updateContext (used imperatively in components: UI buttons + subscription expiration timer in MainApp)
 */

import React from "react";
import {
  SupamachineProvider,
  useSupamachine,
  AuthStateStatus,
} from "@inventbuild/supamachine";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

// ---------------------------------------------------------------------------
// Context: what loadContext fetches
// ---------------------------------------------------------------------------

type AppContext = {
  userData: {
    email: string;
    name: string;
  };
  emailVerified: boolean;
  passwordSet: boolean;
  onboardingComplete: boolean;
  subscriptionActive: boolean;
};

// ---------------------------------------------------------------------------
// Custom derived states
// ---------------------------------------------------------------------------

type MyAppState =
  | { status: "NEEDS_VERIFICATION" }
  | { status: "NEEDS_PASSWORD" }
  | { status: "NEEDS_ONBOARDING" }
  | { status: "NEEDS_SUBSCRIPTION" }
  | { status: "APP_READY" };

// ---------------------------------------------------------------------------
// loadContext
// ---------------------------------------------------------------------------

async function loadContext(session: Session): Promise<AppContext> {
  // Simulate fetching user profile + subscription from backend
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  // Override with client-side state (e.g. feature flags, cached prefs)
  const stored =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("complexExampleState")
      : null;
  const overrides = stored ? (JSON.parse(stored) as Partial<AppContext>) : {};

  return {
    userData: data,
    emailVerified: overrides.emailVerified ?? false,
    passwordSet: overrides.passwordSet ?? false,
    onboardingComplete: overrides.onboardingComplete ?? false,
    subscriptionActive: overrides.subscriptionActive ?? false,
  };
}

// ---------------------------------------------------------------------------
// mapState: derive in order
// ---------------------------------------------------------------------------

function mapState(snapshot: { status: string; session: Session; context: AppContext }): MyAppState {
  const { context: ctx } = snapshot;

  if (!ctx.emailVerified) return { status: "NEEDS_VERIFICATION" };
  if (!ctx.passwordSet) return { status: "NEEDS_PASSWORD" };
  if (!ctx.onboardingComplete) return { status: "NEEDS_ONBOARDING" };
  if (!ctx.subscriptionActive) return { status: "NEEDS_SUBSCRIPTION" };
  return { status: "APP_READY" };
}

// ---------------------------------------------------------------------------
// initializeApp: side effects only (analytics, register listeners). No context updates.
// ---------------------------------------------------------------------------

function initializeApp({
  session,
  context,
}: {
  session: Session;
  context: AppContext;
}) {
  console.log(
    "[initializeApp] Analytics: user_ready",
    session.user.email,
    context,
  );
  console.log("[initializeApp] Fake realtime subscription listener registered");
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function StatusBar({ status }: { status: string }) {
  return (
    <div style={{ padding: 8, background: "#eee", marginBottom: 16 }}>
      <strong>state.status</strong>: <code>{status}</code>
    </div>
  );
}

function Loading() {
  return (
    <div>
      <StatusBar status="CHECKING / CONTEXT_LOADING" />
      <p>Loading...</p>
    </div>
  );
}

function Login() {
  return (
    <div>
      <StatusBar status="SIGNED_OUT" />
      <p>Please sign in.</p>
    </div>
  );
}

function NeedsVerification() {
  const { updateContext } = useSupamachine<AppContext, MyAppState>();

  const verify = () => {
    updateContext((ctx) => ({ ...ctx, emailVerified: true }));
  };

  return (
    <div>
      <StatusBar status="NEEDS_VERIFICATION" />
      <p>Verify your email.</p>
      <button onClick={verify}>Mark email verified</button>
    </div>
  );
}

function NeedsPassword() {
  const { updateContext } = useSupamachine<AppContext, MyAppState>();

  const setPassword = () => {
    updateContext((ctx) => ({ ...ctx, passwordSet: true }));
  };

  return (
    <div>
      <StatusBar status="NEEDS_PASSWORD" />
      <p>Set your password.</p>
      <button onClick={setPassword}>Mark password set</button>
    </div>
  );
}

function NeedsOnboarding() {
  const { updateContext } = useSupamachine<AppContext, MyAppState>();

  const complete = () => {
    updateContext((ctx) => ({ ...ctx, onboardingComplete: true }));
  };

  return (
    <div>
      <StatusBar status="NEEDS_ONBOARDING" />
      <p>Complete onboarding.</p>
      <button onClick={complete}>Complete onboarding</button>
    </div>
  );
}

function NeedsSubscription() {
  const { updateContext } = useSupamachine<AppContext, MyAppState>();

  const activate = () => {
    updateContext((ctx) => ({ ...ctx, subscriptionActive: true }));
  };

  return (
    <div>
      <StatusBar status="NEEDS_SUBSCRIPTION" />
      <p>Active subscription required.</p>
      <button onClick={activate}>Activate subscription</button>
    </div>
  );
}

function MainApp() {
  const { state, updateContext } = useSupamachine<AppContext, MyAppState>();
  const session = state.status === "APP_READY" ? state.session : null;

  // Subscription expiration: imperatively via updateContext in a component.
  // (initializeApp is for side effects only; context updates happen here.)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      console.log("[MainApp] Subscription expired (5s timer)");
      updateContext((ctx) => ({ ...ctx, subscriptionActive: false }));
    }, 5000);
    return () => clearTimeout(timer);
  }, [updateContext]);

  const expireSubscription = () => {
    updateContext((ctx) => ({ ...ctx, subscriptionActive: false }));
  };

  return (
    <div>
      <StatusBar status="APP_READY" />
      <p>Welcome! Full access. Session: {session?.user.email}</p>
      <button onClick={expireSubscription}>
        Simulate subscription expiration
      </button>
    </div>
  );
}

function AuthSwitch() {
  const { state } = useSupamachine<AppContext, MyAppState>();

  switch (state.status) {
    case AuthStateStatus.CHECKING:
    case AuthStateStatus.CONTEXT_LOADING:
    case AuthStateStatus.INITIALIZING:
      return <Loading />;
    case AuthStateStatus.SIGNED_OUT:
      return <Login />;
    case "NEEDS_VERIFICATION":
      return <NeedsVerification />;
    case "NEEDS_PASSWORD":
      return <NeedsPassword />;
    case "NEEDS_ONBOARDING":
      return <NeedsOnboarding />;
    case "NEEDS_SUBSCRIPTION":
      return <NeedsSubscription />;
    case "APP_READY":
      return <MainApp />;
    default:
      return <Loading />;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  return (
    <SupamachineProvider<AppContext, MyAppState>
      supabase={supabase}
      loadContext={loadContext}
      initializeApp={initializeApp}
      mapState={mapState}
      options={{ logLevel: "debug" }}
    >
      <AuthSwitch />
    </SupamachineProvider>
  );
}
