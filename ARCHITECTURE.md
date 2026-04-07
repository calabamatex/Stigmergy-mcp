# Architecture

Internal architecture for contributors. Read [README.md](README.md) first for usage and concepts.

## Project Constraints

This project enforces strict minimalism:

- **Max 12 source files** in `src/`, **max 1500 LOC** across all `src/**/*.ts`
- **3 runtime dependencies only**: `@modelcontextprotocol/sdk`, `better-sqlite3`, `zod`
- No utils/helpers/commons directories, no barrel exports beyond root `src/index.ts`
- No logging libraries — `console.error()` to stderr per MCP convention
- Run `npm run loc` to verify limits at any time

## File Map

```
src/
  index.ts                 # Entry point: read DB path, init store, start server (17 lines)
  server.ts                # McpServer setup, register 4 tools, stdio transport (29 lines)
  store/
    schema.ts              # Zod schemas + TS types: Trace, inputs, outputs (84 lines)
    trace-store.ts         # SQLite CRUD, decay math, pruning (173 lines)
  tools/
    deposit.ts             # deposit_trace handler (19 lines)
    sense.ts               # sense_environment handler (19 lines)
    reinforce.ts           # reinforce_trace handler (19 lines)
    gradient.ts            # get_gradient handler (19 lines)

tests/
  trace-store.test.ts      # Store unit tests: CRUD, decay math, pruning
  tools.test.ts            # Tool handler unit tests
  integration.test.ts      # End-to-end MCP tool call tests
```

## Data Flow

### Deposit-then-sense cycle

1. MCP client sends a `deposit_trace` tool call over stdio
2. `index.ts` has already initialized a `TraceStore` and passed it to `createServer()`
3. `server.ts` registered the tool via `registerDeposit(server, store)`
4. `tools/deposit.ts` parses input with Zod (`DepositInput.parse()`), calls `store.deposit()`
5. `store.deposit()` runs `prune()` first (garbage collects expired traces), then INSERTs a new row with `crypto.randomUUID()` as the ID
6. The tool handler wraps the result as MCP text content and returns it to the client

### Sensing

7. MCP client sends `sense_environment` with an area and radius
8. `store.sense()` computes `areaPrefix()` — walks up path segments by `radius` steps, producing a SQL `LIKE prefix%` query
9. Each matching row is hydrated with `effectiveIntensity()` (decay calculation), filtered by `min_intensity`, and sorted descending

All four tools follow the same pattern: Zod parse → store method → JSON text response.

## Design Decisions

**Decay is computed at read time, not write time.** The database stores the original intensity and `created_at`. Effective intensity is calculated on every `sense()` and `gradient()` query. This eliminates background jobs, timers, and cron — the system is fully reactive. The tradeoff is per-row floating-point math on reads, but with expected trace counts (dozens to low hundreds) this is negligible.

**Pruning piggy-backs on `deposit()`.** `prune()` runs inside every `deposit()` call, not on a schedule. A database with no new deposits retains expired traces, but since expired traces have `effective_intensity < 0.01`, they are invisible to `sense()` and `gradient()`.

**Area matching uses string prefix, not a tree.** `areaPrefix()` splits the area path by `/`, walks up `radius` segments, and does `LIKE prefix%`. This is simple and fast for file-path-shaped data. Example: `sense("src/auth/session.ts", radius: 2)` matches everything under `src/`. This intentionally assumes hierarchical, slash-delimited area names.

**Reinforcement modifies stored intensity, not effective intensity.** `reinforce(delta: 0.2)` changes the `intensity` column in SQLite. The trace is still subject to elapsed-time decay — reinforcement says "this signal is still relevant" but does not reset the clock.

**Tags and metadata are JSON strings.** SQLite has no native array type, so `tags` and `metadata` are serialized on write and parsed on read. They are returned by queries but not indexed or filterable via SQL — this keeps the schema simple.

**WAL mode for concurrency.** The database opens with `pragma journal_mode = WAL`, allowing concurrent reads from multiple processes. Multiple agents may run separate MCP server instances against the same `.db` file, so WAL is essential.

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

CREATE INDEX IF NOT EXISTS idx_traces_area ON traces(area);       -- prefix LIKE queries
CREATE INDEX IF NOT EXISTS idx_traces_type ON traces(trace_type); -- type-filtered sense
CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);
```

## Extension Points

**New trace type:** Add the value to the `TraceType` enum in `schema.ts`, the SQL `CHECK` constraint in `trace-store.ts`, and the `GradientResult.by_type` interface in `schema.ts`. Three files, a few lines each.

**New tool:** Create `src/tools/newtool.ts` following the 19-line pattern in any existing tool file (Zod parse → store method → JSON response). Register it in `server.ts` with `registerNewTool(server, store)`. Add input schema to `schema.ts`.

**Custom decay function:** Replace the private `effectiveIntensity()` method in `trace-store.ts`. It is called in exactly two places: `hydrateTrace()` and `prune()`. Could be swapped for linear, step-function, or any other decay curve.

**Alternative storage backend:** Implement the same five public methods as `TraceStore` — `deposit()`, `sense()`, `reinforce()`, `gradient()`, `prune()`. There is no formal interface, but the method signatures and return types (defined in `schema.ts`) are stable.

## Testing

All tests use in-memory SQLite (`:memory:`) for speed and isolation.

- **`trace-store.test.ts`** — Unit tests for the store: deposit/sense/reinforce/gradient/prune, decay math correctness with known elapsed times, edge cases (clamping, missing traces).
- **`tools.test.ts`** — Tests each MCP tool handler function in isolation, verifying Zod validation and correct store interactions.
- **`integration.test.ts`** — End-to-end tests: multi-step deposit → sense → reinforce → gradient workflows, cross-agent visibility, expired trace pruning.

Run with `npm test`. For coverage: `npm run test:coverage`.
