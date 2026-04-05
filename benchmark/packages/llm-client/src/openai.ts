import type { CompletionRequest, CompletionResponse, ContentBlock } from '@stigmergy-benchmark/core';
import type { LLMClient } from './client.js';
import { ApiError } from './errors.js';

/**
 * OpenAI API client. Makes real API calls to GPT models.
 * Requires OPENAI_API_KEY environment variable or explicit apiKey.
 */
export class OpenAIClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.baseUrl = baseUrl ?? 'https://api.openai.com';
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = request.messages.map(m => ({
      role: m.role === 'tool' ? ('user' as const) : m.role,
      content: typeof m.content === 'string'
        ? m.content
        : m.content.map(b => b.text ?? '').join(''),
    }));

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(response.status, errorBody, 'OpenAI');
    }

    const data = await response.json() as {
      choices: Array<{
        message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices[0];
    const content: ContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      content,
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
      },
      stopReason: choice.finish_reason,
    };
  }
}
