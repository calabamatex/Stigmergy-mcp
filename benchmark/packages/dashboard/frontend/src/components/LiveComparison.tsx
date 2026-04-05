import React from 'react';
import type { WSEvent } from '../hooks/useWebSocket.js';

interface Props {
  events: WSEvent[];
}

export function LiveComparison({ events }: Props) {
  const trialCompletes = events.filter(e => e.type === 'trial_complete');
  const complete = events.find(e => e.type === 'complete');
  const errors = events.filter(e => e.type === 'error');
  const lastTrialStart = events.filter(e => e.type === 'trial_start').pop();
  const totalTrials = (lastTrialStart?.totalTrials as number) ?? 0;

  if (complete) {
    const result = complete.result as Record<string, unknown>;
    const stats = result.stats as Record<string, unknown>;
    const interAgent = stats.interAgentSavings as { median: number; ci: { lower: number; upper: number } };
    const effective = stats.effectiveSavings as { median: number; ci: { lower: number; upper: number } };

    return (
      <div style={containerStyle}>
        <h3 style={{ color: '#16a34a' }}>Comparison Complete</h3>
        <div style={statBoxStyle}>
          <div><strong>Inter-Agent Savings:</strong> {interAgent.median.toFixed(1)}% [{interAgent.ci.lower.toFixed(1)}%, {interAgent.ci.upper.toFixed(1)}%]</div>
          <div><strong>Effective Savings:</strong> {effective.median.toFixed(1)}% [{effective.ci.lower.toFixed(1)}%, {effective.ci.upper.toFixed(1)}%]</div>
          <div><strong>Trials:</strong> {(result.trials as unknown[]).length} | <strong>Level:</strong> {(stats.reportingLevel as string)}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h3>Running Comparison...</h3>
      <div style={{ marginBottom: '1rem' }}>
        {totalTrials > 0 && (
          <div style={progressBarContainer}>
            <div style={{ ...progressBarFill, width: `${(trialCompletes.length / totalTrials) * 100}%` }} />
          </div>
        )}
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Trial {trialCompletes.length}/{totalTrials || '?'} complete
        </div>
      </div>

      {trialCompletes.length > 0 && (
        <div style={{ fontSize: '0.875rem' }}>
          {trialCompletes.map((e, i) => {
            const ps = e.partialStats as Record<string, unknown>;
            const ia = ps?.interAgentSavings as { median: number } | undefined;
            return (
              <div key={i} style={{ padding: '0.25rem 0' }}>
                Trial {(e.trialIndex as number) + 1}: {ia ? `inter-agent savings ${ia.median.toFixed(1)}%` : 'computing...'}
              </div>
            );
          })}
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ color: '#dc2626', marginTop: '0.5rem' }}>
          {errors.map((e, i) => <div key={i}>Error (trial {(e.trialIndex as number) + 1}): {e.message as string}</div>)}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = { padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: '#fafafa' };
const statBoxStyle: React.CSSProperties = { background: '#f0fdf4', padding: '1rem', borderRadius: '4px', lineHeight: 1.8 };
const progressBarContainer: React.CSSProperties = { background: '#e5e7eb', borderRadius: '4px', height: '8px', marginBottom: '0.5rem' };
const progressBarFill: React.CSSProperties = { background: '#2563eb', height: '100%', borderRadius: '4px', transition: 'width 0.3s' };
