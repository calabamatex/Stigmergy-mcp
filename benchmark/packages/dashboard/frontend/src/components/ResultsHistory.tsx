import React, { useEffect, useState } from 'react';

interface ComparisonSummary {
  id: string;
  taskName: string;
  timestamp: number;
  trialCount: number;
}

interface Props {
  onSelect: (id: string) => void;
}

export function ResultsHistory({ onSelect }: Props) {
  const [comparisons, setComparisons] = useState<ComparisonSummary[]>([]);

  useEffect(() => {
    fetch('/api/comparisons').then(r => r.json()).then(setComparisons);
  }, []);

  if (comparisons.length === 0) {
    return <p style={{ color: '#666' }}>No comparison results yet. Run a benchmark first.</p>;
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Past Results</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
            <th style={thStyle}>Task</th>
            <th style={thStyle}>Trials</th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={tdStyle}>{c.taskName}</td>
              <td style={tdStyle}>{c.trialCount}</td>
              <td style={tdStyle}>{new Date(c.timestamp).toLocaleString()}</td>
              <td style={tdStyle}>
                <button onClick={() => onSelect(c.id)} style={linkStyle}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '0.5rem 1rem', fontSize: '0.875rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem 1rem', fontSize: '0.875rem' };
const linkStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
  textDecoration: 'underline', fontSize: '0.875rem',
};
