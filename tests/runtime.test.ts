import { describe, it, expect, vi } from "vitest";
import { SupamachineCore } from "../src/core/runtime";
import {
  AuthEventType as E,
  AuthStateStatus as S,
} from "../src/core/constants";
import type { Session } from "@supabase/supabase-js";

const session = { user: { id: "u1" } } as Session;

describe("SupamachineCore", () => {
  it("full happy path: START → AUTH_READY", async () => {
    const loadContext = vi.fn().mockResolvedValue({ role: "admin" });
    const initializeApp = vi.fn().mockResolvedValue(undefined);

    const core = new SupamachineCore({
      loadContext,
      initializeApp,
      logLevel: 0,
    });

    core.dispatch({ type: E.START });
    expect(core.getSnapshot().status).toBe(S.CHECKING);

    core.dispatch({ type: E.AUTH_CHANGED, session });
    expect(core.getSnapshot().status).toBe(S.CONTEXT_LOADING);

    await vi.waitFor(() => {
      expect(core.getSnapshot().status).toBe(S.AUTH_READY);
    });

    expect(loadContext).toHaveBeenCalledWith(session);
    expect(initializeApp).toHaveBeenCalled();
  });

  it("loadContext failure → ERROR_CONTEXT", async () => {
    const core = new SupamachineCore({
      loadContext: () => Promise.reject(new Error("db down")),
      logLevel: 0,
    });

    core.dispatch({ type: E.START });
    core.dispatch({ type: E.AUTH_CHANGED, session });

    await vi.waitFor(() => {
      expect(core.getSnapshot().status).toBe(S.ERROR_CONTEXT);
    });
  });

  it("no loadContext, with initializeApp → AUTH_READY", async () => {
    const initializeApp = vi.fn().mockResolvedValue(undefined);
    const core = new SupamachineCore({ initializeApp, logLevel: 0 });

    core.dispatch({ type: E.START });
    core.dispatch({ type: E.AUTH_CHANGED, session });

    await vi.waitFor(() => {
      expect(core.getSnapshot().status).toBe(S.AUTH_READY);
    });

    expect(initializeApp).toHaveBeenCalled();
  });

  it("mapState transitions to custom state", async () => {
    const core = new SupamachineCore({
      mapState: (snap) => ({ status: "DASHBOARD" as const }),
      initializeApp: async () => {},
      logLevel: 0,
    });

    core.dispatch({ type: E.START });
    core.dispatch({ type: E.AUTH_CHANGED, session });

    await vi.waitFor(() => {
      expect(core.getSnapshot().status).toBe(S.AUTH_READY);
    });

    const appState = core.getAppState();
    expect(appState.status).toBe("DASHBOARD");
  });

  it("updateContext replaces context and notifies subscribers", async () => {
    const core = new SupamachineCore({
      loadContext: async () => ({ count: 0 }),
      initializeApp: async () => {},
      logLevel: 0,
    });

    core.dispatch({ type: E.START });
    core.dispatch({ type: E.AUTH_CHANGED, session });

    await vi.waitFor(() => {
      expect(core.getSnapshot().status).toBe(S.AUTH_READY);
    });

    const spy = vi.fn();
    core.subscribe(spy);

    await core.updateContext((c) => ({ ...c, count: 1 }));

    expect(spy).toHaveBeenCalled();
    const snap = core.getSnapshot();
    expect(snap.status).toBe(S.AUTH_READY);
    if (snap.status === S.AUTH_READY) {
      expect(snap.context).toEqual({ count: 1 });
    }
  });
});
