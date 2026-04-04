import { describe, it, expect } from 'vitest';
import { MockLLMClient, TokenTracker, InstrumentedLLMClient } from '../src/index.js';
import { TokenCategory, RunType, type CompletionRequest, type Message, type CompletionResponse } from '@stigmergy-benchmark/core';
import type { MessageClassifier } from '../src/middleware.js';

function makeRequest(overrides?: Partial<CompletionRequest>): CompletionRequest {
  return {
    model: 'test-model',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Write a function to sort an array.' },
    ],
    maxTokens: 1024,
    temperature: 0,
    context: {
      runType: RunType.SINGLE_AGENT,
      runId: 'run-test',
      trialIndex: 0,
      agentId: 'agent-1',
    },
    ...overrides,
  };
}

// ============================================================
// MockLLMClient Tests
// ============================================================

describe('MockLLMClient', () => {
  it('produces deterministic output with seed', async () => {
    const a = new MockLLMClient({ seed: 42 });
    const b = new MockLLMClient({ seed: 42 });
    const req = makeRequest();

    const respA = await a.complete(req);
    const respB = await b.complete(req);

    expect(respA.usage.input_tokens).toBe(respB.usage.input_tokens);
    expect(respA.usage.output_tokens).toBe(respB.usage.output_tokens);
  });

  it('different seeds produce different token counts', async () => {
    const a = new MockLLMClient({ seed: 1 });
    const b = new MockLLMClient({ seed: 2 });
    const req = makeRequest();

    const respA = await a.complete(req);
    const respB = await b.complete(req);

    // Extremely unlikely to be identical with different seeds
    const sameInput = respA.usage.input_tokens === respB.usage.input_tokens;
    const sameOutput = respA.usage.output_tokens === respB.usage.output_tokens;
    expect(sameInput && sameOutput).toBe(false);
  });

  it('applies variance to token counts', async () => {
    const client = new MockLLMClient({
      baseInputTokens: 1000,
      baseOutputTokens: 500,
      variance: 0.2,
      seed: 42,
    });

    const tokens: number[] = [];
    const req = makeRequest();
    for (let i = 0; i < 20; i++) {
      const resp = await client.complete(req);
      tokens.push(resp.usage.input_tokens);
    }

    // Should have variation (not all the same)
    const unique = new Set(tokens);
    expect(unique.size).toBeGreaterThan(1);

    // Should be within ±20% of 1000
    for (const t of tokens) {
      expect(t).toBeGreaterThanOrEqual(800);
      expect(t).toBeLessThanOrEqual(1200);
    }
  });

  it('tracks call count', async () => {
    const client = new MockLLMClient({ seed: 1 });
    expect(client.callCount).toBe(0);
    await client.complete(makeRequest());
    expect(client.callCount).toBe(1);
    await client.complete(makeRequest());
    expect(client.callCount).toBe(2);
  });

  it('supports custom response generator', async () => {
    const client = new MockLLMClient({
      seed: 1,
      responseGenerator: (_req, idx) => ({
        content: [{ type: 'text', text: `Custom response ${idx}` }],
      }),
    });

    const resp = await client.complete(makeRequest());
    expect(resp.content[0].text).toBe('Custom response 0');
  });

  it('resets state correctly', async () => {
    const client = new MockLLMClient({ seed: 42 });
    const req = makeRequest();

    const resp1 = await client.complete(req);
    client.reset();
    const resp2 = await client.complete(req);

    expect(resp1.usage.input_tokens).toBe(resp2.usage.input_tokens);
    expect(client.callCount).toBe(1);
  });
});

// ============================================================
// TokenTracker Tests
// ============================================================

