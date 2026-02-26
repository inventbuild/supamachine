import { describe, it, expect, beforeEach } from "vitest";
import { reducer, setReducerLogLevel } from "../src/core/reducer";
import { AuthStateStatus as S, AuthEventType as E } from "../src/core/constants";
import { LogLevel } from "../src/core/logger";
import type { Session } from "@supabase/supabase-js";

const session = { user: { id: "u1" } } as Session;

describe("reducer", () => {
  beforeEach(() => setReducerLogLevel(LogLevel.NONE));

  // --- Happy path ---
  it("START + START → CHECKING_SESSION", () => {
    const next = reducer({ status: S.START, context: null }, { type: E.START });
    expect(next.status).toBe(S.CHECKING_SESSION);
    expect(next).toHaveProperty("context", null);
  });

  it("CHECKING_SESSION + AUTH_CHANGED(session) → CONTEXT_LOADING", () => {
    const next = reducer(
      { status: S.CHECKING_SESSION, context: null },
      { type: E.AUTH_CHANGED, session },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
    expect(next).toHaveProperty("session", session);
  });

  it("CHECKING_SESSION + AUTH_CHANGED(null) → SIGNED_OUT", () => {
    const next = reducer(
      { status: S.CHECKING_SESSION, context: null },
      { type: E.AUTH_CHANGED, session: null },
    );
    expect(next.status).toBe(S.SIGNED_OUT);
  });

  it("CONTEXT_LOADING + CONTEXT_RESOLVED → INITIALIZING", () => {
    const ctx = { role: "admin" };
    const next = reducer(
      { status: S.CONTEXT_LOADING, session, context: null },
      { type: E.CONTEXT_RESOLVED, context: ctx },
    );
    expect(next.status).toBe(S.INITIALIZING);
    expect(next).toHaveProperty("context", ctx);
  });

  it("INITIALIZING + INITIALIZED → AUTH_READY", () => {
    const ctx = { role: "admin" };
    const next = reducer(
      { status: S.INITIALIZING, session, context: ctx },
      { type: E.INITIALIZED },
    );
    expect(next.status).toBe(S.AUTH_READY);
    expect(next).toHaveProperty("session", session);
    expect(next).toHaveProperty("context", ctx);
  });

  // --- Sign-out from any authenticated state ---
  it("AUTH_READY + AUTH_CHANGED(null) → SIGNED_OUT", () => {
    const next = reducer(
      { status: S.AUTH_READY, session, context: {} },
      { type: E.AUTH_CHANGED, session: null },
    );
    expect(next.status).toBe(S.SIGNED_OUT);
  });

  // --- Invalid transitions return state unchanged ---
  it("START + AUTH_CHANGED is invalid → returns same state", () => {
    const state = { status: S.START, context: null } as const;
    const next = reducer(state, { type: E.AUTH_CHANGED, session: null });
    expect(next).toBe(state);
  });

  // --- Error paths ---
  it("CHECKING_SESSION + ERROR_CHECKING_SESSION → ERROR_CHECKING_SESSION with error", () => {
    const err = new Error("network");
    const next = reducer(
      { status: S.CHECKING_SESSION, context: null },
      { type: E.ERROR_CHECKING_SESSION, error: err },
    );
    expect(next.status).toBe(S.ERROR_CHECKING_SESSION);
    expect(next).toHaveProperty("error", err);
  });

  // --- Recovery from error states ---
  it("ERROR_CHECKING_SESSION + AUTH_CHANGED(session) → CONTEXT_LOADING", () => {
    const next = reducer(
      { status: S.ERROR_CHECKING_SESSION, error: new Error("x"), context: null },
      { type: E.AUTH_CHANGED, session },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
  });

  it("SIGNED_OUT + AUTH_CHANGED(session) → CONTEXT_LOADING", () => {
    const next = reducer(
      { status: S.SIGNED_OUT, context: null },
      { type: E.AUTH_CHANGED, session },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
  });

  it("SIGNED_OUT + AUTH_CHANGED(null) → stays SIGNED_OUT", () => {
    const state = { status: S.SIGNED_OUT, context: null } as const;
    const next = reducer(state, { type: E.AUTH_CHANGED, session: null });
    expect(next).toBe(state);
  });

  // --- AUTH_CHANGED during CONTEXT_LOADING with new session ---
  it("CONTEXT_LOADING + AUTH_CHANGED(new session) → CONTEXT_LOADING with new session", () => {
    const newSession = { user: { id: "u2" } } as Session;
    const next = reducer(
      { status: S.CONTEXT_LOADING, session, context: null },
      { type: E.AUTH_CHANGED, session: newSession },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
    expect(next).toHaveProperty("session", newSession);
  });

  it("CONTEXT_LOADING + AUTH_CHANGED(same session) → state unchanged", () => {
    const state = {
      status: S.CONTEXT_LOADING,
      session,
      context: null,
    } as const;
    const next = reducer(state, { type: E.AUTH_CHANGED, session });
    expect(next).toBe(state);
  });

  it("INITIALIZING + AUTH_CHANGED(same session) → state unchanged", () => {
    const ctx = { role: "admin" };
    const state = {
      status: S.INITIALIZING,
      session,
      context: ctx,
    } as const;
    const next = reducer(state, { type: E.AUTH_CHANGED, session });
    expect(next).toBe(state);
  });

  it("AUTH_READY + AUTH_CHANGED(same session) → AUTH_READY with updated session only", () => {
    const ctx = { role: "admin" };
    const originalSession = { user: { id: "u1", foo: "bar" } } as Session;
    const newerSession = { user: { id: "u1", foo: "baz" } } as Session;
    const state = {
      status: S.AUTH_READY,
      session: originalSession,
      context: ctx,
    } as const;
    const next = reducer(state, { type: E.AUTH_CHANGED, session: newerSession });
    expect(next.status).toBe(S.AUTH_READY);
    expect(next.context).toBe(ctx);
    expect(next.session).toBe(newerSession);
  });

  // --- AUTHENTICATING state ---
  it("SIGNED_OUT + AUTH_INITIATED → AUTHENTICATING", () => {
    const next = reducer(
      { status: S.SIGNED_OUT, context: null },
      { type: E.AUTH_INITIATED },
    );
    expect(next.status).toBe(S.AUTHENTICATING);
  });

  it("AUTHENTICATING + AUTH_CHANGED(session) → CONTEXT_LOADING", () => {
    const next = reducer(
      { status: S.AUTHENTICATING, context: null },
      { type: E.AUTH_CHANGED, session },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
    expect(next).toHaveProperty("session", session);
  });

  it("AUTHENTICATING + AUTH_CHANGED(null) → SIGNED_OUT", () => {
    const next = reducer(
      { status: S.AUTHENTICATING, context: null },
      { type: E.AUTH_CHANGED, session: null },
    );
    expect(next.status).toBe(S.SIGNED_OUT);
  });

  it("AUTHENTICATING + AUTH_CANCELLED → SIGNED_OUT", () => {
    const next = reducer(
      { status: S.AUTHENTICATING, context: null },
      { type: E.AUTH_CANCELLED },
    );
    expect(next.status).toBe(S.SIGNED_OUT);
  });

  it("ERROR_CHECKING_SESSION + AUTH_INITIATED → AUTHENTICATING", () => {
    const next = reducer(
      { status: S.ERROR_CHECKING_SESSION, error: new Error("x"), context: null },
      { type: E.AUTH_INITIATED },
    );
    expect(next.status).toBe(S.AUTHENTICATING);
  });

  it("AUTH_INITIATED from non-SIGNED_OUT/non-error is invalid", () => {
    const state = { status: S.AUTH_READY, session, context: {} } as const;
    const next = reducer(state, { type: E.AUTH_INITIATED });
    expect(next).toBe(state);
  });
});
