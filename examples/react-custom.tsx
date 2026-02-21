// This example demonstrates Supamachine with your own custom app states.
// @ts-nocheck

import { SupamachineProvider, useSupamachine } from "supamachine/react";
import type { AuthState } from "supamachine";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

// Your custom app states
type AppState =
  | AuthState
  | { status: "NEEDS_VERIFICATION"; context: null }
  | { status: "NEEDS_PASSWORD"; context: null }
  | { status: "NEEDS_ONBOARDING"; context: null }
  | { status: "APP_READY"; context: null };

async function loadContext(session: Session): Promise<LoadContextResult> {
  if (!session) return undefined;

  // Fetch profile
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session?.user.id)
    .single();
  if (error) {
    throw error;
  }

  return {
    user: data,
  };
}

function mapState(
  coreState: AuthState,
  context: AppContext,
  userData: UserData,
): AppState {
  const { emailVerified, passwordSet, onboardingComplete } = context ?? {};

  switch (coreState.status) {
    case "SIGNED_IN":
      if (!userData?.emailVerified) {
        return { status: "NEEDS_VERIFICATION", context: context };
      }
      if (!userData?.passwordSet) {
        return { status: "NEEDS_PASSWORD", context: context };
      }
      if (!userData?.onboardingComplete) {
        return { status: "NEEDS_ONBOARDING", context: context };
      }
      return { status: "APP_READY", context: context };

    default:
      return coreState;
  }
}

function AuthSwitch() {
  const { state } = useSupamachine(); // state: AppState

  switch (state.status) {
    case "CHECKING":
      return <Loading />;

    case "SIGNED_OUT":
      return <Login />;

    // Note that we don't handle "SIGNED_OUT" because it's replaced in mapState()

    case "UNVERIFIED":
      return <VerifyEmail />;

    case "NO_PASSWORD":
      return <SetPassword />;

    case "ONBOARDING":
      return <Onboarding />;

    case "READY":
      return <Home user={state.user} />;

    default:
      return null;
  }
}

export function App() {
  return (
    <SupamachineProvider<AppState>
      supabase={supabase}
      loadContext={loadContext}
      mapState={mapState}
    >
      <AuthSwitch />
    </SupamachineProvider>
  );
}
