import React, { useState } from 'react';
import { TaskList } from './components/TaskList.js';
import { LiveComparison } from './components/LiveComparison.js';
import { ResultsHistory } from './components/ResultsHistory.js';
import { ResultsDetail } from './components/ResultsDetail.js';
import { useWebSocket } from './hooks/useWebSocket.js';

type View = 'tasks' | 'live' | 'history' | 'detail';

function App() {
  const [view, setView] = useState<View>('tasks');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wsUrl = `ws://${window.location.hostname}:${window.location.port || '3456'}/ws`;
  const { events, connected, clearEvents } = useWebSocket(wsUrl);

  const handleRunTask = async (taskId: string, trials: number, provider: string) => {
    clearEvents();
    setView('live');

    await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        config: { trialCount: trials, provider, model: provider === 'mock' ? 'mock-model' : undefined },
      }),
    });
  };

  const handleViewResult = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Stigmergy Benchmark Dashboard</h1>
        <p style={{ color: '#666', margin: '0.5rem 0 0' }}>
          Empirical token usage comparison: message-passing vs stigmergy coordination
          {connected && <span style={{ color: '#16a34a', marginLeft: '1rem', fontSize: '0.75rem' }}>● WS Connected</span>}
        </p>
        <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          <NavBtn active={view === 'tasks'} onClick={() => setView('tasks')}>Tasks</NavBtn>
          <NavBtn active={view === 'live'} onClick={() => setView('live')}>Live</NavBtn>
          <NavBtn active={view === 'history'} onClick={() => setView('history')}>History</NavBtn>
        </nav>
      </header>

      <main>
        {view === 'tasks' && <TaskList onRunTask={handleRunTask} />}
        {view === 'live' && <LiveComparison events={events} />}
        {view === 'history' && <ResultsHistory onSelect={handleViewResult} />}
        {view === 'detail' && selectedId && <ResultsDetail comparisonId={selectedId} onBack={() => setView('history')} />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        border: 'none',
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
        background: 'none',
        color: active ? '#2563eb' : '#666',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        fontSize: '0.9rem',
      }}
    >
      {children}
    </button>
  );
}

export default App;
