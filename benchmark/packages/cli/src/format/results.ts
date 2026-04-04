import {
  type ComparisonResult,
  type DescriptiveStats,
  type AggregatedStats,
  type CrossValidationCalibration,
  ReportingLevel,
} from '@stigmergy-benchmark/core';

export function formatComparisonResult(result: ComparisonResult): string {
  const { stats, config, crossValidationCalibration: cal } = result;
  const lines: string[] = [];

  const W = 78;
  const border = (char: string) => char.repeat(W);

  lines.push(border('='));
  lines.push(`  Stigmergy-MCP Token Comparison`);
  lines.push(`  Task: ${result.taskName}`);
  lines.push(`  Model: ${config.model} (${config.provider})  |  Trials: ${stats.trialCount}  |  Level: ${stats.reportingLevel}`);
  lines.push(border('='));

  // Autonomous floor
  if (!config.skipSingleAgent) {
    lines.push('');
    lines.push(`  AUTONOMOUS FLOOR (Run A: Single Agent)`);
    lines.push(`  ${fmtStats(stats.autonomousFloor, 'tokens')}`);
  }

  // Token decomposition
  lines.push('');
  lines.push(`  ${'─'.repeat(W - 4)}`);
  lines.push(`  TOKEN DECOMPOSITION (medians, n=${stats.trialCount})`);
  lines.push('');
  lines.push(`  ${pad('', 28)}${pad('Run B', 14)}${pad('Run C', 14)}${pad('Delta', 10)}`);
  lines.push(`  ${pad('', 28)}${pad('Msg-Pass', 14)}${pad('Stigmergy', 14)}`);

  lines.push(`  INTER-AGENT COMMUNICATION`);
  lines.push(fmtRow('Content Transfer',
    stats.varianceProfileB.contentTransfer.median,
    stats.varianceProfileC.contentTransfer.median,
    stats.contentTransferSavings.median));
  lines.push(fmtRow('Mechanism Overhead',
    stats.varianceProfileB.mechanismOverhead.median,
    stats.varianceProfileC.mechanismOverhead.median,
    null));
  lines.push(fmtRow('Coordination Instr.',
    stats.varianceProfileB.coordinationInstructions.median,
    stats.varianceProfileC.coordinationInstructions.median,
    null));

  const interB = stats.varianceProfileB.contentTransfer.median +
    stats.varianceProfileB.mechanismOverhead.median +
    stats.varianceProfileB.coordinationInstructions.median;
  const interC = stats.varianceProfileC.contentTransfer.median +
    stats.varianceProfileC.mechanismOverhead.median +
    stats.varianceProfileC.coordinationInstructions.median;
  lines.push(`    ${pad('Subtotal', 26)}${pad(fmtNum(interB), 14)}${pad(fmtNum(interC), 14)}${fmtDelta(interB, interC)}`);

  lines.push(`  AGENT AUTONOMOUS`);
  lines.push(fmtRow('Task Reasoning',
    stats.varianceProfileB.taskReasoning.median,
    stats.varianceProfileC.taskReasoning.median,
    null));
  lines.push(fmtRow('System Identity',
    stats.varianceProfileB.systemIdentity.median,
    stats.varianceProfileC.systemIdentity.median,
    null));

  // Totals
  lines.push('');
  lines.push(`  ${'─'.repeat(W - 4)}`);
  lines.push(`  TOTALS`);
  lines.push(`  ${pad('Total Savings:', 28)}${fmtStatsLine(stats.totalSavings)}`);
  lines.push(`  ${pad('Effective Savings:', 28)}${fmtStatsLine(stats.effectiveSavings)}`);

  // Statistical analysis
  lines.push('');
  lines.push(`  ${'─'.repeat(W - 4)}`);
  lines.push(`  STATISTICAL ANALYSIS`);
  lines.push('');
  lines.push(`  Inter-Agent Savings`);
  lines.push(`    ${fmtStatsLine(stats.interAgentSavings)}`);
  if (stats.interAgentTest) {
    lines.push(`    Wilcoxon p = ${stats.interAgentTest.pValue.toFixed(4)} ${stats.interAgentTest.significant ? '\u2713' : ''}`);
  }

  lines.push('');
  lines.push(`  Content Transfer Savings`);
  lines.push(`    ${fmtStatsLine(stats.contentTransferSavings)}`);

  if (stats.totalSavingsTest) {
    lines.push('');
    lines.push(`  Total Savings`);
    lines.push(`    ${fmtStatsLine(stats.totalSavings)}`);
    lines.push(`    Wilcoxon p = ${stats.totalSavingsTest.pValue.toFixed(4)} ${stats.totalSavingsTest.significant ? '\u2713' : ''}`);
  }

  if (stats.equivalenceTest) {
    lines.push('');
    lines.push(`  EQUIVALENCE TEST (TOST)`);
    lines.push(`    ${stats.equivalenceTest.interpretation}`);
  }

  // Variance profile
  lines.push('');
  lines.push(`  ${'─'.repeat(W - 4)}`);
  lines.push(`  VARIANCE PROFILE (CV)`);
  lines.push(`  ${pad('Category', 28)}${pad('Run A', 12)}${pad('Run B', 12)}${pad('Run C', 12)}`);
  lines.push(fmtVarRow('Content Transfer', stats));
  lines.push(fmtVarRow('Mechanism Overhead', stats));
  lines.push(fmtVarRow('Coordination Instr.', stats));
  lines.push(fmtVarRow('Task Reasoning', stats));
  lines.push(fmtVarRow('System Identity', stats));

  // Cross-validation
  lines.push('');
  lines.push(`  ${'─'.repeat(W - 4)}`);
  lines.push(`  CROSS-VALIDATION`);
  lines.push(fmtCrossValidation(cal));

  // Headline
  lines.push('');
  lines.push(border('='));
  lines.push(`  INTER-AGENT SAVINGS:  ${fmtStatsLine(stats.interAgentSavings)}`);
  lines.push(`  EFFECTIVE SAVINGS:    ${fmtStatsLine(stats.effectiveSavings)}`);
  lines.push(border('='));

  return lines.join('\n');
}

