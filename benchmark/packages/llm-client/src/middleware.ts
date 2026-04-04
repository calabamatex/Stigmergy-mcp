import type {
  CompletionRequest,
  CompletionResponse,
  Message,
  TokenCategory,
} from '@stigmergy-benchmark/core';
import type { LLMClient } from './client.js';
import { TokenTracker, type CategoryTokens } from './token-tracker.js';

/**
 * Classifies a message into a token category.
 * This interface is implemented by the classifier package.
 */
export interface MessageClassifier {
  classifyMessage(message: Message, request: CompletionRequest): TokenCategory;
  classifyOutput(response: CompletionResponse, request: CompletionRequest): TokenCategory;
}

/**
 * Wraps an LLMClient with token classification and tracking.
 *
 * For each API call:
 * 1. Classifies each input message into one of 5 categories
 * 2. Allocates input tokens proportionally by character count
 * 3. Classifies the output
 * 4. Validates that 5 categories sum to provider-reported total
 * 5. Records everything in the TokenTracker
 */
export class InstrumentedLLMClient implements LLMClient {
  private callCount = 0;

  constructor(
    private inner: LLMClient,
    private classifier: MessageClassifier,
    private tracker: TokenTracker,
    private provider: string,
    private model: string,
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await this.inner.complete(request);
    const requestId = `call-${this.callCount++}`;

    // Classify and allocate input tokens
    const inputCategories = this.classifyInputTokens(request, response);

    // Classify output tokens
    const outputCategory = this.classifier.classifyOutput(response, request);

    // Build category -> tokens mapping
    const categoryMap = new Map<TokenCategory, { input: number; output: number }>();

    for (const { category, tokens } of inputCategories) {
      const existing = categoryMap.get(category) ?? { input: 0, output: 0 };
      existing.input += tokens;
      categoryMap.set(category, existing);
    }

    const existingOutput = categoryMap.get(outputCategory) ?? { input: 0, output: 0 };
    existingOutput.output += response.usage.output_tokens;
    categoryMap.set(outputCategory, existingOutput);

    // Validate invariant: 5 categories sum to provider total
    const totalClassifiedInput = [...categoryMap.values()].reduce((s, v) => s + v.input, 0);
    const totalClassifiedOutput = [...categoryMap.values()].reduce((s, v) => s + v.output, 0);
    const providerTotal = response.usage.input_tokens + response.usage.output_tokens;
    const classifiedTotal = totalClassifiedInput + totalClassifiedOutput;

    if (Math.abs(classifiedTotal - providerTotal) > 1) {
      throw new Error(
        `Token classification invariant violated: classified=${classifiedTotal} vs provider=${providerTotal} ` +
        `(input: ${totalClassifiedInput}/${response.usage.input_tokens}, output: ${totalClassifiedOutput}/${response.usage.output_tokens})`,
      );
    }

    // Record in tracker
    const categories: CategoryTokens[] = [...categoryMap.entries()].map(
      ([category, { input, output }]) => ({
        category,
        inputTokens: input,
        outputTokens: output,
      }),
    );

    this.tracker.record(categories, request.context, {
      provider: this.provider,
      model: this.model,
      cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      requestId,
    });

    return response;
  }

  /**
   * Classify input messages and allocate the provider's total input tokens
   * proportionally by character count.
   */
  private classifyInputTokens(
    request: CompletionRequest,
    response: CompletionResponse,
  ): Array<{ category: TokenCategory; tokens: number }> {
    const totalInputTokens = response.usage.input_tokens;

    // Compute character count per message
    const messageLengths = request.messages.map(m => {
      if (typeof m.content === 'string') return m.content.length;
      return m.content.reduce((sum, block) => {
        return sum + (block.text?.length ?? 0) + (block.content?.length ?? 0)
          + (block.input ? JSON.stringify(block.input).length : 0)
          + (block.name?.length ?? 0);
      }, 0);
    });

    // Add tool definition tokens if present
    const toolDefLength = request.tools
      ? JSON.stringify(request.tools).length
      : 0;

    const totalChars = messageLengths.reduce((a, b) => a + b, 0) + toolDefLength;

    if (totalChars === 0) {
      // Edge case: empty messages. Assign all to task reasoning.
      return [{ category: 'TASK_REASONING' as TokenCategory, tokens: totalInputTokens }];
    }

    const results: Array<{ category: TokenCategory; tokens: number }> = [];
    let allocated = 0;

    // Classify each message and proportionally allocate tokens
    for (let i = 0; i < request.messages.length; i++) {
      const category = this.classifier.classifyMessage(request.messages[i], request);
      const proportion = messageLengths[i] / totalChars;
      const tokens = Math.round(totalInputTokens * proportion);
      allocated += tokens;
      results.push({ category, tokens });
    }

    // Tool definitions → mechanism overhead (for stigmergy runs) or task reasoning
    if (toolDefLength > 0) {
      const toolCategory = this.classifier.classifyMessage(
        { role: 'system', content: '[tool-definitions]' },
        request,
      );
      const toolTokens = totalInputTokens - allocated;
      results.push({ category: toolCategory, tokens: Math.max(0, toolTokens) });
    } else if (allocated < totalInputTokens) {
      // Rounding remainder goes to last category
      results[results.length - 1].tokens += totalInputTokens - allocated;
    }

    return results;
  }
}
