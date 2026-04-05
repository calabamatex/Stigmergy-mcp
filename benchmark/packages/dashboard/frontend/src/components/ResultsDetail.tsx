import React, { useEffect, useState } from 'react';
import { TokenChart } from './TokenChart.js';

interface Props {
  comparisonId: string;
  onBack: () => void;
}

export function ResultsDetail({ comparisonId, onBack }: Props) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/comparisons/${comparisonId}`)
      .then(r => {
        if (!r.ok) throw new Error(`Not found: ${comparisonId}`);
        return r.json();
      })
      .then(setResult)
      .catch(e => setError(e.message));
  }, [comparisonId]);

  if (error) return <div style={{ color: '#dc2626' }}>Error: {error} <button onClick={onBack}>Back</button></div>;
  if (!result) return <div>Loading...</div>;

  const stats = result.stats as Record<string, unknown>;
  const config = result.config as Record<string, unknown>;
  const cal = result.crossValidationCalibration as Record<string, unknown>;
  const ia = stats.interAgentSavings as { median: number; ci: { lower: number; upper: number } };
  const ct = stats.contentTransferSavings as { median: number; ci: { lower: number; upper: number } };
  const eff = stats.effectiveSavings as { median: number; ci: { lower: number; upper: number } };
  const iaTest = stats.interAgentTest as { pValue: number; significant: boolean } | null;
  const profileB = stats.varianceProfileB as Record<string, { median: number; cv: number }>;
  const profileC = stats.varianceProfileC as Record<string, { median: number; cv: number }>;

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: '1rem', cursor: 'pointer' }}>← Back</button>
      <h2>{result.taskName as string}</h2>
      <div style={{ color: '#666', marginBottom: '1rem', fontSize: '0.875rem' }}>
        {config.model as string} ({config.provider as string}) | {stats.trialCount as number} trials | {stats.reportingLevel as string}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Inter-Agent Savings" value={ia.median} ci={ia.ci} pValue={iaTest?.pValue} />
        <StatCard label="Content Transfer Savings" value={ct.median} ci={ct.ci} />
        <StatCard label="Effective Savings" value={eff.median} ci={eff.ci} />
      </div>

      <TokenChart profileB={profileB as any} profileC={profileC as any} />

      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Cross-Validation</h3>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          <div>Run A CV: {((cal.runAVarianceCV as number) * 100).toFixed(1)}% | Threshold: {((cal.calibratedThreshold as number) * 100).toFixed(1)}%</div>
          <div>Flagged: {(cal.flaggedTrialsB as number[]).length} (B), {(cal.flaggedTrialsC as number[]).length} (C)</div>
          <div style={{ color: (cal.overallReliable as boolean) ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
            {(cal.overallReliable as boolean) ? 'RELIABLE' : 'UNRELIABLE'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Variance Profile (CV)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Run B CV</th>
              <th style={thStyle}>Run C CV</th>
            </tr>
          </thead>
          <tbody>
            {['contentTransfer', 'mechanismOverhead', 'coordinationInstructions', 'taskReasoning', 'systemIdentity'].map(cat => (
              <tr key={cat} style={{ borderBottom: '1px solid #eee' }}>
                <td style={tdStyle}>{cat.replace(/([A-Z])/g, ' $1').trim()}</td>
                <td style={tdStyle}>{fmtCV(profileB[cat]?.cv)}</td>
                <td style={tdStyle}>{fmtCV(profileC[cat]?.cv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, ci, pValue }: { label: string; value: number; ci: { lower: number; upper: number }; pValue?: number }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', background: '#fafafa' }}>
      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value.toFixed(1)}%</div>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>
        95% CI: [{ci.lower.toFixed(1)}%, {ci.upper.toFixed(1)}%]
      </div>
      {pValue !== undefined && (
        <div style={{ fontSize: '0.75rem', color: pValue < 0.05 ? '#16a34a' : '#666' }}>
          p = {pValue.toFixed(4)} {pValue < 0.05 ? '✓' : ''}
        </div>
      )}
    </div>
  );
}

function fmtCV(n: number | undefined): string {
  if (n === undefined || n === 0) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

const thStyle: React.CSSProperties = { padding: '0.5rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem' };
