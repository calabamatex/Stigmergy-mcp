# Stigmergy-mcp

An MCP-compatible trace store for experimenting with indirect shared-state coordination among AI agents.

`stigmergy-mcp` is a coordination primitive rather than an agent framework, orchestrator, or runtime. Agents can deposit typed traces into a shared environment, retrieve traces near a task area, reinforce or weaken existing traces, and inspect high-intensity signals across a broader area.

## Research Status

Trace-based coordination is a hypothesis under evaluation, not a proven solution to multi-agent scaling.

Under cumulative, non-summarizing, sequential handoff with approximately constant predecessor payloads, repeated context transfer can grow quadratically with agent count. Under bounded trace retrieval, bounded retrieved volume, and bounded operation frequency, trace-based coordination can grow approximately linearly. Those forms are conditional. Message passing can summarize, cache, prune, and route selectively, while trace size, retrieval breadth, mechanism overhead, and fidelity loss can grow with system scale.

The companion [`Stigmergy-mcp-benchmark`](https://github.com/calabamatex/Stigmergy-mcp-benchmark) provides exploratory measurements. The current evidence does not establish a general crossover, matched-fidelity superiority, or a mechanism-specific benefit from decay and reinforcement.

## When the Primitive May Help

Trace coordination may be worth evaluating when:

- task-relevant state is sparse and locally indexable;
- downstream agents need selected state rather than full conversational replay;
- trace payloads remain compact;
- retrieval breadth remains bounded;
- provenance and write controls can be enforced.

Direct handoff, bounded summarization, or a generic shared workspace may be preferable when:

- complete context is required;
- agent count is low;
- cache reuse makes repeated prefixes inexpensive;
- state cannot be safely compressed;
- trace retrieval would approach a full-store scan;
- shared-state security controls are unavailable.

## What Is Stigmergy?

Stigmergy describes indirect coordination through state left in a shared environment. The implementation supports three trace types:

- **attraction** — a positive signal associated with an area
- **danger** — a warning associated with an area
- **info** — a neutral annotation

Traces carry intensity, tags, metadata, and an exponential decay horizon. Other agents retrieve traces by area and effective intensity rather than by replaying a full transcript.

## Quick Start

### Install from npm

```bash
npm install stigmergy-mcp
```

### Build from source

```bash
git clone https://github.com/calabamatex/Stigmergy-mcp.git
cd Stigmergy-mcp
npm install
npm run build
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
npm run inspect
```

## Database

Traces persist to `./stigmergy.db` by default.

```bash
STIGMERGY_DB_PATH=/path/to/traces.db
STIGMERGY_DB_PATH=:memory:
```

The database is created on first use.

## MCP Tools

### `deposit_trace`

Write a trace into the shared environment.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `area` | string | required | File path, module, or task area |
| `action` | string | required | Event or observation represented by the trace |
| `agent_id` | string | required | Originating agent identifier |
| `trace_type` | `attraction`, `danger`, or `info` | required | Signal type |
| `intensity` | number from 0 to 1 | 0.5 | Initial signal strength |
| `decay_hours` | number | 24 | Exponential decay horizon |
| `tags` | string array | empty | Searchable labels |
| `metadata` | object | empty | Additional structured data |

### `sense_environment`

Read traces near a specified area.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `area` | string | required | File path or prefix |
| `radius` | integer | 2 | Number of path levels included in matching |
| `min_intensity` | number from 0 to 1 | 0.05 | Minimum effective intensity |
| `trace_type` | enum | optional | Filter by trace type |
| `tags` | string array | optional | Require all supplied tags |
| `agent_id` | string | optional | Filter by originating agent |

Results are sorted by effective intensity.

### `reinforce_trace`

Strengthen or weaken an existing trace.

| Parameter | Type | Description |
| --- | --- | --- |
| `trace_id` | string | Trace identifier |
| `delta` | number from -1 to 1 | Positive strengthens; negative weakens |

### `get_gradient`

Return the strongest traces across a broad area.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `area` | string | required | Broad area prefix |
| `limit` | integer | 5 | Maximum returned traces |

## Trace Lifecycle

Effective intensity follows:

```text
effective = intensity * exp(-elapsed_hours / decay_hours)
```

With the default `decay_hours=24`, a trace retains approximately 37% of its original intensity after 24 hours and approximately 14% after 48 hours. Runs lasting only minutes are unlikely to exercise the decay mechanism materially. Claims about the value of decay or reinforcement therefore require long-horizon tests or explicit ablations.

Traces below the pruning threshold are removed during deposit operations and are excluded from reads below the applicable query threshold.

## Example Workflow

```text
Agent A:
  deposit_trace(area: "src/auth/session.ts",
                action: "found XSS in session handler",
                trace_type: "danger",
                intensity: 0.8,
                tags: ["security"])

Agent B:
  sense_environment(area: "src/auth/login.ts", radius: 1)
  reinforce_trace(trace_id: "...", delta: 0.15)

Agent C:
  get_gradient(area: "src/", limit: 5)
```

## Programmatic Usage

```typescript
import { TraceStore } from 'stigmergy-mcp/store';
import { createServer } from 'stigmergy-mcp/server';

const store = new TraceStore('/path/to/traces.db');
const server = createServer(store);
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for implementation details.

## Security and Governance

A writable shared trace store can become a prompt-injection, poisoning, and sensitive-data propagation surface. Production deployment should add controls appropriate to the environment, including:

- authenticated writes and agent identity
- provenance and append-only audit records
- access control and tenant isolation
- content validation and read-time sanitization
- retention, deletion, and incident-response procedures
- explicit trust labels for agent- and tool-generated state

The package should not be interpreted as a complete production security control plane.

## Benchmarks

The exploratory benchmarking harness lives at [`calabamatex/Stigmergy-mcp-benchmark`](https://github.com/calabamatex/Stigmergy-mcp-benchmark).

## Development

```bash
npm run build
npm run dev
npm test
npm run test:coverage
npm run loc
npm run inspect
```

## License

MIT
