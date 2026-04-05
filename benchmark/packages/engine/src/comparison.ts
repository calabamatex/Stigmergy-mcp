import {
  RunType,
  type BenchmarkTask,
  type ComparisonConfig,
  type ComparisonResult,
  type TrialResult,
  type PerTrialMetrics,
  type AggregatedStats,
  type RunContext,
} from '@stigmergy-benchmark/core';
import { SingleAgentExecutor, MessagePassingExecutor, StigmergySwarmExecutor } from '@stigmergy-benchmark/executors';
import type { RunConfig } from '@stigmergy-benchmark/executors';
import type { LLMClient } from '@stigmergy-benchmark/llm-client';
import { aggregateStats, computePerTrialMetrics, calibrateCrossValidation } from '@stigmergy-benchmark/stats';
import { BenchmarkStore } from '@stigmergy-benchmark/storage';
import { crossValidateTrial } from './cross-validation.js';
import { BenchmarkLogger } from './logger.js';

export interface ComparisonCallbacks {
  onTrialStart?: (trialIndex: number, totalTrials: number) => void;
  onRunStart?: (trialIndex: number, runType: RunType) => void;
  onRunComplete?: (trialIndex: number, runType: RunType) => void;
  onTrialComplete?: (trial: TrialResult, partialStats: AggregatedStats) => void;
  onError?: (trialIndex: number, error: Error) => void;
  onLog?: (level: string, event: string, context?: Record<string, unknown>) => void;
}

/**
 * Orchestrates n trials × 3 runs, aggregates results with progressive reporting.
 */
export class ComparisonEngine {
  private singleAgent = new SingleAgentExecutor();
  private messagePassing = new MessagePassingExecutor();
  private stigmergy = new StigmergySwarmExecutor();

  private logger: BenchmarkLogger;

  constructor(
    private store: BenchmarkStore,
    private client: LLMClient,
    verbose = false,
  ) {
    this.logger = new BenchmarkLogger(verbose);
  }

  async runComparison(
    task: BenchmarkTask,
    config: ComparisonConfig,
    callbacks?: ComparisonCallbacks,
  ): Promise<ComparisonResult> {
    this.validateConfig(task, config);

    const comparisonId = crypto.randomUUID();
    const trials: TrialResult[] = [];
    const perTrialMetrics: PerTrialMetrics[] = [];
    const errors: Array<{ trialIndex: number; error: Error }> = [];

    const runConfig: RunConfig = {
      model: config.model,
      maxTurns: 5,
      maxTokens: 4096,
      temperature: config.temperature,
      agentCount: task.agentCount,
    };

    this.logger.info('comparison_start', { comparisonId, taskId: task.id, trialCount: config.trialCount });

    for (let i = 0; i < config.trialCount; i++) {
      callbacks?.onTrialStart?.(i, config.trialCount);

      try {
        const trial = await this.runSingleTrial(
          task, runConfig, comparisonId, i, config, callbacks,
        );

        trials.push(trial);
        this.store.saveTrialResult(trial);

        const metrics = computePerTrialMetrics(trial);
        perTrialMetrics.push(metrics);

        // Progressive reporting
        if (callbacks?.onTrialComplete) {
          const partialStats = aggregateStats(trials, perTrialMetrics, task);
          callbacks.onTrialComplete(trial, partialStats);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push({ trialIndex: i, error });
        callbacks?.onError?.(i, error);

        // If > 50% of trials fail, abort
        if (errors.length > config.trialCount / 2) {
          console.error(
            `Aborting: ${errors.length}/${i + 1} trials failed (>${Math.floor(config.trialCount / 2)} threshold)`,
          );
          break;
        }
      }

      // Reset ephemeral state between trials
      this.store.resetTrial();
    }

    // Final aggregation
    const stats = aggregateStats(trials, perTrialMetrics, task);
    const calibration = calibrateCrossValidation(trials);

    const result: ComparisonResult = {
      id: comparisonId,
      taskId: task.id,
      taskName: task.name,
      timestamp: Date.now(),
      config,
      trials,
      stats,
      crossValidationCalibration: calibration,
    };

    this.store.saveComparisonResult(result);
    this.logger.info('comparison_complete', { comparisonId, trialCount: trials.length, errors: errors.length });
    return result;
  }

  private validateConfig(task: BenchmarkTask, config: ComparisonConfig): void {
    if (!task.steps || task.steps.length === 0) {
      throw new Error(`Task "${task.id}" has no steps defined`);
    }
    if (config.trialCount < 3) {
      throw new Error(`Trial count must be >= 3 (got ${config.trialCount})`);
    }
    if (!config.model) {
      throw new Error('Model name is required');
    }
  }

  private async runSingleTrial(
    task: BenchmarkTask,
    runConfig: RunConfig,
    comparisonId: string,
    trialIndex: number,
    config: ComparisonConfig,
    callbacks?: ComparisonCallbacks,
  ): Promise<TrialResult> {
    const makeContext = (runType: RunType): RunContext => ({
      runType,
      runId: `${comparisonId}-${runType}-${trialIndex}`,
      trialIndex,
      agentId: 'agent-0',
    });

    // Run A: Single Agent
    callbacks?.onRunStart?.(trialIndex, RunType.SINGLE_AGENT);
    const runA = config.skipSingleAgent
      ? this.emptyRunResult(RunType.SINGLE_AGENT, makeContext(RunType.SINGLE_AGENT).runId)
      : await this.singleAgent.execute(task, runConfig, makeContext(RunType.SINGLE_AGENT), this.client);
    callbacks?.onRunComplete?.(trialIndex, RunType.SINGLE_AGENT);

    // Run B: Message-Passing
    callbacks?.onRunStart?.(trialIndex, RunType.MESSAGE_PASSING);
    const runB = await this.messagePassing.execute(
      task, runConfig, makeContext(RunType.MESSAGE_PASSING), this.client,
    );
    callbacks?.onRunComplete?.(trialIndex, RunType.MESSAGE_PASSING);

    // Run C: Stigmergy
    callbacks?.onRunStart?.(trialIndex, RunType.STIGMERGY);
    const runC = await this.stigmergy.execute(
      task, runConfig, makeContext(RunType.STIGMERGY), this.client,
    );
    callbacks?.onRunComplete?.(trialIndex, RunType.STIGMERGY);

    const crossValidation = crossValidateTrial(runA, runB, runC);

    return {
      trialIndex,
      comparisonId,
      singleAgent: runA,
      messagePassing: runB,
      stigmergy: runC,
      crossValidation,
    };
  }

  private emptyRunResult(runType: RunType, runId: string) {
    return {
      runType, runId,
      contentTransferTokens: 0, mechanismOverheadTokens: 0,
      coordinationInstructionsTokens: 0, taskReasoningTokens: 0,
      systemIdentityTokens: 0, interAgentTokens: 0,
      agentAutonomousTokens: 0, totalTokens: 0,
      cachedTokens: 0, effectiveTokens: 0, cacheHitRate: 0,
      wallClockMs: 0, agentCount: 0, apiCallCount: 0,
      success: true, output: null, tokenLog: [],
    };
  }
}
