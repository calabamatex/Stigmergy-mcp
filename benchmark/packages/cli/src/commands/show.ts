import { BenchmarkStore } from '@stigmergy-benchmark/storage';
import type { ParsedArgs } from '../index.js';
import { formatComparisonResult } from '../format/results.js';

export function showResultCommand(args: ParsedArgs): void {
  const id = args.positional[0];
  if (!id) {
    console.error('Error: comparison ID is required.\nUsage: results show <id>');
    process.exit(1);
  }

  const dbPath = (args.flags.db as string) ?? process.env.STIGMERGY_BENCHMARK_DB ?? './stigmergy-benchmark.db';
  const store = new BenchmarkStore(dbPath);

  try {
    const result = store.getComparisonResult(id);
    if (!result) {
      // Try prefix match
      const all = store.listComparisons();
      const match = all.find(c => c.id.startsWith(id));
      if (match) {
        const fullResult = store.getComparisonResult(match.id);
        if (fullResult) {
          console.log(formatComparisonResult(fullResult));
          return;
        }
      }
      console.error(`Comparison not found: ${id}`);
      process.exit(1);
    }

    console.log(formatComparisonResult(result));
  } finally {
    store.close();
  }
}
