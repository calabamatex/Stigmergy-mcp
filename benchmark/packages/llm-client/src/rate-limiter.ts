import type { CompletionRequest, CompletionResponse } from '@stigmergy-benchmark/core';
import type { LLMClient } from './client.js';

export interface RateLimitConfig {
  /** Maximum total tokens across the entire comparison. 0 = unlimited. */
  maxTotalTokens: number;
  /** Minimum delay between API calls in ms. Default 0. */
  minDelayBetweenCallsMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTotalTokens: 0,
  minDelayBetweenCallsMs: 0,
};

export class BudgetExhaustedError extends Error {
  constructor(
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(`Token budget exhausted: ${used}/${limit} tokens used`);
    this.name = 'BudgetExhaustedError';
  }
}

/**
 * Decorator that enforces token budgets and call pacing.
 * Compose after RetryLLMClient: RateLimitedLLMClient(RetryLLMClient(AnthropicClient))
 */
export class RateLimitedLLMClient implements LLMClient {
  private config: RateLimitConfig;
  private totalTokensUsed = 0;
  private lastCallTime = 0;

  constructor(
    private inner: LLMClient,
    config?: Partial<RateLimitConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Check budget before calling
    if (this.config.maxTotalTokens > 0 && this.totalTokensUsed >= this.config.maxTotalTokens) {
      throw new BudgetExhaustedError(this.totalTokensUsed, this.config.maxTotalTokens);
    }

    // Enforce minimum delay between calls
    if (this.config.minDelayBetweenCallsMs > 0) {
      const elapsed = Date.now() - this.lastCallTime;
      const remaining = this.config.minDelayBetweenCallsMs - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
    }

    this.lastCallTime = Date.now();
    const response = await this.inner.complete(request);

    // Track token usage
    const tokens = response.usage.input_tokens + response.usage.output_tokens;
    this.totalTokensUsed += tokens;

    return response;
  }

  getUsage(): { tokens: number; limit: number; percent: number } {
    const limit = this.config.maxTotalTokens;
    return {
      tokens: this.totalTokensUsed,
      limit,
      percent: limit > 0 ? (this.totalTokensUsed / limit) * 100 : 0,
    };
  }

  isOverBudget(): boolean {
    return this.config.maxTotalTokens > 0 && this.totalTokensUsed >= this.config.maxTotalTokens;
  }
}
