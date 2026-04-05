import type { CompletionRequest, CompletionResponse } from '@stigmergy-benchmark/core';
import type { LLMClient } from './client.js';
import { ApiError } from './errors.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Decorator that wraps any LLMClient with retry logic for transient errors.
 * Uses jittered exponential backoff: delay = min(base * 2^attempt + jitter, max).
 *
 * Retries on: 429 (rate limit), 500/502/503/529 (server errors), network errors.
 * Does NOT retry: 400/401/403/404 (client errors that won't succeed on retry).
 */
export class RetryLLMClient implements LLMClient {
  private config: RetryConfig;

  constructor(
    private inner: LLMClient,
    config?: Partial<RetryConfig>,
  ) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.inner.complete(request);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!this.isRetryable(lastError)) {
          throw lastError;
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.computeDelay(attempt);
          await sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private isRetryable(error: Error): boolean {
    if (error instanceof ApiError) {
      return error.retryable;
    }
    // Network errors (fetch failures) are retryable
    if (error instanceof TypeError) {
      return true;
    }
    return false;
  }

  private computeDelay(attempt: number): number {
    const expDelay = this.config.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * this.config.baseDelayMs * 0.25;
    return Math.min(expDelay + jitter, this.config.maxDelayMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
