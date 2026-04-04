import { ReportingLevel, type AggregatedStats } from '@stigmergy-benchmark/core';

const BAR_FULL = '\u2501'; // ━
const BAR_WIDTH = 25;

export function formatProgressLine(
  trialIndex: number,
  totalTrials: number,
  status: 'running' | 'complete',
): string {
  const num = `Trial ${trialIndex + 1}/${totalTrials}`;
  const filled = Math.round(((trialIndex + (status === 'complete' ? 1 : 0.5)) / totalTrials) * BAR_WIDTH);
  const bar = BAR_FULL.repeat(filled) + ' '.repeat(BAR_WIDTH - filled);
  const label = status === 'complete' ? 'complete' : 'running...';
  return `${num} ${bar} ${label}`;
}

export function formatProvisionalStats(stats: AggregatedStats): string | null {
  const { reportingLevel, interAgentSavings } = stats;
  const median = interAgentSavings.median;

  switch (reportingLevel) {
    case ReportingLevel.RAW_ONLY:
      return null;

    case ReportingLevel.PROVISIONAL:
      return `Provisional: inter-agent savings median ${fmtPct(median)} (CIs unavailable, n < 5)`;

    case ReportingLevel.PRELIMINARY: {
      const ci = interAgentSavings.ci;
      return `Preliminary: inter-agent savings median ${fmtPct(median)} CI [${fmtPct(ci.lower)}, ${fmtPct(ci.upper)}] (n < 10)`;
    }

    case ReportingLevel.FULL:
    case ReportingLevel.PUBLICATION: {
      const ci = interAgentSavings.ci;
      return `inter-agent savings median ${fmtPct(median)} CI [${fmtPct(ci.lower)}, ${fmtPct(ci.upper)}]`;
    }

    default:
      return null;
  }
}

function fmtPct(n: number): string {
  if (isNaN(n)) return 'N/A';
  return `${n.toFixed(1)}%`;
}