describe('TokenTracker', () => {
  it('records and retrieves token usage', () => {
    const tracker = new TokenTracker();
    tracker.record(
      [
        { category: TokenCategory.TASK_REASONING, inputTokens: 100, outputTokens: 50 },
        { category: TokenCategory.SYSTEM_IDENTITY, inputTokens: 30, outputTokens: 0 },
      ],
      { runType: RunType.SINGLE_AGENT, runId: 'run-1', trialIndex: 0, agentId: 'agent-1' },
      { provider: 'mock', model: 'test', cachedInputTokens: 0, requestId: 'req-1' },
    );

    const records = tracker.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0].category).toBe(TokenCategory.TASK_REASONING);
    expect(records[1].category).toBe(TokenCategory.SYSTEM_IDENTITY);
  });

  it('computes totals by category', () => {
    const tracker = new TokenTracker();
    for (let i = 0; i < 3; i++) {
      tracker.record(
        [{ category: TokenCategory.TASK_REASONING, inputTokens: 100, outputTokens: 50 }],
        { runType: RunType.SINGLE_AGENT, runId: 'run-1', trialIndex: 0, agentId: 'agent-1' },
        { provider: 'mock', model: 'test', cachedInputTokens: 0, requestId: `req-${i}` },
      );
    }

    const totals = tracker.getTotalByCategory();
    const tr = totals.get(TokenCategory.TASK_REASONING)!;
    expect(tr.input).toBe(300);
    expect(tr.output).toBe(150);
    expect(tr.total).toBe(450);
  });

  it('computes overall total', () => {
    const tracker = new TokenTracker();
    tracker.record(
      [
        { category: TokenCategory.TASK_REASONING, inputTokens: 100, outputTokens: 50 },
        { category: TokenCategory.SYSTEM_IDENTITY, inputTokens: 30, outputTokens: 0 },
      ],
      { runType: RunType.SINGLE_AGENT, runId: 'run-1', trialIndex: 0, agentId: 'agent-1' },
      { provider: 'mock', model: 'test', cachedInputTokens: 0, requestId: 'req-1' },
    );

    expect(tracker.getTotalTokens()).toBe(180);
  });
});

// ============================================================
// InstrumentedLLMClient Tests
// ============================================================

describe('InstrumentedLLMClient', () => {
  /** Simple classifier that uses run-type overrides correctly. */
  const simpleClassifier: MessageClassifier = {
    classifyMessage(message: Message, request: CompletionRequest): TokenCategory {
      if (request.context.runType === RunType.SINGLE_AGENT) {
        return message.role === 'system'
          ? TokenCategory.SYSTEM_IDENTITY
          : TokenCategory.TASK_REASONING;
      }
      if (message.role === 'system') return TokenCategory.SYSTEM_IDENTITY;
      return TokenCategory.TASK_REASONING;
    },
    classifyOutput(_response: CompletionResponse, _request: CompletionRequest): TokenCategory {
      return TokenCategory.TASK_REASONING;
    },
  };

  it('tracks tokens through the middleware', async () => {
    const mock = new MockLLMClient({ seed: 42, baseInputTokens: 500, baseOutputTokens: 200, variance: 0 });
    const tracker = new TokenTracker();
    const instrumented = new InstrumentedLLMClient(mock, simpleClassifier, tracker, 'mock', 'test');

    await instrumented.complete(makeRequest());

    const records = tracker.getRecords();
    expect(records.length).toBeGreaterThan(0);

    const totalTracked = tracker.getTotalTokens();
    expect(totalTracked).toBe(700); // 500 input + 200 output
  });

  it('preserves the inner client response', async () => {
    const mock = new MockLLMClient({
      seed: 42,
      responseGenerator: () => ({
        content: [{ type: 'text', text: 'Hello from inner' }],
      }),
    });
    const tracker = new TokenTracker();
    const instrumented = new InstrumentedLLMClient(mock, simpleClassifier, tracker, 'mock', 'test');

    const resp = await instrumented.complete(makeRequest());
    expect(resp.content[0].text).toBe('Hello from inner');
  });

  it('classifies system messages as SYSTEM_IDENTITY for single agent', async () => {
    const mock = new MockLLMClient({ seed: 42, variance: 0 });
    const tracker = new TokenTracker();
    const instrumented = new InstrumentedLLMClient(mock, simpleClassifier, tracker, 'mock', 'test');

    await instrumented.complete(makeRequest());

    const byCategory = tracker.getTotalByCategory();
    expect(byCategory.has(TokenCategory.SYSTEM_IDENTITY)).toBe(true);
    expect(byCategory.has(TokenCategory.TASK_REASONING)).toBe(true);
  });

  it('validates token sum invariant', async () => {
    const mock = new MockLLMClient({ seed: 42, variance: 0 });
    const tracker = new TokenTracker();
    const instrumented = new InstrumentedLLMClient(mock, simpleClassifier, tracker, 'mock', 'test');

    await instrumented.complete(makeRequest());

    const records = tracker.getRecords();
    const totalInput = records.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutput = records.reduce((s, r) => s + r.outputTokens, 0);
    // Should sum to 500 + 200 = 700
    expect(totalInput + totalOutput).toBe(700);
  });
});
