import { describe, it, expect } from 'vitest';
import { RetryLLMClient } from '../src/retry.js';
import { ApiError } from '../src/errors.js';
import type { LLMClient } from '../src/client.js';
import type { CompletionRequest, CompletionResponse } from '@stigmergy-benchmark/core';
import { RunType } from '@stigmergy-benchmark/core';

function makeRequest(): CompletionRequest {
  return {
    model: 'test',
    messages: [{ role: 'user', content: 'test' }],
    maxTokens: 100,
    temperature: 0,
    context: { runType: RunType.SINGLE_AGENT, runId: 'r1', trialIndex: 0, agentId: 'a1' },
  };
}

const OK_RESPONSE: CompletionResponse = {
  content: [{ type: 'text', text: 'ok' }],
  usage: { input_tokens: 10, output_tokens: 5 },
  stopReason: 'end_turn',
};

function makeFailingClient(failures: number, statusCode: number): LLMClient {
  let callCount = 0;
  return {
    async complete() {
      callCount++;
      if (callCount <= failures) {
        throw new ApiError(statusCode, 'error', 'Test');
      }
      return OK_RESPONSE;
    },
  };
}

describe('RetryLLMClient', () => {
  it('passes through successful calls', async () => {
    const inner = makeFailingClient(0, 500);
    const retry = new RetryLLMClient(inner, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    const resp = await retry.complete(makeRequest());
    expect(resp.content[0].text).toBe('ok');
  });

  it('retries on transient error and succeeds', async () => {
    const inner = makeFailingClient(2, 429);
    const retry = new RetryLLMClient(inner, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    const resp = await retry.complete(makeRequest());
    expect(resp.content[0].text).toBe('ok');
  });

  it('exhausts retries and throws', async () => {
    const inner = makeFailingClient(10, 500);
    const retry = new RetryLLMClient(inner, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 });
    await expect(retry.complete(makeRequest())).rejects.toThrow('Test API error 500');
  });

  it('does not retry non-retryable errors (401)', async () => {
    let calls = 0;
    const inner: LLMClient = {
      async complete() {
        calls++;
        throw new ApiError(401, 'unauthorized', 'Test');
      },
    };
    const retry = new RetryLLMClient(inner, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    await expect(retry.complete(makeRequest())).rejects.toThrow('401');
    expect(calls).toBe(1); // Only called once, no retries
  });

  it('does not retry 400 errors', async () => {
    let calls = 0;
    const inner: LLMClient = {
      async complete() {
        calls++;
        throw new ApiError(400, 'bad request', 'Test');
      },
    };
    const retry = new RetryLLMClient(inner, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    await expect(retry.complete(makeRequest())).rejects.toThrow('400');
    expect(calls).toBe(1);
  });

  it('retries on 502/503/529', async () => {
    for (const code of [502, 503, 529]) {
      const inner = makeFailingClient(1, code);
      const retry = new RetryLLMClient(inner, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 });
      const resp = await retry.complete(makeRequest());
      expect(resp.content[0].text).toBe('ok');
    }
  });
});
