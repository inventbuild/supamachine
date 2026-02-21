// This example demonstrates the simplest possible Supamachine setup.

import {
  SupamachineProvider,
  useSupamachine,
  AuthStateStatus,
} from "@inventbuild/supamachine";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type MyContext = {
  userData: {
    name: string;
    email: string;
  };
};

function Loading() {
  return <div>Loading...</div>;
}
function Login() {
  return <div>Login</div>;
}
function Home({ session }: { session: Session }) {
  return <div>Home: {session.user.email}</div>;
}

function AuthSwitch() {
  const { state } = useSupamachine<MyContext>();

  switch (state.status) {
    case AuthStateStatus.CHECKING:
    case AuthStateStatus.CONTEXT_LOADING:
      return <Loading />;
    case AuthStateStatus.SIGNED_OUT:
      return <Login />;
    case AuthStateStatus.AUTH_READY:
      return <Home session={state.session} />;
    default:
      return null;
  }
}

export function App() {
  return (
    <SupamachineProvider<MyContext>
      supabase={supabase}
      loadContext={async (session) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session?.user.id)
          .single();
        if (error) {
          throw error;
        }
        return {
          userData: data,
        };
      }}
    >
      <AuthSwitch />
    </SupamachineProvider>
  );
}
