import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TraceStore } from '../src/store/trace-store.js';
import { createServer } from '../src/server.js';

describe('MCP Tools', () => {
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

  describe('deposit_trace', () => {
    it('accepts valid input and returns trace ID', async () => {
      const result = await client.callTool({
        name: 'deposit_trace',
        arguments: {
          area: 'src/auth/session.ts',
          action: 'refactored session management',
          agent_id: 'agent-1',
          trace_type: 'attraction',
          intensity: 0.8,
          decay_hours: 24,
          tags: ['refactor'],
          metadata: {},
        },
      });
      const trace = JSON.parse((result.content as any)[0].text);
      expect(trace.id).toBeTruthy();
      expect(trace.area).toBe('src/auth/session.ts');
      expect(trace.trace_type).toBe('attraction');
    });

    it('rejects missing required fields', async () => {
      const result = await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/test.ts' },
      });
      expect(result.isError).toBe(true);
    });
  });

  describe('sense_environment', () => {
    it('returns traces sorted by effective intensity', async () => {
      await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/a.ts', action: 'a', agent_id: 'a1', trace_type: 'info', intensity: 0.3, decay_hours: 24, tags: [], metadata: {} },
      });
      await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/b.ts', action: 'b', agent_id: 'a1', trace_type: 'info', intensity: 0.9, decay_hours: 24, tags: [], metadata: {} },
      });

      const result = await client.callTool({
        name: 'sense_environment',
        arguments: { area: 'src/a.ts', radius: 2, min_intensity: 0.01 },
      });
      const traces = JSON.parse((result.content as any)[0].text);
      expect(traces.length).toBe(2);
      expect(traces[0].effective_intensity).toBeGreaterThan(traces[1].effective_intensity);
    });

    it('filters by trace_type when specified', async () => {
      await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/x.ts', action: 'x', agent_id: 'a1', trace_type: 'danger', intensity: 0.5, decay_hours: 24, tags: [], metadata: {} },
      });
      await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/y.ts', action: 'y', agent_id: 'a1', trace_type: 'info', intensity: 0.5, decay_hours: 24, tags: [], metadata: {} },
      });

      const result = await client.callTool({
        name: 'sense_environment',
        arguments: { area: 'src/x.ts', radius: 2, min_intensity: 0.01, trace_type: 'danger' },
      });
      const traces = JSON.parse((result.content as any)[0].text);
      expect(traces.length).toBe(1);
      expect(traces[0].trace_type).toBe('danger');
    });
  });

  describe('reinforce_trace', () => {
    it('strengthens trace with positive delta', async () => {
      const depositResult = await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/r.ts', action: 'r', agent_id: 'a1', trace_type: 'attraction', intensity: 0.5, decay_hours: 24, tags: [], metadata: {} },
      });
      const traceId = JSON.parse((depositResult.content as any)[0].text).id;

      const result = await client.callTool({
        name: 'reinforce_trace',
        arguments: { trace_id: traceId, delta: 0.3 },
      });
      const updated = JSON.parse((result.content as any)[0].text);
      expect(updated.intensity).toBeCloseTo(0.8);
    });

    it('weakens trace with negative delta', async () => {
      const depositResult = await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/r.ts', action: 'r', agent_id: 'a1', trace_type: 'attraction', intensity: 0.5, decay_hours: 24, tags: [], metadata: {} },
      });
      const traceId = JSON.parse((depositResult.content as any)[0].text).id;

      const result = await client.callTool({
        name: 'reinforce_trace',
        arguments: { trace_id: traceId, delta: -0.3 },
      });
      const updated = JSON.parse((result.content as any)[0].text);
      expect(updated.intensity).toBeCloseTo(0.2);
    });
  });

  describe('get_gradient', () => {
    it('returns top traces grouped by type', async () => {
      await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/a.ts', action: 'a', agent_id: 'a1', trace_type: 'attraction', intensity: 0.9, decay_hours: 24, tags: [], metadata: {} },
      });
      await client.callTool({
        name: 'deposit_trace',
        arguments: { area: 'src/b.ts', action: 'b', agent_id: 'a1', trace_type: 'danger', intensity: 0.7, decay_hours: 24, tags: [], metadata: {} },
      });

      const result = await client.callTool({
        name: 'get_gradient',
        arguments: { area: 'src/', limit: 5 },
      });
      const gradient = JSON.parse((result.content as any)[0].text);
      expect(gradient.top_traces.length).toBe(2);
      expect(gradient.by_type.attraction.length).toBe(1);
      expect(gradient.by_type.danger.length).toBe(1);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await client.callTool({
          name: 'deposit_trace',
          arguments: { area: `src/${i}.ts`, action: `a${i}`, agent_id: 'a1', trace_type: 'info', intensity: 0.5, decay_hours: 24, tags: [], metadata: {} },
        });
      }

      const result = await client.callTool({
        name: 'get_gradient',
        arguments: { area: 'src/', limit: 2 },
      });
      const gradient = JSON.parse((result.content as any)[0].text);
      expect(gradient.top_traces.length).toBe(2);
    });
  });
});
