import { describe, it, expect } from 'vitest';
import { ComparisonEngine, crossValidateTrial } from '../src/index.js';
import { BenchmarkStore } from '@stigmergy-benchmark/storage';
import { MockLLMClient } from '@stigmergy-benchmark/llm-client';
import { RunType, ReportingLevel, type RunResult, type ComparisonConfig, TaskCategory, TaskDifficulty, type BenchmarkTask } from '@stigmergy-benchmark/core';

const testTask: BenchmarkTask = {
  id: 'test-task',
  name: 'Test Task',
  description: 'A simple test task.',
  category: TaskCategory.SEQUENTIAL,
  difficulty: TaskDifficulty.SIMPLE,
  agentCount: 2,
  steps: [
    { id: 's1', agentRole: 'writer', description: 'Write content', dependsOn: [], expectedOutputTokenRange: [50, 200] },
    { id: 's2', agentRole: 'reviewer', description: 'Review content', dependsOn: ['s1'], expectedOutputTokenRange: [50, 200] },
  ],
  expectedCoordinationPoints: 1,
  userPrompt: 'Write and review a short paragraph about testing.',
  singleAgentPrompt: 'Write a short paragraph about testing, then review it.',
  crossoverTask: false,
  equivalenceMargin: 5,
};

const config: ComparisonConfig = {
  trialCount: 3,
  provider: 'mock',
  model: 'mock-model',
  temperature: 0,
  promptCachingEnabled: false,
  skipSingleAgent: false,
};

// ============================================================
// Cross-Validation Tests
// ============================================================

describe('crossValidateTrial', () => {
  function makeRun(total: number, interAgent: number, runType: RunType): RunResult {
    return {
      runType, runId: 'test',
      contentTransferTokens: interAgent,
      mechanismOverheadTokens: 0,
      coordinationInstructionsTokens: 0,
      taskReasoningTokens: total - interAgent,
      systemIdentityTokens: 0,
      interAgentTokens: interAgent,
      agentAutonomousTokens: total - interAgent,
      totalTokens: total,
      cachedTokens: 0, effectiveTokens: total, cacheHitRate: 0,
      wallClockMs: 1000, agentCount: 1, apiCallCount: 1,
      success: true, output: null, tokenLog: [],
    };
  }

  it('computes drift correctly', () => {
    const runA = makeRun(1000, 0, RunType.SINGLE_AGENT);
    const runB = makeRun(2000, 800, RunType.MESSAGE_PASSING);
    const runC = makeRun(1500, 300, RunType.STIGMERGY);

    const cv = crossValidateTrial(runA, runB, runC);

    // Expected inter-agent B = 2000 - 1000 = 1000, classified = 800
    // drift = |1000 - 800| / 2000 = 0.1
    expect(cv.classifierDriftB).toBeCloseTo(0.1, 4);

    // Expected inter-agent C = 1500 - 1000 = 500, classified = 300
    // drift = |500 - 300| / 1500 = 0.133
    expect(cv.classifierDriftC).toBeCloseTo(0.1333, 3);
  });

  it('handles zero total gracefully', () => {
    const runA = makeRun(0, 0, RunType.SINGLE_AGENT);
    const runB = makeRun(0, 0, RunType.MESSAGE_PASSING);
    const runC = makeRun(0, 0, RunType.STIGMERGY);

    const cv = crossValidateTrial(runA, runB, runC);
    expect(cv.classifierDriftB).toBe(0);
    expect(cv.classifierDriftC).toBe(0);
  });
});

// ============================================================
// ComparisonEngine Tests
// ============================================================

describe('ComparisonEngine', () => {
  it('runs n trials and produces a ComparisonResult', async () => {
    const store = new BenchmarkStore(':memory:');
    const client = new MockLLMClient({ seed: 42, variance: 0 });
    const engine = new ComparisonEngine(store, client);

    const result = await engine.runComparison(testTask, config);

    expect(result.trials.length).toBe(3);
    expect(result.taskId).toBe('test-task');
    expect(result.stats.trialCount).toBe(3);
    expect(result.stats.reportingLevel).toBe(ReportingLevel.PROVISIONAL);
    expect(result.crossValidationCalibration).toBeDefined();

    store.close();
  });

  it('fires progressive callbacks', async () => {
    const store = new BenchmarkStore(':memory:');
    const client = new MockLLMClient({ seed: 42, variance: 0 });
    const engine = new ComparisonEngine(store, client);

    const trialStarts: number[] = [];
    const trialCompletes: number[] = [];

    await engine.runComparison(testTask, config, {
      onTrialStart: (idx) => trialStarts.push(idx),
      onTrialComplete: (trial) => trialCompletes.push(trial.trialIndex),
    });

    expect(trialStarts).toEqual([0, 1, 2]);
    expect(trialCompletes).toEqual([0, 1, 2]);

    store.close();
  });

  it('stores trial results in the database', async () => {
    const store = new BenchmarkStore(':memory:');
    const client = new MockLLMClient({ seed: 42, variance: 0 });
    const engine = new ComparisonEngine(store, client);

    const result = await engine.runComparison(testTask, config);

    const storedTrials = store.getTrialResults(result.id);
    expect(storedTrials.length).toBe(3);

    const storedComparison = store.getComparisonResult(result.id);
    expect(storedComparison).not.toBeNull();
    expect(storedComparison!.taskName).toBe('Test Task');

    store.close();
  });

  it('each trial has all three run types', async () => {
    const store = new BenchmarkStore(':memory:');
    const client = new MockLLMClient({ seed: 42, variance: 0 });
    const engine = new ComparisonEngine(store, client);

    const result = await engine.runComparison(testTask, config);

    for (const trial of result.trials) {
      expect(trial.singleAgent.runType).toBe(RunType.SINGLE_AGENT);
      expect(trial.messagePassing.runType).toBe(RunType.MESSAGE_PASSING);
      expect(trial.stigmergy.runType).toBe(RunType.STIGMERGY);
      expect(trial.crossValidation).toBeDefined();
    }

    store.close();
  });

  it('skips single agent when configured', async () => {
    const store = new BenchmarkStore(':memory:');
    const client = new MockLLMClient({ seed: 42, variance: 0 });
    const engine = new ComparisonEngine(store, client);

    const skipConfig = { ...config, skipSingleAgent: true };
    const result = await engine.runComparison(testTask, skipConfig);

    for (const trial of result.trials) {
      expect(trial.singleAgent.totalTokens).toBe(0);
      expect(trial.messagePassing.totalTokens).toBeGreaterThan(0);
      expect(trial.stigmergy.totalTokens).toBeGreaterThan(0);
    }

    store.close();
  });
});
