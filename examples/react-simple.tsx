// This example demonstrates the simplest possible Supamachine setup.
// @ts-nocheck

import { SupamachineProvider, useSupamachine } from "supamachine/react";
import { supabase } from "./supabaseClient";

function AuthSwitch() {
  const { state } = useSupamachine();

  switch (state.status) {
    case "CHECKING":
      return <Loading />;
    case "SIGNED_OUT":
      return <Login />;
    case "SIGNED_IN":
      return <Home user={state.user} />;
    default:
      return null;
  }
}

export function App() {
  return (
    <SupamachineProvider
      supabase={supabase}
      loadContext={async (session) => {
        // get user profile
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
      }}
    >
      <AuthSwitch />
    </SupamachineProvider>
  );
}
