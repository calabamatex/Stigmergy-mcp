import { describe, it, expect } from 'vitest';
import { RuleClassifier } from '../src/rule-classifier.js';
import {
  TokenCategory,
  RunType,
  type CompletionRequest,
  type CompletionResponse,
  type Message,
} from '@stigmergy-benchmark/core';

const classifier = new RuleClassifier();

function makeRequest(
  runType: RunType,
  messages: Message[] = [],
): CompletionRequest {
  return {
    model: 'test',
    messages,
    maxTokens: 1024,
    temperature: 0,
    context: {
      runType,
      runId: 'test-run',
      trialIndex: 0,
      agentId: 'agent-1',
    },
  };
}

// ============================================================
// Run A: Single Agent
// ============================================================

describe('Run A (Single Agent)', () => {
  it('classifies system messages as SYSTEM_IDENTITY', () => {
    const msg: Message = { role: 'system', content: 'You are a code reviewer.' };
    const req = makeRequest(RunType.SINGLE_AGENT, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.SYSTEM_IDENTITY);
  });

  it('classifies user messages as TASK_REASONING', () => {
    const msg: Message = { role: 'user', content: 'Review this code for bugs.' };
    const req = makeRequest(RunType.SINGLE_AGENT, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.TASK_REASONING);
  });

  it('classifies assistant messages as TASK_REASONING', () => {
    const msg: Message = { role: 'assistant', content: 'I found a bug on line 42.' };
    const req = makeRequest(RunType.SINGLE_AGENT, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.TASK_REASONING);
  });

  it('classifies output as TASK_REASONING', () => {
    const resp: CompletionResponse = {
      content: [{ type: 'text', text: 'analysis output' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stopReason: 'end_turn',
    };
    const req = makeRequest(RunType.SINGLE_AGENT);
    expect(classifier.classifyOutput(resp, req)).toBe(TokenCategory.TASK_REASONING);
  });
});

// ============================================================
// Run B: Message-Passing Swarm
// ============================================================

describe('Run B (Message-Passing)', () => {
  it('classifies system prompt as SYSTEM_IDENTITY', () => {
    const msg: Message = { role: 'system', content: 'You are a code reviewer. Focus on security issues.' };
    const req = makeRequest(RunType.MESSAGE_PASSING, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.SYSTEM_IDENTITY);
  });

  it('classifies system prompt with coordination as COORDINATION_INSTRUCTIONS', () => {
    const msg: Message = {
      role: 'system',
      content: 'You are agent 2 of 3. Your role is to review what Agent 1 found and continue the analysis.',
    };
    const req = makeRequest(RunType.MESSAGE_PASSING, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.COORDINATION_INSTRUCTIONS);
  });

  it('classifies user message with previous agent output as CONTENT_TRANSFER', () => {
    const msg: Message = {
      role: 'user',
      content: "Here is the output produced by Agent 1:\n```\nfunction sort(arr) { return arr.sort(); }\n```",
    };
    const req = makeRequest(RunType.MESSAGE_PASSING, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.CONTENT_TRANSFER);
  });

  it('classifies user coordination text as COORDINATION_INSTRUCTIONS', () => {
    const msg: Message = {
      role: 'user',
      content: 'The previous agent produced the following analysis. Please continue from where they left off.',
    };
    const req = makeRequest(RunType.MESSAGE_PASSING, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.COORDINATION_INSTRUCTIONS);
  });

  it('classifies plain user task prompt as TASK_REASONING', () => {
    const msg: Message = {
      role: 'user',
      content: 'Analyze this codebase for performance issues.',
    };
    const req = makeRequest(RunType.MESSAGE_PASSING, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.TASK_REASONING);
  });

  it('classifies output as TASK_REASONING (MO=0 for baseline)', () => {
    const resp: CompletionResponse = {
      content: [{ type: 'text', text: 'My analysis...' }],
      usage: { input_tokens: 200, output_tokens: 100 },
      stopReason: 'end_turn',
    };
    const req = makeRequest(RunType.MESSAGE_PASSING);
    expect(classifier.classifyOutput(resp, req)).toBe(TokenCategory.TASK_REASONING);
  });
});

// ============================================================
// Run C: Stigmergy Swarm
// ============================================================

describe('Run C (Stigmergy)', () => {
  it('classifies system prompt as SYSTEM_IDENTITY', () => {
    const msg: Message = { role: 'system', content: 'You are a code reviewer.' };
    const req = makeRequest(RunType.STIGMERGY, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.SYSTEM_IDENTITY);
  });

  it('classifies system prompt with tool instructions as COORDINATION_INSTRUCTIONS', () => {
    const msg: Message = {
      role: 'system',
      content: 'Use these tools in order: 1. sense_environment to check for signals, 2. deposit_trace when done.',
    };
    const req = makeRequest(RunType.STIGMERGY, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.COORDINATION_INSTRUCTIONS);
  });

  it('classifies tool definitions as MECHANISM_OVERHEAD', () => {
    const msg: Message = { role: 'system', content: '[tool-definitions]' };
    const req = makeRequest(RunType.STIGMERGY, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.MECHANISM_OVERHEAD);
  });

  it('classifies tool definitions as TASK_REASONING for baseline', () => {
    const msg: Message = { role: 'system', content: '[tool-definitions]' };
    const req = makeRequest(RunType.MESSAGE_PASSING, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.TASK_REASONING);
  });

  it('classifies stigmergy tool_use output as MECHANISM_OVERHEAD', () => {
    const resp: CompletionResponse = {
      content: [{
        type: 'tool_use',
        id: 'call-1',
        name: 'deposit_trace',
        input: { area: 'src/', action: 'reviewed code' },
      }],
      usage: { input_tokens: 200, output_tokens: 50 },
      stopReason: 'tool_use',
    };
    const req = makeRequest(RunType.STIGMERGY);
    expect(classifier.classifyOutput(resp, req)).toBe(TokenCategory.MECHANISM_OVERHEAD);
  });

  it('classifies non-stigmergy tool_use output as TASK_REASONING', () => {
    const resp: CompletionResponse = {
      content: [{
        type: 'tool_use',
        id: 'call-1',
        name: 'read_file',
        input: { path: 'src/index.ts' },
      }],
      usage: { input_tokens: 200, output_tokens: 50 },
      stopReason: 'tool_use',
    };
    const req = makeRequest(RunType.STIGMERGY);
    expect(classifier.classifyOutput(resp, req)).toBe(TokenCategory.TASK_REASONING);
  });

  it('classifies text output as TASK_REASONING', () => {
    const resp: CompletionResponse = {
      content: [{ type: 'text', text: 'I analyzed the code and found...' }],
      usage: { input_tokens: 200, output_tokens: 100 },
      stopReason: 'end_turn',
    };
    const req = makeRequest(RunType.STIGMERGY);
    expect(classifier.classifyOutput(resp, req)).toBe(TokenCategory.TASK_REASONING);
  });

  it('classifies user coordination message as COORDINATION_INSTRUCTIONS', () => {
    const msg: Message = {
      role: 'user',
      content: 'Check the blackboard for signals before starting your task.',
    };
    const req = makeRequest(RunType.STIGMERGY, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.COORDINATION_INSTRUCTIONS);
  });

  it('classifies plain user task as TASK_REASONING', () => {
    const msg: Message = {
      role: 'user',
      content: 'Analyze this code for bugs.',
    };
    const req = makeRequest(RunType.STIGMERGY, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.TASK_REASONING);
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe('Edge cases', () => {
  it('handles empty content blocks', () => {
    const msg: Message = { role: 'user', content: [] };
    const req = makeRequest(RunType.SINGLE_AGENT, [msg]);
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.TASK_REASONING);
  });

  it('handles mixed content blocks', () => {
    const msg: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me check the environment.' },
        { type: 'tool_use', id: 'call-1', name: 'sense_environment', input: { area: 'src/' } },
      ],
    };
    const req = makeRequest(RunType.STIGMERGY, [msg]);
    // Mixed content (text + tool_use) → not tool-use-only, so TASK_REASONING
    expect(classifier.classifyMessage(msg, req)).toBe(TokenCategory.TASK_REASONING);
  });
});
