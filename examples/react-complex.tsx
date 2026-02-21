// This example demonstrates Supamachine with initializeApp, updateContext and options.
// @ts-nocheck

import {
  SupamachineProvider,
  useSupamachine,
  AuthStateStatus,
} from "supamachine";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type MyContext = {
  userData: { name: string; email: string; onboardingComplete?: boolean };
};

type MyAppState =
  | { status: "MAIN_APP"; session: Session; context: MyContext }
  | { status: "NEEDS_ONBOARDING"; session: Session; context: MyContext };

async function loadContext(session: Session): Promise<MyContext> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return { userData: data };
}

function mapState(snapshot: {
  status: typeof AuthStateStatus.AUTH_READY;
  session: Session;
  context: MyContext | null;
}): MyAppState {
  const ctx = snapshot.context;
  if (ctx?.userData?.onboardingComplete) {
    return {
      status: "MAIN_APP",
      session: snapshot.session,
      context: ctx,
    };
  }
  return {
    status: "NEEDS_ONBOARDING",
    session: snapshot.session,
    context: ctx!,
  };
}

function AuthSwitch() {
  const { state } = useSupamachine<MyContext, MyAppState>();

  switch (state.status) {
    case AuthStateStatus.CHECKING:
    case AuthStateStatus.CONTEXT_LOADING:
      return <Loading />;
    case AuthStateStatus.SIGNED_OUT:
      return <Login />;
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
      initializeApp={({ session, context }) => {
        console.log("App initialized", session.user.email, context);
      }}
      mapState={mapState}
      options={{ logLevel: "debug" }}
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
function Home({ session }: { session: Session }) {
  return <div>Home: {session.user.email}</div>;
}
