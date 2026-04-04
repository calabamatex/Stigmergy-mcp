import type { CompletionRequest, CompletionResponse } from '@stigmergy-benchmark/core';

/**
 * Provider-agnostic LLM client interface.
 * All implementations (Anthropic, OpenAI, Mock) conform to this.
 */
export interface LLMClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
