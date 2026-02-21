import { describe, it, expect, beforeEach } from "vitest";
import { reducer, setReducerLogLevel } from "../src/core/reducer";
import { AuthStateStatus as S, AuthEventType as E } from "../src/core/constants";
import { LogLevel } from "../src/core/logger";
import type { Session } from "@supabase/supabase-js";

const session = { user: { id: "u1" } } as Session;

describe("reducer", () => {
  beforeEach(() => setReducerLogLevel(LogLevel.NONE));
  // --- Happy path ---
  it("START + START → CHECKING", () => {
    const next = reducer({ status: S.START }, { type: E.START });
    expect(next.status).toBe(S.CHECKING);
  });

  it("CHECKING + AUTH_RESOLVED(session) → CONTEXT_LOADING", () => {
    const next = reducer(
      { status: S.CHECKING },
      { type: E.AUTH_RESOLVED, session },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
    expect(next).toHaveProperty("session", session);
  });

  it("CHECKING + AUTH_RESOLVED(null) → SIGNED_OUT", () => {
    const next = reducer(
      { status: S.CHECKING },
      { type: E.AUTH_RESOLVED, session: null },
    );
    expect(next.status).toBe(S.SIGNED_OUT);
  });

  it("CONTEXT_LOADING + CONTEXT_RESOLVED → INITIALIZING", () => {
    const ctx = { role: "admin" };
    const next = reducer(
      { status: S.CONTEXT_LOADING, session },
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
    const state = { status: S.START } as const;
    const next = reducer(state, { type: E.AUTH_CHANGED, session: null });
    expect(next).toBe(state);
  });

  // --- Error paths ---
  it("CHECKING + ERROR_CHECKING → ERROR_CHECKING with error", () => {
    const err = new Error("network");
    const next = reducer(
      { status: S.CHECKING },
      { type: E.ERROR_CHECKING, error: err },
    );
    expect(next.status).toBe(S.ERROR_CHECKING);
    expect(next).toHaveProperty("error", err);
  });

  // --- Recovery from error states ---
  it("ERROR_CHECKING + AUTH_RESOLVED(session) → CONTEXT_LOADING", () => {
    const next = reducer(
      { status: S.ERROR_CHECKING, error: new Error("x") },
      { type: E.AUTH_RESOLVED, session },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
  });

  it("SIGNED_OUT + AUTH_RESOLVED(session) → CONTEXT_LOADING", () => {
    const next = reducer(
      { status: S.SIGNED_OUT },
      { type: E.AUTH_RESOLVED, session },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
  });

  it("SIGNED_OUT + AUTH_RESOLVED(null) → stays SIGNED_OUT", () => {
    const state = { status: S.SIGNED_OUT } as const;
    const next = reducer(state, { type: E.AUTH_RESOLVED, session: null });
    expect(next).toBe(state);
  });

  // --- AUTH_CHANGED during CONTEXT_LOADING with new session ---
  it("CONTEXT_LOADING + AUTH_CHANGED(new session) → CONTEXT_LOADING with new session", () => {
    const newSession = { user: { id: "u2" } } as Session;
    const next = reducer(
      { status: S.CONTEXT_LOADING, session },
      { type: E.AUTH_CHANGED, session: newSession },
    );
    expect(next.status).toBe(S.CONTEXT_LOADING);
    expect(next).toHaveProperty("session", newSession);
  });
});
