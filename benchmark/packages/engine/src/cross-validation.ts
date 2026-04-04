import type { RunResult, TrialCrossValidation } from '@stigmergy-benchmark/core';

/**
 * Cross-validate token classification for a single trial.
 *
 * Expected inter-agent tokens = total - Run A total (autonomous floor).
 * Classifier drift = |expected - classified| / total.
 */
export function crossValidateTrial(
  runA: RunResult,
  runB: RunResult,
  runC: RunResult,
): TrialCrossValidation {
  const expectedInterAgentB = runB.totalTokens - runA.totalTokens;
  const expectedInterAgentC = runC.totalTokens - runA.totalTokens;

  const classifierDriftB = runB.totalTokens > 0
    ? Math.abs(expectedInterAgentB - runB.interAgentTokens) / runB.totalTokens
    : 0;

  const classifierDriftC = runC.totalTokens > 0
    ? Math.abs(expectedInterAgentC - runC.interAgentTokens) / runC.totalTokens
    : 0;

  return {
    classifierDriftB,
    classifierDriftC,
    expectedInterAgentB: Math.max(0, expectedInterAgentB),
    classifiedInterAgentB: runB.interAgentTokens,
    expectedInterAgentC: Math.max(0, expectedInterAgentC),
    classifiedInterAgentC: runC.interAgentTokens,
  };
}
