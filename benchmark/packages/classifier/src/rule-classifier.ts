import {
  TokenCategory,
  RunType,
  type Message,
  type CompletionRequest,
  type CompletionResponse,
  type ContentBlock,
} from '@stigmergy-benchmark/core';
import {
  COORDINATION_PATTERNS,
  CONTENT_TRANSFER_PATTERNS,
  TOOL_DEFINITION_MARKER,
  STIGMERGY_TOOL_NAMES,
} from './categories.js';

/**
 * Rule-based 5-category token classifier.
 *
 * Classification strategy varies by run type:
 * - Run A (single agent): CT=0, MO=0, CI=0. Everything is TR or SI.
 * - Run B (message-passing): MO=0. No protocol layer.
 * - Run C (stigmergy): Full 5-category classification.
 *
 * Implements the MessageClassifier interface from llm-client.
 */
export class RuleClassifier {
  /**
   * Classify an input message into one of the 5 token categories.
   */
  classifyMessage(message: Message, request: CompletionRequest): TokenCategory {
    const runType = request.context.runType;
    const text = this.extractText(message);

    // Run A: single agent — no inter-agent communication
    if (runType === RunType.SINGLE_AGENT) {
      return message.role === 'system'
        ? TokenCategory.SYSTEM_IDENTITY
        : TokenCategory.TASK_REASONING;
    }

    // Tool definitions marker → Mechanism Overhead for stigmergy, Task Reasoning for baseline
    if (text === TOOL_DEFINITION_MARKER) {
      return runType === RunType.STIGMERGY
        ? TokenCategory.MECHANISM_OVERHEAD
        : TokenCategory.TASK_REASONING;
    }

    // System messages
    if (message.role === 'system') {
      // Check if system prompt contains coordination directives
      if (this.matchesAnyPattern(text, COORDINATION_PATTERNS)) {
        return TokenCategory.COORDINATION_INSTRUCTIONS;
      }
      return TokenCategory.SYSTEM_IDENTITY;
    }

    // Tool role messages (tool results)
    if (message.role === 'tool') {
      if (runType === RunType.STIGMERGY) {
        // Check if it's artifact/content data vs protocol overhead
        if (this.isStigmergyToolResult(message)) {
          return this.isContentBearing(text)
            ? TokenCategory.CONTENT_TRANSFER
            : TokenCategory.MECHANISM_OVERHEAD;
        }
      }
      return TokenCategory.TASK_REASONING;
    }

    // Assistant messages
    if (message.role === 'assistant') {
      // Tool use blocks → Mechanism Overhead (stigmergy) or Task Reasoning (baseline)
      if (this.isToolUseOnly(message)) {
        if (runType === RunType.STIGMERGY && this.usesStigmergyTools(message)) {
          return TokenCategory.MECHANISM_OVERHEAD;
        }
        return TokenCategory.TASK_REASONING;
      }
      return TokenCategory.TASK_REASONING;
    }

    // User messages — the most nuanced classification
    if (message.role === 'user') {
      // Run B: check for content transfer (previous agent output injected)
      if (runType === RunType.MESSAGE_PASSING) {
        if (this.matchesAnyPattern(text, CONTENT_TRANSFER_PATTERNS)) {
          return TokenCategory.CONTENT_TRANSFER;
        }
        if (this.matchesAnyPattern(text, COORDINATION_PATTERNS)) {
          return TokenCategory.COORDINATION_INSTRUCTIONS;
        }
      }

      // Run C: check for coordination instructions
      if (runType === RunType.STIGMERGY) {
        if (this.matchesAnyPattern(text, COORDINATION_PATTERNS)) {
          return TokenCategory.COORDINATION_INSTRUCTIONS;
        }
      }

      return TokenCategory.TASK_REASONING;
    }

    return TokenCategory.TASK_REASONING;
  }

  /**
   * Classify the output (assistant response) of an API call.
   */
  classifyOutput(response: CompletionResponse, request: CompletionRequest): TokenCategory {
    const runType = request.context.runType;

    // Run A: always task reasoning
    if (runType === RunType.SINGLE_AGENT) {
      return TokenCategory.TASK_REASONING;
    }

    // Check if output is purely tool calls
    const hasOnlyToolUse = response.content.every(b => b.type === 'tool_use');
    if (hasOnlyToolUse && response.content.length > 0) {
      const usesStigmergy = response.content.some(
        b => b.type === 'tool_use' && b.name && STIGMERGY_TOOL_NAMES.has(b.name),
      );
      if (runType === RunType.STIGMERGY && usesStigmergy) {
        return TokenCategory.MECHANISM_OVERHEAD;
      }
    }

    return TokenCategory.TASK_REASONING;
  }

  private extractText(message: Message): string {
    if (typeof message.content === 'string') return message.content;
    return message.content
      .map(b => b.text ?? b.content ?? (b.input ? JSON.stringify(b.input) : ''))
      .join(' ');
  }

  private matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(text));
  }

  private isStigmergyToolResult(message: Message): boolean {
    if (typeof message.content === 'string') return false;
    return message.content.some(
      b => b.type === 'tool_result' && b.tool_use_id !== undefined,
    );
  }

  private isContentBearing(text: string): boolean {
    // Heuristic: if the text is long (>500 chars) it's likely content, not protocol
    return text.length > 500;
  }

  private isToolUseOnly(message: Message): boolean {
    if (typeof message.content === 'string') return false;
    return message.content.every(b => b.type === 'tool_use');
  }

  private usesStigmergyTools(message: Message): boolean {
    if (typeof message.content === 'string') return false;
    return message.content.some(
      b => b.type === 'tool_use' && b.name !== undefined && STIGMERGY_TOOL_NAMES.has(b.name),
    );
  }
}