function fmtNum(n: number): string {
  if (isNaN(n)) return 'N/A';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0);
}

function fmtPct(n: number): string {
  if (isNaN(n)) return 'N/A';
  return `${n.toFixed(1)}%`;
}

function fmtCV(n: number): string {
  if (isNaN(n) || n === 0) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDelta(a: number, b: number): string {
  if (a === 0) return b === 0 ? '0' : `+${fmtNum(b)}`;
  const pct = ((b - a) / a) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function fmtStats(s: DescriptiveStats, unit: string): string {
  const parts = [`Median: ${fmtNum(s.median)} ${unit}`];
  if (s.n >= 3) {
    parts.push(`IQR: [${fmtNum(s.iqr[0])} — ${fmtNum(s.iqr[1])}]`);
  }
  parts.push(`CV: ${fmtCV(s.cv)}`);
  return parts.join('    ');
}

function fmtStatsLine(s: DescriptiveStats): string {
  const parts = [`Median: ${fmtPct(s.median)}`];
  if (!isNaN(s.ci.lower)) {
    parts.push(`95% CI: [${fmtPct(s.ci.lower)}, ${fmtPct(s.ci.upper)}]`);
  }
  if (s.n >= 3) {
    parts.push(`IQR: [${fmtPct(s.iqr[0])} — ${fmtPct(s.iqr[1])}]`);
  }
  return parts.join('    ');
}

function fmtRow(label: string, valB: number, valC: number, savingsPct: number | null): string {
  const delta = savingsPct !== null ? `-${fmtPct(savingsPct)}` : fmtDelta(valB, valC);
  return `    ${pad(label, 26)}${pad(fmtNum(valB), 14)}${pad(fmtNum(valC), 14)}${delta}`;
}

function fmtVarRow(label: string, stats: AggregatedStats): string {
  const getCV = (profile: AggregatedStats['varianceProfileA'], cat: string): number => {
    switch (cat) {
      case 'Content Transfer': return profile.contentTransfer.cv;
      case 'Mechanism Overhead': return profile.mechanismOverhead.cv;
      case 'Coordination Instr.': return profile.coordinationInstructions.cv;
      case 'Task Reasoning': return profile.taskReasoning.cv;
      case 'System Identity': return profile.systemIdentity.cv;
      default: return 0;
    }
  };

  return `  ${pad(label, 28)}${pad(fmtCV(getCV(stats.varianceProfileA, label)), 12)}${pad(fmtCV(getCV(stats.varianceProfileB, label)), 12)}${fmtCV(getCV(stats.varianceProfileC, label))}`;
}

function fmtCrossValidation(cal: CrossValidationCalibration): string {
  const lines: string[] = [];
  lines.push(`  Run A variance (CV): ${fmtCV(cal.runAVarianceCV)}    Calibrated threshold: ${fmtCV(cal.calibratedThreshold)}`);
  lines.push(`  Flagged trials: ${cal.flaggedTrialsB.length} (Run B), ${cal.flaggedTrialsC.length} (Run C)`);
  lines.push(`  Classification: ${cal.overallReliable ? 'RELIABLE' : 'UNRELIABLE'}`);
  return lines.join('\n');
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}
