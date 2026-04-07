# CLAUDE.md — Stigmergy MCP Server

## Project Identity

Stigmergy-MCP: a standalone MCP server implementing digital pheromone-based indirect coordination for AI coding agents. Inspired by ant colony stigmergy — agents leave typed traces in a shared environment; other agents sense and respond to those traces without direct messaging.

This is a NOVEL COORDINATION PRIMITIVE, not another framework. Ship tight or don't ship.

## Hard Constraints (Non-Negotiable)

- Total source files in src/: MAX 12
- Total source LOC (src/**/*.ts): MAX 1500
- Total test LOC (tests/**/*.ts): MAX 800
- Runtime dependencies: ONLY @modelcontextprotocol/sdk, better-sqlite3, zod
- NO additional npm packages without explicit human approval
- NO files outside the defined structure without explicit human approval
- After every code change, run: `npm run build && npm test`

## Forbidden Actions

- NEVER create documentation files beyond README.md and ARCHITECTURE.md
- NEVER create a dashboard, CLI, plugin system, or configuration file loader
- NEVER add a logging library — use console.error() to stderr per MCP convention
- NEVER create "utils", "helpers", or "common" directories
- NEVER create index.ts barrel files except the root src/index.ts entry point
- NEVER add uuid — use crypto.randomUUID()
- NEVER create template files, example configs, or scaffolding scripts
- NEVER auto-commit or auto-checkpoint
- NEVER create files "for future use" or "to be implemented later"
- NEVER add badges, banners, or CI workflow files in initial build

## Architecture

```
src/
  index.ts              # Entry point: init store, start server (~15 lines)
  server.ts             # McpServer setup, register 4 tools, stdio transport (~50 lines)
  store/
    schema.ts           # Zod schemas + TypeScript types for Trace, SenseQuery, etc.
    trace-store.ts      # SQLite persistence, TTL decay math, CRUD operations
  tools/
    deposit.ts          # deposit_trace — agent leaves a trace in the environment
    sense.ts            # sense_environment — agent reads nearby traces
    reinforce.ts        # reinforce_trace — agent strengthens an existing trace
    gradient.ts         # get_gradient — returns strongest signals in an area
```

## Build Order (Follow Exactly)

1. `src/store/schema.ts` — Data model first. Define Trace, TraceInput, SenseQuery, GradientResult with Zod. Get the types right before writing any logic.
2. `src/store/trace-store.ts` — SQLite CRUD with exponential decay. Core methods: deposit(), sense(), reinforce(), gradient(), prune(). Decay formula: `effective_intensity = intensity * exp(-elapsed_hours / decay_hours)`. Traces below 0.01 intensity are prunable.
3. `tests/trace-store.test.ts` — Test deposit, sense, reinforce, decay math, pruning BEFORE moving to tools.
4. `src/tools/deposit.ts` — MCP tool: deposit_trace
5. `src/tools/sense.ts` — MCP tool: sense_environment
6. `src/tools/reinforce.ts` — MCP tool: reinforce_trace
7. `src/tools/gradient.ts` — MCP tool: get_gradient
8. `tests/tools.test.ts` — Tool handler unit tests
9. `src/server.ts` — Register all tools with McpServer
10. `src/index.ts` — Entry point
11. `tests/integration.test.ts` — End-to-end MCP tool calls
12. `README.md` — Write LAST. Concise.

## MCP Tool Specifications

### deposit_trace
Agent leaves a trace in the shared environment.
- Input: area (string — file path or module name), action (string — what happened), trace_type (enum: "attraction" | "danger" | "info"), intensity (number 0.0-1.0), decay_hours (number, default 24), tags (string[]), metadata (object, optional)
- Output: trace ID + confirmation
- Side effect: writes to SQLite

### sense_environment
Agent reads traces near a given area.
- Input: area (string — file path or module prefix), radius (number — path depth for matching, default 2), min_intensity (number — filter threshold, default 0.05), trace_type (enum, optional — filter by type)
- Output: array of active traces sorted by effective intensity descending
- No side effects (read-only)

### reinforce_trace
Agent strengthens or weakens an existing trace.
- Input: trace_id (string), delta (number — positive to strengthen, negative to weaken)
- Output: updated trace with new intensity
- Side effect: updates SQLite

### get_gradient
Returns the strongest signals across an area — the "which direction should I look?" tool.
- Input: area (string — broad area prefix like "src/"), limit (number, default 5)
- Output: top N traces by effective intensity, grouped by trace_type, with area paths

## Data Model Core

```typescript
interface Trace {
  id: string;
  area: string;           // e.g. "src/auth/session.ts" or "src/auth/"
  action: string;         // e.g. "refactored session management"
  agent_id: string;       // which agent left this
  trace_type: 'attraction' | 'danger' | 'info';
  intensity: number;      // 0.0 - 1.0 (decays over time)
  decay_hours: number;    // half-life-ish: intensity * exp(-elapsed/decay)
  created_at: string;     // ISO timestamp
  tags: string[];         // searchable labels
  metadata: Record<string, unknown>;  // arbitrary JSON
}
```

## Decay Math

Traces decay exponentially. The effective intensity at query time:

```
effective = intensity * Math.exp(-elapsed_hours / decay_hours)
```

Where elapsed_hours = (now - created_at) in hours. This means:
- decay_hours=24: trace at ~37% after 24h, ~14% after 48h
- decay_hours=4: trace at ~37% after 4h (short-lived warning)
- decay_hours=168: trace at ~37% after 1 week (long-term memory)

Pruning: traces with effective intensity < 0.01 are garbage collected on deposit() calls.

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  action TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  trace_type TEXT NOT NULL CHECK(trace_type IN ('attraction', 'danger', 'info')),
  intensity REAL NOT NULL CHECK(intensity >= 0 AND intensity <= 1),
  decay_hours REAL NOT NULL CHECK(decay_hours > 0),
  created_at TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_traces_area ON traces(area);
CREATE INDEX IF NOT EXISTS idx_traces_type ON traces(trace_type);
CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);
```

## Quality Gates (Before Any Publish)

1. `npm run build` — zero errors, zero warnings
2. `npm test` — all passing
3. `npm run loc` — confirm src/ under 1500 LOC, under 12 files
4. `npx @modelcontextprotocol/inspector node dist/src/index.js` — all 4 tools visible and callable
5. Live test: use in a real Claude Code session, verify deposit + sense round-trip works
