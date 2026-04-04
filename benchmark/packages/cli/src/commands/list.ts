import { listTasks } from '@stigmergy-benchmark/tasks';
import { BenchmarkStore } from '@stigmergy-benchmark/storage';
import type { ParsedArgs } from '../index.js';

export function listTasksCommand(): void {
  const tasks = listTasks();

  console.log('\nAvailable Benchmark Tasks\n');
  console.log(
    pad('ID', 24) + pad('Name', 36) + pad('Agents', 8) + pad('Category', 12) + 'Crossover',
  );
  console.log('-'.repeat(90));

  for (const task of tasks) {
    console.log(
      pad(task.id, 24) +
      pad(task.name, 36) +
      pad(String(task.agentCount), 8) +
      pad(task.category, 12) +
      (task.crossoverTask ? 'yes' : ''),
    );
  }
  console.log(`\n${tasks.length} tasks available.\n`);
}

export function listResultsCommand(args: ParsedArgs): void {
  const dbPath = getDbPath(args);
  const store = new BenchmarkStore(dbPath);

  try {
    const comparisons = store.listComparisons();

    if (comparisons.length === 0) {
      console.log('\nNo comparison results found.\n');
      return;
    }

    console.log('\nPast Comparison Results\n');
    console.log(
      pad('ID', 40) + pad('Task', 30) + pad('Trials', 8) + 'Date',
    );
    console.log('-'.repeat(90));

    for (const c of comparisons) {
      console.log(
        pad(c.id.slice(0, 36) + '...', 40) +
        pad(c.taskName, 30) +
        pad(String(c.trialCount), 8) +
        new Date(c.timestamp).toISOString().slice(0, 19),
      );
    }
    console.log(`\n${comparisons.length} results. Use 'results show <id>' for details.\n`);
  } finally {
    store.close();
  }
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

function getDbPath(args: ParsedArgs): string {
  return (args.flags.db as string) ?? process.env.STIGMERGY_BENCHMARK_DB ?? './stigmergy-benchmark.db';
}
