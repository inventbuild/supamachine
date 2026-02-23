/// <reference types="node" />
/**
 * Deterministic flowchart generator for the supamachine core reducer.
 *
 * Runs every (state × event) combination through the REAL reducer function
 * and records which transitions produce a new state. Outputs a Mermaid
 * stateDiagram-v2 that can be rendered by GitHub, VS Code, or `mmdc`.
 *
 * Usage:  npx tsx scripts/generate-flowchart.ts [--stdout]
 */

import { AuthStateStatus, AuthEventType } from "../src/core/constants";
import { reducer, setReducerLogLevel } from "../src/core/reducer";
import { LogLevel } from "../src/core/logger";
import * as fs from "node:fs";
import * as path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);

setReducerLogLevel(LogLevel.NONE);

// ---------------------------------------------------------------------------
// Mock fixtures — just enough shape for the reducer to run
// ---------------------------------------------------------------------------

const mockSession = {
  access_token: "mock",
  refresh_token: "mock",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "mock-user-id",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
  },
} as any;

const mockContext = Symbol("mock-context");
const mockError = new Error("mock");

type AnyState = { status: string; [k: string]: unknown };

const stateFixtures: Record<string, AnyState> = {
  [AuthStateStatus.START]: {
    status: AuthStateStatus.START,
    context: null,
  },
  [AuthStateStatus.CHECKING_SESSION]: {
    status: AuthStateStatus.CHECKING_SESSION,
    context: null,
  },
  [AuthStateStatus.AUTHENTICATING]: {
    status: AuthStateStatus.AUTHENTICATING,
    context: null,
  },
  [AuthStateStatus.ERROR_CHECKING_SESSION]: {
    status: AuthStateStatus.ERROR_CHECKING_SESSION,
    error: mockError,
    context: null,
  },
  [AuthStateStatus.SIGNED_OUT]: {
    status: AuthStateStatus.SIGNED_OUT,
    context: null,
  },
  [AuthStateStatus.CONTEXT_LOADING]: {
    status: AuthStateStatus.CONTEXT_LOADING,
    session: mockSession,
    context: null,
  },
  [AuthStateStatus.ERROR_CONTEXT]: {
    status: AuthStateStatus.ERROR_CONTEXT,
    error: mockError,
    session: mockSession,
    context: null,
  },
  [AuthStateStatus.INITIALIZING]: {
    status: AuthStateStatus.INITIALIZING,
    session: mockSession,
    context: mockContext,
  },
  [AuthStateStatus.ERROR_INITIALIZING]: {
    status: AuthStateStatus.ERROR_INITIALIZING,
    error: mockError,
    session: mockSession,
    context: mockContext,
  },
  [AuthStateStatus.AUTH_READY]: {
    status: AuthStateStatus.AUTH_READY,
    session: mockSession,
    context: mockContext,
  },
};

// AUTH_CHANGED is tested twice: with and without a session.
type EventFixture = { type: string; label: string; [k: string]: unknown };

const eventFixtures: EventFixture[] = [
  { type: AuthEventType.START, label: "START" },
  {
    type: AuthEventType.AUTH_CHANGED,
    session: mockSession,
    label: "AUTH_CHANGED [session]",
  },
  {
    type: AuthEventType.AUTH_CHANGED,
    session: null,
    label: "AUTH_CHANGED [no session]",
  },
  { type: AuthEventType.AUTH_INITIATED, label: "AUTH_INITIATED" },
  { type: AuthEventType.AUTH_CANCELLED, label: "AUTH_CANCELLED" },
  {
    type: AuthEventType.CONTEXT_RESOLVED,
    context: mockContext,
    label: "CONTEXT_RESOLVED",
  },
  { type: AuthEventType.INITIALIZED, label: "INITIALIZED" },
  {
    type: AuthEventType.ERROR_CHECKING_SESSION,
    error: mockError,
    label: "ERROR_CHECKING_SESSION",
  },
  {
    type: AuthEventType.ERROR_CONTEXT,
    error: mockError,
    label: "ERROR_CONTEXT",
  },
  {
    type: AuthEventType.ERROR_INITIALIZING,
    error: mockError,
    label: "ERROR_INITIALIZING",
  },
];

// ---------------------------------------------------------------------------
// Probe every (state × event) combination through the real reducer
// ---------------------------------------------------------------------------

type Edge = { from: string; to: string; event: string };
const edges: Edge[] = [];

for (const [, stateObj] of Object.entries(stateFixtures)) {
  for (const eventObj of eventFixtures) {
    const result = reducer(stateObj as any, eventObj as any);

    // invalidTransition() and explicit no-ops return the same reference
    if (result === stateObj) continue;

    edges.push({
      from: stateObj.status as string,
      to: (result as AnyState).status as string,
      event: eventObj.label,
    });
  }
}

