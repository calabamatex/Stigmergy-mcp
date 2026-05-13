# Stigmergy-mcp

![Stigmergy-MCP: Solving the Multi-Agent Scaling Crisis — infographic contrasting O(N²) direct-message overhead with O(N) stigmergic coordination, plus the four core MCP tools](docs/images/stigmergy-mcp-hero.png)

A shared signal layer that lets multiple AI coding agents coordinate without talking to each other. Built as a standalone [MCP](https://modelcontextprotocol.io/) server.

## What is Stigmergy?

In ant colonies, ants coordinate without communicating directly. An ant leaves a pheromone trail on a path; other ants sense the trail and follow it. Strong trails attract more ants. Trails that aren't reinforced evaporate. The environment itself becomes the communication channel — no messages, no central coordinator.

**stigmergy-mcp** brings this pattern to AI coding agents. Agents leave typed traces on file paths and module names:

- **attraction** — "this path worked well" (draws agents toward an area)
- **danger** — "something is broken here" (warns agents away)
- **info** — neutral annotation (context for future visitors)

Traces decay exponentially over time, so stale signals fade naturally and fresh, reinforced signals dominate. When multiple AI agents work on the same codebase, they can sense each other's traces and adapt — without a message bus, queue, or shared state protocol.

## Quick Start

### Install from npm

```bash
npm install stigmergy-mcp
```

### Or build from source

```bash
git clone https://github.com/calabamatex/stigmergy-mcp.git
cd stigmergy-mcp
npm install && npm run build
```

### Add as an MCP server

```bash
# From npm
claude mcp add stigmergy -- node node_modules/stigmergy-mcp/dist/src/index.js

# From source
claude mcp add stigmergy -- node dist/src/index.js
```

### Verify

```bash
npm run inspect    # Opens MCP Inspector — confirm all 4 tools appear
```

### Database

Traces persist to `./stigmergy.db` by default. Override with:

```bash
STIGMERGY_DB_PATH=/path/to/traces.db    # Custom file path
STIGMERGY_DB_PATH=:memory:              # Ephemeral (no persistence)
```

The database is created automatically on first run.

## Tools

stigmergy-mcp exposes 4 MCP tools. Any MCP-compatible client can call them.

### deposit_trace

Leave a trace in the shared environment.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `area` | string | required | File path or module name (e.g. `"src/auth/session.ts"`) |
| `action` | string | required | What happened (e.g. `"refactored session management"`) |
| `agent_id` | string | required | Which agent is leaving this trace |
| `trace_type` | `"attraction"` \| `"danger"` \| `"info"` | required | Signal type |
| `intensity` | number (0-1) | 0.5 | Signal strength |
| `decay_hours` | number | 24 | Hours until ~37% intensity |
| `tags` | string[] | [] | Searchable labels |
| `metadata` | object | {} | Arbitrary JSON payload |

### sense_environment

Read traces near a given area. Read-only.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `area` | string | required | File path or prefix to scan |
| `radius` | integer | 2 | How many path segments to walk up for matching |
| `min_intensity` | number (0-1) | 0.05 | Minimum effective intensity to include |
| `trace_type` | enum | optional | Filter by type |
| `tags` | string[] | optional | Filter to traces containing ALL of these tags |
| `agent_id` | string | optional | Filter to traces from a specific agent |

**How radius works:** The `radius` parameter controls how broad the search is by walking up the path hierarchy. Given `area="src/auth/session.ts"`:

- `radius=0` → prefix `src/auth/session.ts/` (matches only children, not the file itself)
- `radius=1` → prefix `src/auth/` (sibling files in the same directory)
- `radius=2` → prefix `src/` (broader area)

Returns traces sorted by effective intensity (descending).

### reinforce_trace

Strengthen or weaken an existing trace.

| Parameter | Type | Description |
|-----------|------|-------------|
| `trace_id` | string | ID of trace to reinforce |
| `delta` | number (-1 to 1) | Positive to strengthen, negative to weaken |

### get_gradient

Return the strongest signals across a broad area — the "which direction should I look?" tool. Use this for exploration and orientation. Unlike `sense_environment` (which reads traces near a specific file), `get_gradient` scans a wide prefix and returns the top signals grouped by type.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `area` | string | required | Broad area prefix (e.g. `"src/"`) |
| `limit` | integer | 5 | Max traces to return |

Returns the top N traces by effective intensity. The `by_type` grouping only includes traces within the top N — not all traces in the area.

## Example: Multi-Agent Workflow

```
Agent A (refactoring auth):
  → deposit_trace(area: "src/auth/session.ts", action: "found XSS in session handler",
                  trace_type: "danger", intensity: 0.8, tags: ["security"])

Agent B (working nearby):
  → sense_environment(area: "src/auth/login.ts", radius: 1)
  ← sees danger trace on session.ts — avoids touching it, or fixes the issue
  → reinforce_trace(trace_id: "...", delta: 0.15)  // confirms the danger

Agent C (new to the codebase):
  → get_gradient(area: "src/", limit: 5)
  ← sees strongest signal is a danger on src/auth/session.ts — investigates first
```

## Trace Lifecycle

Traces decay exponentially. The effective intensity at any point:

```
effective = intensity * exp(-elapsed_hours / decay_hours)
```

With `decay_hours=24`, a trace retains ~37% intensity after 24 hours and ~14% after 48 hours. Short-lived warnings (`decay_hours=4`) fade in hours. Long-term memory (`decay_hours=168`) persists for about a week.

Traces below 1% effective intensity are automatically pruned during `deposit()` calls. They are also invisible to `sense_environment` and `get_gradient` below their respective thresholds, so expired traces never pollute query results.

## Programmatic Usage

The package exports the store and server for embedding in your own code:

```typescript
import { TraceStore } from 'stigmergy-mcp/store';
import { createServer, startServer } from 'stigmergy-mcp/server';

// Use the store directly
const store = new TraceStore('/path/to/traces.db');
const trace = store.deposit({ area: 'src/foo.ts', action: 'refactored', agent_id: 'my-agent', trace_type: 'info', intensity: 0.5, decay_hours: 24, tags: [], metadata: {} });

// Or create/start an MCP server with a custom store
const server = createServer(store);
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for internal design details and extension points.

## Benchmarks

The benchmarking harness — comparing stigmergic swarms against single-agent and message-passing baselines — lives in a separate repository: [calabamatex/Stigmergy-mcp-benchmark](https://github.com/calabamatex/Stigmergy-mcp-benchmark).

## Development

```bash
npm run build          # Compile TypeScript
npm run dev            # Compile in watch mode
npm test               # Run all tests
npm run test:coverage  # Run tests with coverage
npm run loc            # Check source/test LOC and file count
npm run inspect        # Launch MCP Inspector
```

## License

MIT
