import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/index.js';
import { formatProgressLine, formatProvisionalStats } from '../src/format/progress.js';
import { formatComparisonResult } from '../src/format/results.js';
import {
  ReportingLevel,
  type AggregatedStats,
  type ComparisonResult,
  type DescriptiveStats,
  type CategoryVarianceProfile,
  type CrossValidationCalibration,
} from '@stigmergy-benchmark/core';

// ============================================================
// Argument Parsing
// ============================================================

describe('parseArgs', () => {
  it('parses command and subcommand', () => {
    const result = parseArgs(['node', 'cli', 'tasks', 'list']);
    expect(result.command).toBe('tasks');
    expect(result.subcommand).toBe('list');
  });

  it('parses flags with values', () => {
    const result = parseArgs(['node', 'cli', 'compare', '--task', 'my-task', '--trials', '5']);
    expect(result.command).toBe('compare');
    expect(result.flags.task).toBe('my-task');
    expect(result.flags.trials).toBe('5');
  });

  it('parses boolean flags', () => {
    const result = parseArgs(['node', 'cli', 'compare', '--task', 'x', '--skip-single-agent', '--verbose']);
    expect(result.flags['skip-single-agent']).toBe(true);
    expect(result.flags.verbose).toBe(true);
  });

  it('parses positional args after subcommand', () => {
    const result = parseArgs(['node', 'cli', 'results', 'show', 'abc-123']);
    expect(result.command).toBe('results');
    expect(result.subcommand).toBe('show');
    expect(result.positional).toEqual(['abc-123']);
  });

  it('handles empty args', () => {
    const result = parseArgs(['node', 'cli']);
    expect(result.command).toBe('');
    expect(result.subcommand).toBeUndefined();
  });
});

// ============================================================
// Progress Formatting
// ============================================================

describe('formatProgressLine', () => {
  it('shows running state', () => {
    const line = formatProgressLine(2, 10, 'running');
    expect(line).toContain('Trial 3/10');
    expect(line).toContain('running...');
  });

  it('shows complete state', () => {
    const line = formatProgressLine(4, 10, 'complete');
    expect(line).toContain('Trial 5/10');
    expect(line).toContain('complete');
  });
});

describe('formatProvisionalStats', () => {
  function makeStats(level: ReportingLevel, median: number): AggregatedStats {
    const ds: DescriptiveStats = {
      mean: median, median, stdDev: 1, iqr: [median - 2, median + 2],
      cv: 0.05, min: median - 5, max: median + 5, n: 10,
      ci: { lower: median - 3, upper: median + 3, level: 0.95 },
    };
    const emptyDs: DescriptiveStats = { ...ds, median: 0, mean: 0 };
    const profile: CategoryVarianceProfile = {
      contentTransfer: emptyDs, mechanismOverhead: emptyDs,
      coordinationInstructions: emptyDs, taskReasoning: emptyDs,
      systemIdentity: emptyDs,
    };
    return {
      trialCount: 10, reportingLevel: level,
      interAgentSavings: ds, contentTransferSavings: ds,
      totalSavings: ds, effectiveSavings: ds,
      mechanismOverheadCost: emptyDs, coordinationInstructionsDelta: emptyDs,
      autonomousFloor: emptyDs, decompositionOverheadB: emptyDs,
      decompositionOverheadC: emptyDs,
      varianceProfileA: profile, varianceProfileB: profile, varianceProfileC: profile,
      interAgentTest: null, totalSavingsTest: null, equivalenceTest: null,
      wallClockSavings: emptyDs, apiCallDelta: emptyDs, cacheHitRateC: emptyDs,
    };
  }

  it('returns null for RAW_ONLY', () => {
    expect(formatProvisionalStats(makeStats(ReportingLevel.RAW_ONLY, 85))).toBeNull();
  });

  it('shows provisional without CIs', () => {
    const line = formatProvisionalStats(makeStats(ReportingLevel.PROVISIONAL, 87.2));
    expect(line).toContain('Provisional');
    expect(line).toContain('87.2%');
    expect(line).toContain('CIs unavailable');
  });

  it('shows preliminary with CIs', () => {
    const line = formatProvisionalStats(makeStats(ReportingLevel.PRELIMINARY, 84.9));
    expect(line).toContain('Preliminary');
    expect(line).toContain('CI');
  });

  it('shows full stats', () => {
    const line = formatProvisionalStats(makeStats(ReportingLevel.FULL, 89.1));
    expect(line).toContain('89.1%');
    expect(line).toContain('CI');
  });
});

// ============================================================
// Results Formatting
// ============================================================

