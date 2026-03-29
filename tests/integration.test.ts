import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TraceStore } from '../src/store/trace-store.js';
import { createServer } from '../src/server.js';

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  return JSON.parse((result.content as any)[0].text);
}

describe('Stigmergy Integration', () => {
  let store: TraceStore;
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    store = new TraceStore(':memory:');
    server = createServer(store);
    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    store.close();
  });

  it('full stigmergy loop: deposit → sense → reinforce → gradient', async () => {
    // Agent A deposits a danger trace
    const trace = await callTool(client, 'deposit_trace', {
      area: 'src/auth/session.ts',
      action: 'found XSS vulnerability in session handler',
      agent_id: 'agent-a',
      trace_type: 'danger',
      intensity: 0.8,
      decay_hours: 48,
      tags: ['security', 'xss'],
      metadata: { line: 42 },
    });
    expect(trace.id).toBeTruthy();
    expect(trace.trace_type).toBe('danger');

    // Agent B senses the area and finds the danger trace
    const sensed = await callTool(client, 'sense_environment', {
      area: 'src/auth/session.ts',
      radius: 1,
      min_intensity: 0.01,
    });
    expect(sensed.length).toBe(1);
    expect(sensed[0].trace_type).toBe('danger');
    expect(sensed[0].tags).toContain('security');

    // Agent B reinforces the trace (confirms the danger)
    const reinforced = await callTool(client, 'reinforce_trace', {
      trace_id: trace.id,
      delta: 0.15,
    });
    expect(reinforced.intensity).toBeCloseTo(0.95);

    // Agent C reads gradient on src/ and sees the danger signal
    const gradient = await callTool(client, 'get_gradient', {
      area: 'src/',
      limit: 5,
    });
    expect(gradient.top_traces.length).toBe(1);
    expect(gradient.by_type.danger.length).toBe(1);
    expect(gradient.top_traces[0].area).toBe('src/auth/session.ts');
  });

  it('traces from different agents are visible to each other', async () => {
    await callTool(client, 'deposit_trace', {
      area: 'src/db/pool.ts',
      action: 'optimized connection pooling',
      agent_id: 'agent-alpha',
      trace_type: 'attraction',
      intensity: 0.7,
      decay_hours: 24,
      tags: ['perf'],
      metadata: {},
    });

    await callTool(client, 'deposit_trace', {
      area: 'src/db/migrations.ts',
      action: 'added index on users table',
      agent_id: 'agent-beta',
      trace_type: 'info',
      intensity: 0.5,
      decay_hours: 24,
      tags: ['db'],
      metadata: {},
    });

    // Both traces visible from src/db/ area
    const sensed = await callTool(client, 'sense_environment', {
      area: 'src/db/pool.ts',
      radius: 1,
      min_intensity: 0.01,
    });
    expect(sensed.length).toBe(2);
    // Different agent_ids
    const agents = sensed.map((t: any) => t.agent_id);
    expect(agents).toContain('agent-alpha');
    expect(agents).toContain('agent-beta');
  });

  it('danger traces repel (visible to sense with type filter)', async () => {
    await callTool(client, 'deposit_trace', {
      area: 'src/auth/oauth.ts',
      action: 'broken oauth flow',
      agent_id: 'agent-1',
      trace_type: 'danger',
      intensity: 0.9,
      decay_hours: 4,
      tags: ['broken'],
      metadata: {},
    });

    await callTool(client, 'deposit_trace', {
      area: 'src/auth/jwt.ts',
      action: 'clean jwt implementation',
      agent_id: 'agent-2',
      trace_type: 'attraction',
      intensity: 0.6,
      decay_hours: 24,
      tags: ['clean'],
      metadata: {},
    });

    // Filter for danger only
    const dangers = await callTool(client, 'sense_environment', {
      area: 'src/auth/oauth.ts',
      radius: 1,
      min_intensity: 0.01,
      trace_type: 'danger',
    });
    expect(dangers.length).toBe(1);
    expect(dangers[0].action).toBe('broken oauth flow');
  });

  it('expired traces are pruned and no longer sensed', async () => {
    // Insert an old trace directly into the store (200 hours ago, 4h decay)
    const db = (store as any).db;
    const past = new Date(Date.now() - 200 * 60 * 60 * 1000).toISOString();
    db.prepare(`INSERT INTO traces (id, area, action, agent_id, trace_type, intensity, decay_hours, created_at, tags, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'old-trace-id', 'src/legacy/old.ts', 'ancient change', 'agent-old', 'info', 1.0, 4, past, '[]', '{}',
    );

    // Deposit a fresh trace (triggers prune)
    await callTool(client, 'deposit_trace', {
      area: 'src/legacy/new.ts',
      action: 'fresh change',
      agent_id: 'agent-new',
      trace_type: 'info',
      intensity: 0.5,
      decay_hours: 24,
      tags: [],
      metadata: {},
    });

    // Old trace should be pruned, only fresh one remains
    const sensed = await callTool(client, 'sense_environment', {
      area: 'src/legacy/old.ts',
      radius: 1,
      min_intensity: 0.0,
    });
    const ids = sensed.map((t: any) => t.id);
    expect(ids).not.toContain('old-trace-id');
  });
});
