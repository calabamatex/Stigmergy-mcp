# stigmergy-mcp

An MCP server implementing digital pheromone-based indirect coordination for AI coding agents. Inspired by ant colony stigmergy — agents leave typed traces in a shared environment; other agents sense and respond to those traces without direct messaging.

## How It Works

Agents communicate indirectly through three trace types:

- **attraction** — "this path worked well" (draws agents toward an area)
- **danger** — "something is broken here" (warns agents away)
- **info** — neutral annotation (context for future visitors)

Traces decay exponentially over time (`effective = intensity * exp(-elapsed_hours / decay_hours)`), so stale signals fade naturally. Fresh, reinforced signals dominate.

## Install

```bash
npm install stigmergy-mcp
```

## Setup

Add as an MCP server in Claude Code:

```bash
# From npm
claude mcp add stigmergy -- node node_modules/stigmergy-mcp/dist/src/index.js

# Or clone and build
git clone https://github.com/calabamatex/stigmergy-mcp.git && cd stigmergy-mcp
npm install && npm run build
claude mcp add stigmergy -- node dist/src/index.js
```

By default, traces persist to `./stigmergy.db`. Override with:

```bash
STIGMERGY_DB_PATH=/path/to/traces.db
```

## Tools

### deposit_trace

Leave a trace in the shared environment.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `area` | string | required | File path or module name |
| `action` | string | required | What happened |
| `agent_id` | string | required | Which agent is leaving this |
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
| `radius` | integer | 2 | Path depth for prefix matching |
| `min_intensity` | number (0-1) | 0.05 | Minimum effective intensity |
| `trace_type` | enum | optional | Filter by type |

Returns traces sorted by effective intensity (descending).

### reinforce_trace

Strengthen or weaken an existing trace.

| Parameter | Type | Description |
|-----------|------|-------------|
| `trace_id` | string | ID of trace to reinforce |
| `delta` | number (-1 to 1) | Positive to strengthen, negative to weaken |

### get_gradient

Return the strongest signals across an area — the "which direction should I look?" tool.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `area` | string | required | Broad area prefix (e.g. `"src/"`) |
| `limit` | integer | 5 | Max traces to return |

Returns top traces grouped by `trace_type`.

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

## Decay

Traces fade exponentially. With `decay_hours=24`, a trace retains ~37% intensity after 24 hours and ~14% after 48 hours. Short-lived warnings (`decay_hours=4`) fade fast. Long-term memory (`decay_hours=168`) persists for about a week. Traces below 1% effective intensity are automatically pruned.

## Development

```bash
npm run build        # Compile TypeScript
npm test             # Run all tests
npm run loc          # Check source/test LOC and file count
npm run inspect      # Launch MCP Inspector
```

## License

MIT
