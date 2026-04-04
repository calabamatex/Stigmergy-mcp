import type { CompletionRequest, CompletionResponse, ContentBlock } from '@stigmergy-benchmark/core';
import type { LLMClient } from './client.js';

export interface MockLLMConfig {
  /** Base input tokens per call (before variance). */
  baseInputTokens: number;
  /** Base output tokens per call (before variance). */
  baseOutputTokens: number;
  /** Variance factor: actual = base * (1 + uniform(-variance, +variance)). Default 0.2 (±20%). */
  variance: number;
  /** Fixed seed for deterministic output. */
  seed?: number;
  /** Custom response generator. If provided, overrides default text responses. */
  responseGenerator?: (request: CompletionRequest, callIndex: number) => MockResponse;
}

export interface MockResponse {
  content: ContentBlock[];
  stopReason?: string;
}

const DEFAULT_CONFIG: MockLLMConfig = {
  baseInputTokens: 500,
  baseOutputTokens: 200,
  variance: 0.2,
};

/**
 * Mock LLM client for development and testing.
 * Produces deterministic (when seeded) responses with configurable token variance.
 * Simulates the natural ±15-25% token count variance seen in real LLM calls.
 */
export class MockLLMClient implements LLMClient {
  private config: MockLLMConfig;
  private callIndex: number = 0;
  private rngState: number;

  constructor(config?: Partial<MockLLMConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rngState = this.config.seed ?? Math.floor(Math.random() * 2147483647);
  }

  /** Simple seeded PRNG (mulberry32). Returns [0, 1). */
  private nextRandom(): number {
    let t = (this.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Apply variance: base * (1 + uniform(-v, +v)). */
  private applyVariance(base: number): number {
    const factor = 1 + (this.nextRandom() * 2 - 1) * this.config.variance;
    return Math.max(1, Math.round(base * factor));
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const idx = this.callIndex++;

    let content: ContentBlock[];
    let stopReason = 'end_turn';

    if (this.config.responseGenerator) {
      const resp = this.config.responseGenerator(request, idx);
      content = resp.content;
      stopReason = resp.stopReason ?? 'end_turn';
    } else {
      // Check if the request includes tools and randomly decide to use one
      const hasTools = request.tools && request.tools.length > 0;
      const useToolCall = hasTools && this.nextRandom() > 0.6;

      if (useToolCall && request.tools) {
        const tool = request.tools[Math.floor(this.nextRandom() * request.tools.length)];
        content = [
          {
            type: 'tool_use',
            id: `mock-tool-${idx}`,
            name: tool.name,
            input: {},
          },
        ];
        stopReason = 'tool_use';
      } else {
        content = [
          {
            type: 'text',
            text: `Mock response #${idx} for agent ${request.context.agentId}. ` +
              `Processing ${request.messages.length} messages.`,
          },
        ];
      }
    }

    const inputTokens = this.applyVariance(this.config.baseInputTokens);
    const outputTokens = this.applyVariance(this.config.baseOutputTokens);
    const cachedTokens = request.context.trialIndex > 0
      ? Math.round(inputTokens * 0.3 * this.nextRandom())
      : 0;

    return {
      content,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: cachedTokens,
      },
      stopReason,
    };
  }

  /** Returns how many calls have been made. */
  get callCount(): number {
    return this.callIndex;
  }

  /** Reset call counter and PRNG state. */
  reset(): void {
    this.callIndex = 0;
    this.rngState = this.config.seed ?? Math.floor(Math.random() * 2147483647);
  }
}
