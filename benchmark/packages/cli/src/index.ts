#!/usr/bin/env node

import { runCompare } from './commands/run.js';
import { listTasksCommand, listResultsCommand } from './commands/list.js';
import { showResultCommand } from './commands/show.js';

export interface ParsedArgs {
  command: string;
  subcommand?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip node + script
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }

  return {
    command: positional[0] ?? '',
    subcommand: positional[1],
    flags,
    positional: positional.slice(2),
  };
}

const USAGE = `
stigmergy-benchmark — Empirical token usage comparison

Commands:
  tasks list                              List available benchmark tasks
  compare --task <id> [options]           Run a comparison
  results list                            List past comparison results
  results show <id>                       Show detailed results

Compare options:
  --task <id>          Task to benchmark (required)
  --trials <n>         Number of trials (default: 10, min: 3)
  --provider <p>       LLM provider: mock | anthropic | openai (default: mock)
  --model <m>          Model name (default: per provider)
  --temperature <t>    Temperature (default: 0)
  --skip-single-agent  Skip Run A (faster, no cross-validation)
  --seed <n>           Fixed PRNG seed for reproducibility
  --db <path>          SQLite database path (default: ./stigmergy-benchmark.db)
  --verbose            Per-call token breakdown
`.trim();

async function main() {
  const parsed = parseArgs(process.argv);

  if (!parsed.command || parsed.flags.help) {
    console.log(USAGE);
    process.exit(0);
  }

  try {
    switch (parsed.command) {
      case 'tasks':
        if (parsed.subcommand === 'list') {
          listTasksCommand();
        } else {
          console.error(`Unknown subcommand: tasks ${parsed.subcommand ?? ''}\nUse: tasks list`);
          process.exit(1);
        }
        break;

      case 'compare':
        await runCompare(parsed);
        break;

      case 'results':
        if (parsed.subcommand === 'list') {
          listResultsCommand(parsed);
        } else if (parsed.subcommand === 'show') {
          showResultCommand(parsed);
        } else {
          console.error(`Unknown subcommand: results ${parsed.subcommand ?? ''}\nUse: results list | results show <id>`);
          process.exit(1);
        }
        break;

      default:
        console.error(`Unknown command: ${parsed.command}`);
        console.log(USAGE);
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// Only run main when executed directly (not imported by tests)
const isDirectExecution = process.argv[1]?.includes('cli') || process.argv[1]?.endsWith('index.js');
if (isDirectExecution && !process.env.VITEST) {
  main();
}
