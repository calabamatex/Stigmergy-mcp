import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CategoryProfile {
  contentTransfer: { median: number };
  mechanismOverhead: { median: number };
  coordinationInstructions: { median: number };
  taskReasoning: { median: number };
  systemIdentity: { median: number };
}

interface Props {
  profileB: CategoryProfile;
  profileC: CategoryProfile;
}

export function TokenChart({ profileB, profileC }: Props) {
  const data = [
    {
      name: 'Run B (Msg-Pass)',
      'Content Transfer': profileB.contentTransfer.median,
      'Mechanism Overhead': profileB.mechanismOverhead.median,
      'Coord. Instructions': profileB.coordinationInstructions.median,
      'Task Reasoning': profileB.taskReasoning.median,
      'System Identity': profileB.systemIdentity.median,
    },
    {
      name: 'Run C (Stigmergy)',
      'Content Transfer': profileC.contentTransfer.median,
      'Mechanism Overhead': profileC.mechanismOverhead.median,
      'Coord. Instructions': profileC.coordinationInstructions.median,
      'Task Reasoning': profileC.taskReasoning.median,
      'System Identity': profileC.systemIdentity.median,
    },
  ];

  return (
    <div>
      <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Token Decomposition (5-Category)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Content Transfer" stackId="a" fill="#ef4444" />
          <Bar dataKey="Mechanism Overhead" stackId="a" fill="#f97316" />
          <Bar dataKey="Coord. Instructions" stackId="a" fill="#eab308" />
          <Bar dataKey="Task Reasoning" stackId="a" fill="#22c55e" />
          <Bar dataKey="System Identity" stackId="a" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
