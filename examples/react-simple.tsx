// This example demonstrates the simplest possible Supamachine setup.
// @ts-nocheck

import { SupamachineProvider, useSupamachine } from "supamachine/react";
import type { User, Session } from "@supabase/supabase-js";
import { AuthStateStatus } from "supamachine/core/constants";
import { supabase } from "./supabaseClient";

type MyContext = {
  userData: {
    name: string;
    email: string;
  };
};

function AuthSwitch() {
  const { state } = useSupamachine<MyContext>();

  switch (state.status) {
    case AuthStateStatus.CHECKING:
    case AuthStateStatus.CONTEXT_LOADING:
      return <Loading />;
    case AuthStateStatus.SIGNED_OUT:
      return <Login />;
    case AuthStateStatus.AUTH_READY:
      return <Home user={state.user} />;
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

function Loading() {
  return <div>Loading...</div>;
}
function Login() {
  return <div>Login</div>;
}
function Home({ session }: { session: Session }) {
  return <div>Home: {session.user.email}</div>;
}
