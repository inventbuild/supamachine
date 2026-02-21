import type { SupamachineCore } from "../core/runtime";
import type { AuthEvent } from "../core/events";
import type { SupabaseClient, AuthChangeEvent } from "@supabase/supabase-js";
import { AuthEventType } from "../core/constants";
import { createLogger, type LogLevel } from "../core/logger";

const DEFAULT_GET_SESSION_TIMEOUT_MS = 10_000;

export function attachSupabase<C, D>(
  core: SupamachineCore<C, D>,
  supabase: SupabaseClient,
  options?: {
    getSessionTimeoutMs?: number;
    logLevel?: LogLevel;
  },
): () => void {
  const timeoutMs = options?.getSessionTimeoutMs ?? DEFAULT_GET_SESSION_TIMEOUT_MS;
  const log = createLogger("adapter", options?.logLevel ?? 2);

  const getSessionPromise = supabase.auth.getSession();
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("getSession timeout")), timeoutMs),
  );

  Promise.race([getSessionPromise, timeoutPromise])
    .then(({ data, error }) => {
      if (error) {
        core.dispatch({
          type: AuthEventType.ERROR_CHECKING,
          error: new Error(error.message),
        });
      } else {
        core.dispatch({
          type: AuthEventType.AUTH_CHANGED,
          session: data.session ?? null,
        });
      }
    })
    .catch((error) => {
      core.dispatch({
        type: AuthEventType.ERROR_CHECKING,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
    switch (event) {
      case "INITIAL_SESSION":
        break;

      case "SIGNED_IN":
      case "USER_UPDATED":
      case "PASSWORD_RECOVERY":
      case "MFA_CHALLENGE_VERIFIED":
        core.dispatch({
          type: AuthEventType.AUTH_CHANGED,
          session: session ?? null,
        });
        break;

      case "SIGNED_OUT":
      case "TOKEN_REFRESHED":
        core.dispatch({
          type: AuthEventType.AUTH_CHANGED,
          session: null,
        });
        break;

      default: {
        const _exhaustive: never = event;
        log.warn(`unhandled auth event: ${event}`);
      }
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}