// ---------------------------------------------------------------------------
// Render Mermaid
// ---------------------------------------------------------------------------

// Logical ordering for readable output
const stateOrder: string[] = [
  AuthStateStatus.START,
  AuthStateStatus.CHECKING_SESSION,
  AuthStateStatus.SIGNED_OUT,
  AuthStateStatus.AUTHENTICATING,
  AuthStateStatus.CONTEXT_LOADING,
  AuthStateStatus.INITIALIZING,
  AuthStateStatus.AUTH_READY,
  AuthStateStatus.ERROR_CHECKING_SESSION,
  AuthStateStatus.ERROR_CONTEXT,
  AuthStateStatus.ERROR_INITIALIZING,
];

function stateIdx(s: string) {
  const i = stateOrder.indexOf(s);
  return i === -1 ? stateOrder.length : i;
}

// Combine edges that share (from, to) into one label
const edgeMap = new Map<string, string[]>();
for (const { from, to, event } of edges) {
  const key = `${from}|||${to}`;
  if (!edgeMap.has(key)) edgeMap.set(key, []);
  edgeMap.get(key)!.push(event);
}

const sortedKeys = [...edgeMap.keys()].sort((a, b) => {
  const [af, at] = a.split("|||");
  const [bf, bt] = b.split("|||");
  return stateIdx(af) - stateIdx(bf) || stateIdx(at) - stateIdx(bt);
});

// Semantic color groups: entry, ready, signed-out, loading, errors
// color:#000 for black text; padding for node spacing
const PADDING = "12px";
const classDefs = [
  `    classDef entry fill:#e1bee7,stroke:#6a1b9a,color:#000,padding:${PADDING}`,
  `    classDef ready fill:#c8e6c9,stroke:#2e7d32,color:#000,padding:${PADDING}`,
  `    classDef signedOut fill:#bbdefb,stroke:#1565c0,color:#000,padding:${PADDING}`,
  `    classDef loading fill:#fff9c4,stroke:#f9a825,color:#000,padding:${PADDING}`,
  `    classDef error fill:#ffcdd2,stroke:#c62828,color:#000,padding:${PADDING}`,
];

const loadingStates = [
  AuthStateStatus.CHECKING_SESSION,
  AuthStateStatus.AUTHENTICATING,
  AuthStateStatus.CONTEXT_LOADING,
  AuthStateStatus.INITIALIZING,
];
const errorStates = [
  AuthStateStatus.ERROR_CHECKING_SESSION,
  AuthStateStatus.ERROR_CONTEXT,
  AuthStateStatus.ERROR_INITIALIZING,
];

const lines: string[] = ["stateDiagram-v2"];
lines.push(`    [*] --> ${AuthStateStatus.START}`);
lines.push("");

const EDGE_PAD = "  "; // Equivalent visual spacing for edge labels
for (const key of sortedKeys) {
  const [from, to] = key.split("|||");
  const label = edgeMap.get(key)!.join(" / ");
  lines.push(`    ${from} --> ${to} : ${EDGE_PAD}${label}${EDGE_PAD}`);
}

lines.push("");
lines.push(...classDefs);
lines.push(`    class ${AuthStateStatus.START} entry`);
lines.push(`    class ${AuthStateStatus.AUTH_READY} ready`);
lines.push(`    class ${AuthStateStatus.SIGNED_OUT} signedOut`);
lines.push(`    class ${loadingStates.join(",")} loading`);
lines.push(`    class ${errorStates.join(",")} error`);

const mermaid = lines.join("\n") + "\n";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const stdoutOnly = process.argv.includes("--stdout");

if (stdoutOnly) {
  process.stdout.write(mermaid);
} else {
  const outFile = path.resolve(scriptDir, "..", "STATE_MACHINE.md");
  const markdown = [
    "# Supamachine State Machine",
    "",
    "> Auto-generated by `pnpm flowchart` — do not edit manually.",
    "",
    "```mermaid",
    mermaid.trimEnd(),
    "```",
    "",
    "## Transition Table",
    "",
    "| From | Event | To |",
    "| ---- | ----- | -- |",
    ...edges.map((e) => `| ${e.from} | ${e.event} | ${e.to} |`),
    "",
  ].join("\n");

  fs.writeFileSync(outFile, markdown);

  const graphFile = path.resolve(scriptDir, "..", "STATE_GRAPH.mmd");
  fs.writeFileSync(graphFile, mermaid);
  console.log(`Wrote ${edges.length} transitions to STATE_MACHINE.md and STATE_GRAPH.mmd`);
  console.log("");
  for (const { from, to, event } of edges) {
    console.log(`  ${from}  +  ${event}  →  ${to}`);
  }
}
