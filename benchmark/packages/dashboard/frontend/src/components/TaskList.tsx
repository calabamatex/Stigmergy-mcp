import React, { useEffect, useState } from 'react';

interface Task {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  agentCount: number;
  crossoverTask: boolean;
}

interface Props {
  onRunTask: (taskId: string, trials: number, provider: string) => void;
}

export function TaskList({ onRunTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trials, setTrials] = useState(10);
  const [provider, setProvider] = useState('mock');

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(setTasks);
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Benchmark Tasks</h2>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label>Trials: <input type="number" min={3} max={20} value={trials} onChange={e => setTrials(Number(e.target.value))} style={inputStyle} /></label>
        <label>Provider: <select value={provider} onChange={e => setProvider(e.target.value)} style={inputStyle}>
          <option value="mock">Mock</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </select></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {tasks.map(task => (
          <div key={task.id} style={cardStyle}>
            <h3 style={{ margin: '0 0 0.5rem' }}>{task.name}</h3>
            <p style={{ fontSize: '0.875rem', color: '#666', margin: '0 0 0.5rem' }}>{task.description}</p>
            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>
              {task.agentCount} agents | {task.category} | {task.difficulty}
              {task.crossoverTask && ' | Crossover'}
            </div>
            <button onClick={() => onRunTask(task.id, trials, provider)} style={btnStyle}>Run Comparison</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', background: '#fafafa',
};
const btnStyle: React.CSSProperties = {
  background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px',
  padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem',
};
const inputStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ccc',
};
