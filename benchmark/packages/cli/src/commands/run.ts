import type { ComparisonConfig } from '@stigmergy-benchmark/core';
import { ReportingLevel, RunType } from '@stigmergy-benchmark/core';
import { getTask } from '@stigmergy-benchmark/tasks';
import { ComparisonEngine } from '@stigmergy-benchmark/engine';
import { BenchmarkStore } from '@stigmergy-benchmark/storage';
import { MockLLMClient, AnthropicClient, OpenAIClient, RetryLLMClient, RateLimitedLLMClient } from '@stigmergy-benchmark/llm-client';
import type { LLMClient } from '@stigmergy-benchmark/llm-client';
import type { ParsedArgs } from '../index.js';
import { formatProgressLine, formatProvisionalStats } from '../format/progress.js';
import { formatComparisonResult } from '../format/results.js';

export async function runCompare(args: ParsedArgs): Promise<void> {
  const taskId = args.flags.task as string;
  if (!taskId) {
    console.error('Error: --task <id> is required.\nUse "tasks list" to see available tasks.');
    process.exit(1);
  }

  const task = getTask(taskId);
  const trialCount = Math.max(3, Number(args.flags.trials) || 10);
  const provider = (args.flags.provider as string) ?? 'mock';
  const model = (args.flags.model as string) ?? getDefaultModel(provider);
  const temperature = Number(args.flags.temperature) || 0;
  const skipSingleAgent = args.flags['skip-single-agent'] === true;
  const seed = args.flags.seed ? Number(args.flags.seed) : undefined;
  const dbPath = (args.flags.db as string) ?? process.env.STIGMERGY_BENCHMARK_DB ?? './stigmergy-benchmark.db';

  if (task.crossoverTask && trialCount < 15) {
    console.warn(`Warning: Task "${task.name}" is a crossover task. TOST requires n >= 15 for adequate power (you set ${trialCount}).`);
  }

  const config: ComparisonConfig = {
    trialCount,
    provider,
    model,
    temperature,
    promptCachingEnabled: true,
    skipSingleAgent,
  };

  console.log(`\nStigmergy-MCP Token Comparison`);
  console.log(`Task: ${task.name}  |  Model: ${model} (${provider})  |  Trials: ${trialCount}`);
  console.log(`${'─'.repeat(70)}\n`);

  const client = createClient(provider, seed);
  const store = new BenchmarkStore(dbPath);
  const engine = new ComparisonEngine(store, client);

  try {
    const result = await engine.runComparison(task, config, {
      onTrialStart(trialIndex, totalTrials) {
        process.stdout.write(`\r${formatProgressLine(trialIndex, totalTrials, 'running')}  `);
      },
      onTrialComplete(trial, partialStats) {
        process.stdout.write(`\r${formatProgressLine(trial.trialIndex, config.trialCount, 'complete')}  \n`);

        // Show provisional stats at milestones
        if (partialStats.reportingLevel !== ReportingLevel.RAW_ONLY) {
          const line = formatProvisionalStats(partialStats);
          if (line) console.log(`  ${line}`);
        }
      },
      onError(trialIndex, error) {
        console.error(`\n  Trial ${trialIndex + 1} failed: ${error.message}`);
      },
    });

    console.log('');
    console.log(formatComparisonResult(result));
    console.log(`\nResult saved: ${result.id}`);
    console.log(`View again: stigmergy-benchmark results show ${result.id}\n`);
  } finally {
    store.close();
  }
}

function createClient(provider: string, seed?: number): LLMClient {
  let client: LLMClient;
  switch (provider) {
    case 'mock':
      return new MockLLMClient({ seed: seed ?? 42, variance: 0.2 });
    case 'anthropic':
      client = new AnthropicClient();
      break;
    case 'openai':
      client = new OpenAIClient();
      break;
    default:
      throw new Error(`Unknown provider: ${provider}. Use: mock | anthropic | openai`);
  }
  // Wrap real providers with retry + rate limiting
  return new RateLimitedLLMClient(new RetryLLMClient(client));
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'anthropic': return 'claude-sonnet-4-20250514';
    case 'openai': return 'gpt-4o';
    case 'mock': return 'mock-model';
    default: return 'unknown';
  }
}
