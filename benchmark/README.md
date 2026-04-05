# Stigmergy Benchmark

Empirical benchmark proving stigmergic coordination reduces inter-agent token usage compared to message-passing multi-agent orchestration.

## What It Does

Runs the **same task** through three architectures, measures token usage across five categories, and applies statistical rigor (bootstrap CIs, Wilcoxon signed-rank, TOST equivalence) over multiple trials.

| Run | Architecture | Purpose |
|-----|-------------|---------|
| A | Single Agent | Autonomous cost floor (no coordination) |
| B | Message-Passing Swarm | Control: agents share cumulative conversation history |
| C | Stigmergy Swarm | Experimental: agents coordinate via [stigmergy-mcp](https://github.com/calabamatex/stigmergy-mcp) traces |

### Five Token Categories

Every API call's tokens are classified into exactly one category:

- **Content Transfer (CT)** — work product passed between agents
- **Mechanism Overhead (MO)** — coordination protocol tokens (tool defs, tool calls)
- **Coordination Instructions (CI)** — prompts directing inter-agent behavior
- **Task Reasoning (TR)** — the agent's actual thinking and output
- **System Identity (SI)** — base system prompt

**Key insight:** In message-passing, CT grows O(N^2) as each agent ingests all predecessors. In stigmergy, CT is O(N) — agents read compact trace summaries instead.

## Quick Start

```bash
# Install
pnpm install

# Build
pnpm build

# List available tasks
node packages/cli/dist/index.js tasks list

# Run a comparison (mock LLM, 3 trials)
node packages/cli/dist/index.js compare --task research-report --trials 3 --provider mock

# Run with real API
ANTHROPIC_API_KEY=sk-... node packages/cli/dist/index.js compare --task research-report --trials 10 --provider anthropic
```

## CLI Commands

```
tasks list                              List benchmark tasks
compare --task <id> [options]           Run a comparison
results list                            List past results
results show <id>                       Show detailed results
```

### Compare Options

| Flag | Default | Description |
|------|---------|-------------|
| `--task <id>` | (required) | Task to benchmark |
| `--trials <n>` | 10 | Number of trials (min 3) |
| `--provider <p>` | mock | LLM provider: mock, anthropic, openai |
| `--model <m>` | per provider | Model name |
| `--temperature <t>` | 0 | Temperature |
| `--skip-single-agent` | false | Skip Run A |
| `--db <path>` | ./stigmergy-benchmark.db | SQLite path |

## Dashboard

```bash
# Start the dashboard server
node packages/dashboard/dist/server.js

# Open http://localhost:3456
```

The dashboard provides:
- Task selection with configurable trials/provider
- Live comparison progress via WebSocket
- Results visualization with 5-category stacked bar charts
- Variance profile and cross-validation status
- History of past comparisons

## Benchmark Tasks

| ID | Name | Agents | Category | Purpose |
|----|------|--------|----------|---------|
| research-report | Research Report Pipeline | 3 | Sequential | Tests CT growth in sequential handoffs |
| multi-source-analysis | Multi-Source Analysis | 4 | Parallel | Tests parallel fan-out + synthesis |
| code-review | Iterative Code Review | 3 | Iterative | Tests iterative refinement patterns |
| single-agent-null | Single Agent (Null) | 1 | — | Validates instrumentation (~0% savings) |
| tiny-handoff | Two-Agent Tiny Handoff | 2 | Sequential | Crossover detection (TOST) |
| ten-agent-pipeline | Ten-Agent Pipeline | 10 | Sequential | Tests O(N^2) vs O(N) scaling |

## Statistical Methodology

- **Paired trials:** Each trial produces a matched triplet (A, B, C on the same task)
- **Bootstrap CIs:** 10,000 resamples, percentile method, seedable PRNG
- **Wilcoxon signed-rank:** Exact tables for n <= 20, normal approximation for n > 20
- **TOST equivalence:** For crossover tasks, tests if savings are within +/-5%
- **Progressive reporting:** RAW_ONLY (n<3) -> PROVISIONAL (3-4) -> PRELIMINARY (5-9) -> FULL (10-19) -> PUBLICATION (20+)
- **Cross-validation:** Drift threshold calibrated against Run A variance (2x CV)

## Architecture

```
core        (types, enums, config)
  |
  +-- stats       (bootstrap, Wilcoxon, TOST, aggregator)
  +-- storage     (SQLite persistence)
  +-- llm-client  (Anthropic, OpenAI, Mock + retry + rate limiter)
  +-- classifier  (5-category rule-based classification)
  +-- tasks       (6 benchmark task definitions)
  |
  +-- executors   (Run A, B, C + MCP bridge to stigmergy-mcp)
  |
  +-- engine      (comparison orchestrator, progressive reporting)
  |
  +-- cli         (command-line interface)
  +-- dashboard   (Express + WebSocket + React frontend)
```

## Development

```bash
pnpm install     # Install all dependencies
pnpm build       # Build all packages
pnpm test        # Run all tests
pnpm typecheck   # Type-check without emitting
```

## License

MIT
