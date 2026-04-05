import type { CompletionRequest, CompletionResponse, ContentBlock } from '@stigmergy-benchmark/core';
import type { LLMClient } from './client.js';
import { ApiError } from './errors.js';

/**
 * Anthropic API client. Makes real API calls to Claude models.
 * Requires ANTHROPIC_API_KEY environment variable or explicit apiKey.
 */
export class AnthropicClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.baseUrl = baseUrl ?? 'https://api.anthropic.com';
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Separate system message from conversation messages
    const systemMessages = request.messages.filter(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');

    const systemText = systemMessages
      .map(m => typeof m.content === 'string' ? m.content : m.content.map(b => b.text ?? '').join(''))
      .join('\n');

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages: conversationMessages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })),
    };

    if (systemText) {
      body.system = systemText;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(response.status, errorBody, 'Anthropic');
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
      stop_reason: string;
    };

    const content: ContentBlock[] = data.content.map(block => ({
      type: block.type as ContentBlock['type'],
      text: block.text,
      id: block.id,
      name: block.name,
      input: block.input,
    }));

    return {
      content,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        cache_read_input_tokens: data.usage.cache_read_input_tokens,
      },
      stopReason: data.stop_reason,
    };
  }
}