describe('formatComparisonResult', () => {
  function makeMockResult(): ComparisonResult {
    const ds: DescriptiveStats = {
      mean: 85, median: 85, stdDev: 3, iqr: [82, 88],
      cv: 0.035, min: 78, max: 92, n: 10,
      ci: { lower: 80, upper: 90, level: 0.95 },
    };
    const zeroDs: DescriptiveStats = {
      ...ds, mean: 0, median: 0, stdDev: 0, iqr: [0, 0], cv: 0, min: 0, max: 0,
      ci: { lower: 0, upper: 0, level: 0.95 },
    };
    const profile: CategoryVarianceProfile = {
      contentTransfer: { ...ds, median: 8000 },
      mechanismOverhead: { ...zeroDs, median: 0 },
      coordinationInstructions: { ...ds, median: 200 },
      taskReasoning: { ...ds, median: 4000 },
      systemIdentity: { ...zeroDs, median: 800, cv: 0 },
    };
    const profileC: CategoryVarianceProfile = {
      contentTransfer: { ...ds, median: 400 },
      mechanismOverhead: { ...ds, median: 400 },
      coordinationInstructions: { ...ds, median: 100 },
      taskReasoning: { ...ds, median: 6000 },
      systemIdentity: { ...zeroDs, median: 800, cv: 0 },
    };

    return {
      id: 'test-comparison-id',
      taskId: 'research-report',
      taskName: 'Research Report Pipeline',
      timestamp: Date.now(),
      config: {
        trialCount: 10, provider: 'mock', model: 'mock-model',
        temperature: 0, promptCachingEnabled: true, skipSingleAgent: false,
      },
      trials: [],
      stats: {
        trialCount: 10,
        reportingLevel: ReportingLevel.FULL,
        interAgentSavings: { ...ds, median: 89.1 },
        contentTransferSavings: { ...ds, median: 95.3 },
        totalSavings: { ...ds, median: 37.5 },
        effectiveSavings: { ...ds, median: 45.6 },
        mechanismOverheadCost: { ...ds, median: 400 },
        coordinationInstructionsDelta: { ...ds, median: -127 },
        autonomousFloor: { ...ds, median: 4210 },
        decompositionOverheadB: { ...ds, median: 535 },
        decompositionOverheadC: { ...ds, median: 3055 },
        varianceProfileA: { ...profile, contentTransfer: zeroDs, mechanismOverhead: zeroDs, coordinationInstructions: zeroDs },
        varianceProfileB: profile,
        varianceProfileC: profileC,
        interAgentTest: { testName: 'wilcoxon_signed_rank', statistic: 0, pValue: 0.001, significant: true, interpretation: 'Significant' },
        totalSavingsTest: { testName: 'wilcoxon_signed_rank', statistic: 3, pValue: 0.008, significant: true, interpretation: 'Significant' },
        equivalenceTest: null,
        wallClockSavings: ds,
        apiCallDelta: ds,
        cacheHitRateC: ds,
      },
      crossValidationCalibration: {
        runAVarianceCV: 0.072,
        calibratedThreshold: 0.144,
        perTrialDriftsB: [],
        perTrialDriftsC: [],
        flaggedTrialsB: [],
        flaggedTrialsC: [3],
        overallReliable: true,
      },
    };
  }

  it('produces formatted output', () => {
    const output = formatComparisonResult(makeMockResult());
    expect(output).toContain('Stigmergy-MCP Token Comparison');
    expect(output).toContain('Research Report Pipeline');
  });

  it('includes token decomposition', () => {
    const output = formatComparisonResult(makeMockResult());
    expect(output).toContain('TOKEN DECOMPOSITION');
    expect(output).toContain('Content Transfer');
    expect(output).toContain('Mechanism Overhead');
    expect(output).toContain('Task Reasoning');
    expect(output).toContain('System Identity');
  });

  it('includes statistical analysis', () => {
    const output = formatComparisonResult(makeMockResult());
    expect(output).toContain('STATISTICAL ANALYSIS');
    expect(output).toContain('Inter-Agent Savings');
    expect(output).toContain('Wilcoxon');
    expect(output).toContain('0.0010');
  });

  it('includes variance profile', () => {
    const output = formatComparisonResult(makeMockResult());
    expect(output).toContain('VARIANCE PROFILE');
    expect(output).toContain('Run A');
    expect(output).toContain('Run B');
    expect(output).toContain('Run C');
  });

  it('includes cross-validation', () => {
    const output = formatComparisonResult(makeMockResult());
    expect(output).toContain('CROSS-VALIDATION');
    expect(output).toContain('RELIABLE');
  });

  it('includes headline summary', () => {
    const output = formatComparisonResult(makeMockResult());
    expect(output).toContain('INTER-AGENT SAVINGS');
    expect(output).toContain('EFFECTIVE SAVINGS');
  });
});
