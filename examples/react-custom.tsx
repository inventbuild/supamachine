// This example demonstrates Supamachine with custom app states.

import {
  SupamachineProvider,
  useSupamachine,
  AuthStateStatus,
} from "@inventbuild/supamachine";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type MyContext = {
  userData: {
    emailVerified?: boolean;
    passwordSet?: boolean;
    onboardingComplete?: boolean;
    name?: string;
    email?: string;
  };
};

type MyAppState =
  | { status: "NEEDS_VERIFICATION"; session: Session; context: MyContext }
  | { status: "NEEDS_PASSWORD"; session: Session; context: MyContext }
  | { status: "NEEDS_ONBOARDING"; session: Session; context: MyContext }
  | { status: "MAIN_APP"; session: Session; context: MyContext };

async function loadContext(session: Session): Promise<MyContext> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return { userData: data ?? {} };
}

function mapState(snapshot: {
  status: typeof AuthStateStatus.AUTH_READY;
  session: Session;
  context: MyContext | null;
}): MyAppState {
  const ctx = snapshot.context ?? { userData: {} };
  const { emailVerified, passwordSet, onboardingComplete } = ctx.userData ?? {};

  if (!emailVerified) {
    return {
      status: "NEEDS_VERIFICATION",
      session: snapshot.session,
      context: ctx,
    };
  }
  if (!passwordSet) {
    return {
      status: "NEEDS_PASSWORD",
      session: snapshot.session,
      context: ctx,
    };
  }
  if (!onboardingComplete) {
    return {
      status: "NEEDS_ONBOARDING",
      session: snapshot.session,
      context: ctx,
    };
  }
  return { status: "MAIN_APP", session: snapshot.session, context: ctx };
}

function AuthSwitch() {
  const { state } = useSupamachine<MyContext, MyAppState>();

  switch (state.status) {
    case AuthStateStatus.CHECKING:
    case AuthStateStatus.CONTEXT_LOADING:
      return <Loading />;
    case AuthStateStatus.SIGNED_OUT:
      return <Login />;
    case "NEEDS_VERIFICATION":
      return <VerifyEmail />;
    case "NEEDS_PASSWORD":
      return <SetPassword />;
    case "NEEDS_ONBOARDING":
      return <Onboarding state={state} />;
    case "MAIN_APP":
      return <Home session={state.session} />;
    default:
      return <Loading />;
  }
}

function Onboarding({
  state,
}: {
  state: { status: "NEEDS_ONBOARDING"; session: Session; context: MyContext };
}) {
  const { updateContext } = useSupamachine<MyContext, MyAppState>();

  const complete = () => {
    updateContext((ctx) => ({
      ...ctx,
      userData: { ...ctx.userData, onboardingComplete: true },
    }));
  };

  return (
    <div>
      Onboarding
      <button onClick={complete}>Complete</button>
    </div>
  );
}

export function App() {
  return (
    <SupamachineProvider<MyContext, MyAppState>
      supabase={supabase}
      loadContext={loadContext}
      mapState={mapState}
    >
      <AuthSwitch />
    </SupamachineProvider>
  );
}

function Loading() {
  return <div>Loading...</div>;
}
function Login() {
  return <div>Login</div>;
}
function VerifyEmail() {
  return <div>Verify your email</div>;
}
function SetPassword() {
  return <div>Set your password</div>;
}
function Home({ session }: { session: Session }) {
  return <div>Home: {session.user.email}</div>;
}
