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
  | { status: "NEEDS_VERIFICATION" }
  | { status: "NEEDS_PASSWORD" }
  | { status: "NEEDS_ONBOARDING" }
  | { status: "APP_READY" };

async function loadContext(session: Session): Promise<MyContext> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;

  const stored =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("someLocalState")
      : null;
  const { emailVerified, passwordSet, onboardingComplete } = (
    stored ? JSON.parse(stored) : {}
  ) as Partial<MyContext["userData"]>;

  return {
    userData: { ...data, emailVerified, passwordSet, onboardingComplete },
  };
}

function mapState(snapshot: {
  status: typeof AuthStateStatus.AUTH_READY;
  session: Session;
  context: MyContext;
}): MyAppState {
  const ctx = snapshot.context;
  const { emailVerified, passwordSet, onboardingComplete } = ctx.userData ?? {};

  if (!emailVerified) return { status: "NEEDS_VERIFICATION" };
  if (!passwordSet) return { status: "NEEDS_PASSWORD" };
  if (!onboardingComplete) return { status: "NEEDS_ONBOARDING" };
  return { status: "APP_READY" };
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
      return <Onboarding />;
    case "APP_READY":
      return <Home />;
    default:
      return <Loading />;
  }
}

function Onboarding() {
  const { state, updateContext } = useSupamachine<MyContext, MyAppState>();

  const complete = () => {
    updateContext((ctx) => ({
      ...ctx,
      userData: { ...ctx.userData, onboardingComplete: true },
    }));
  };

  const name = state.context?.userData?.name ?? state.context?.userData?.email ?? "there";

  return (
    <div>
      <p>Hi {name}, complete onboarding to continue.</p>
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
  const { state } = useSupamachine<MyContext, MyAppState>();
  const email = state.context?.userData?.email;
  return (
    <div>
      Verify your email{email ? ` (${email})` : ""}.
    </div>
  );
}
function SetPassword() {
  return <div>Set your password</div>;
}
function Home() {
  const { state } = useSupamachine<MyContext, MyAppState>();
  const session = "session" in state ? state.session : null;
  const name = state.context?.userData?.name ?? state.context?.userData?.email ?? session?.user?.email;
  return <div>Home: {name}</div>;
}
