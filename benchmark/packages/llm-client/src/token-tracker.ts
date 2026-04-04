import {
  type TokenUsageRecord,
  type TokenCategory,
  type RunType,
  type RunContext,
} from '@stigmergy-benchmark/core';

export interface CategoryTokens {
  category: TokenCategory;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Accumulates token usage records per API call.
 * Each record is tagged with the run context (runId, trialIndex, agentId, runType).
 */
export class TokenTracker {
  private records: TokenUsageRecord[] = [];

  record(
    categories: CategoryTokens[],
    context: RunContext,
    metadata: { provider: string; model: string; cachedInputTokens: number; requestId: string },
  ): void {
    for (const cat of categories) {
      this.records.push({
        id: `${context.runId}-${metadata.requestId}-${cat.category}`,
        runId: context.runId,
        trialIndex: context.trialIndex,
        agentId: context.agentId,
        requestId: metadata.requestId,
        category: cat.category,
        inputTokens: cat.inputTokens,
        outputTokens: cat.outputTokens,
        totalTokens: cat.inputTokens + cat.outputTokens,
        cachedInputTokens: metadata.cachedInputTokens,
        provider: metadata.provider,
        model: metadata.model,
        timestamp: Date.now(),
        runType: context.runType as RunType,
        cacheHit: metadata.cachedInputTokens > 0,
      });
    }
  }

  getRecords(): TokenUsageRecord[] {
    return [...this.records];
  }

  getTotalByCategory(): Map<TokenCategory, { input: number; output: number; total: number }> {
    const map = new Map<TokenCategory, { input: number; output: number; total: number }>();
    for (const rec of this.records) {
      const existing = map.get(rec.category) ?? { input: 0, output: 0, total: 0 };
      existing.input += rec.inputTokens;
      existing.output += rec.outputTokens;
      existing.total += rec.totalTokens;
      map.set(rec.category, existing);
    }
    return map;
  }

  getTotalTokens(): number {
    return this.records.reduce((sum, r) => sum + r.totalTokens, 0);
  }

  reset(): void {
    this.records = [];
  }
}
