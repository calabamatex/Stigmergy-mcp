import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TraceStore } from '../src/store/trace-store.js';

describe('TraceStore', () => {
  let store: TraceStore;

  beforeEach(() => {
    store = new TraceStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  const defaultInput = {
    area: 'src/auth/session.ts',
    action: 'refactored session management',
    agent_id: 'agent-1',
    trace_type: 'attraction' as const,
    intensity: 0.8,
    decay_hours: 24,
    tags: ['refactor', 'auth'],
    metadata: { pr: 42 },
  };

  describe('deposit', () => {
    it('creates a trace and returns it with a valid ID', () => {
      const trace = store.deposit(defaultInput);
      expect(trace.id).toBeTruthy();
      expect(trace.area).toBe('src/auth/session.ts');
      expect(trace.action).toBe('refactored session management');
      expect(trace.agent_id).toBe('agent-1');
      expect(trace.trace_type).toBe('attraction');
      expect(trace.intensity).toBe(0.8);
      expect(trace.decay_hours).toBe(24);
      expect(trace.tags).toEqual(['refactor', 'auth']);
      expect(trace.metadata).toEqual({ pr: 42 });
      expect(trace.created_at).toBeTruthy();
    });

    it('generates unique IDs for each deposit', () => {
      const t1 = store.deposit(defaultInput);
      const t2 = store.deposit(defaultInput);
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('sense', () => {
    it('finds traces by area prefix', () => {
      store.deposit(defaultInput);
      store.deposit({ ...defaultInput, area: 'src/auth/login.ts' });
      store.deposit({ ...defaultInput, area: 'src/db/pool.ts' });

      const results = store.sense({ area: 'src/auth/session.ts', radius: 2, min_intensity: 0.01 });
      // radius 2 from "src/auth/session.ts" -> prefix "src/"
      expect(results.length).toBe(3);
    });

    it('respects radius for narrower matching', () => {
      store.deposit(defaultInput);
      store.deposit({ ...defaultInput, area: 'src/auth/login.ts' });
      store.deposit({ ...defaultInput, area: 'src/db/pool.ts' });

      const results = store.sense({ area: 'src/auth/session.ts', radius: 1, min_intensity: 0.01 });
      // radius 1 from "src/auth/session.ts" -> prefix "src/auth/"
      expect(results.length).toBe(2);
    });

    it('filters by min_intensity', () => {
      store.deposit({ ...defaultInput, intensity: 0.9 });
      store.deposit({ ...defaultInput, intensity: 0.02 });

      const results = store.sense({ area: 'src/auth/session.ts', radius: 2, min_intensity: 0.5 });
      expect(results.length).toBe(1);
      expect(results[0].effective_intensity).toBeGreaterThanOrEqual(0.5);
    });

    it('filters by trace_type', () => {
      store.deposit(defaultInput);
      store.deposit({ ...defaultInput, trace_type: 'danger' });

      const results = store.sense({
        area: 'src/auth/session.ts', radius: 2, min_intensity: 0.01, trace_type: 'danger',
      });
      expect(results.length).toBe(1);
      expect(results[0].trace_type).toBe('danger');
    });

    it('returns results sorted by effective intensity descending', () => {
      store.deposit({ ...defaultInput, intensity: 0.3 });
      store.deposit({ ...defaultInput, intensity: 0.9 });
      store.deposit({ ...defaultInput, intensity: 0.6 });

      const results = store.sense({ area: 'src/auth/session.ts', radius: 2, min_intensity: 0.01 });
      expect(results[0].effective_intensity).toBeGreaterThanOrEqual(results[1].effective_intensity);
      expect(results[1].effective_intensity).toBeGreaterThanOrEqual(results[2].effective_intensity);
    });

    it('returns empty array when no matches', () => {
      const results = store.sense({ area: 'src/auth/', radius: 2, min_intensity: 0.01 });
      expect(results).toEqual([]);
    });
  });

  describe('reinforce', () => {
    it('strengthens a trace', () => {
      const trace = store.deposit({ ...defaultInput, intensity: 0.5 });
      const updated = store.reinforce({ trace_id: trace.id, delta: 0.3 });
      expect(updated.intensity).toBeCloseTo(0.8);
    });

    it('weakens a trace', () => {
      const trace = store.deposit({ ...defaultInput, intensity: 0.5 });
      const updated = store.reinforce({ trace_id: trace.id, delta: -0.3 });
      expect(updated.intensity).toBeCloseTo(0.2);
    });

    it('clamps intensity to [0, 1]', () => {
      const trace = store.deposit({ ...defaultInput, intensity: 0.9 });
      const up = store.reinforce({ trace_id: trace.id, delta: 0.5 });
      expect(up.intensity).toBe(1);

      const trace2 = store.deposit({ ...defaultInput, intensity: 0.1 });
      const down = store.reinforce({ trace_id: trace2.id, delta: -0.5 });
      expect(down.intensity).toBe(0);
    });

    it('throws for non-existent trace', () => {
      expect(() => store.reinforce({ trace_id: 'nope', delta: 0.1 })).toThrow('Trace not found');
    });
  });

  describe('decay math', () => {
    it('freshly deposited trace has effective ≈ stored intensity', () => {
      const trace = store.deposit(defaultInput);
      const sensed = store.sense({ area: trace.area, radius: 2, min_intensity: 0.01 });
      expect(sensed[0].effective_intensity).toBeCloseTo(trace.intensity, 1);
    });

    it('effective intensity follows exp(-elapsed/decay_hours)', () => {
      // Manually insert a trace created 24h ago with decay_hours=24
      const id = crypto.randomUUID();
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Use direct DB access via deposit + time manipulation
      // Instead, insert directly via the store's internal DB
      const db = (store as any).db;
      db.prepare(`INSERT INTO traces (id, area, action, agent_id, trace_type, intensity, decay_hours, created_at, tags, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, 'src/test.ts', 'test', 'agent-1', 'info', 1.0, 24, past, '[]', '{}',
      );

      const sensed = store.sense({ area: 'src/test.ts', radius: 2, min_intensity: 0.01 });
      const expected = Math.exp(-24 / 24); // ~0.368
      expect(sensed[0].effective_intensity).toBeCloseTo(expected, 1);
    });
  });

  describe('prune', () => {
    it('removes traces with effective intensity below 0.01', () => {
      // Insert a trace from 200 hours ago with decay_hours=24
      const db = (store as any).db;
      const id = crypto.randomUUID();
      const past = new Date(Date.now() - 200 * 60 * 60 * 1000).toISOString();
      db.prepare(`INSERT INTO traces (id, area, action, agent_id, trace_type, intensity, decay_hours, created_at, tags, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, 'src/old.ts', 'old action', 'agent-1', 'info', 1.0, 24, past, '[]', '{}',
      );

      // effective = 1.0 * exp(-200/24) ≈ 0.00024 — below 0.01
      const pruned = store.prune();
      expect(pruned).toBe(1);

      const remaining = store.sense({ area: 'src/', radius: 0, min_intensity: 0.0 });
      expect(remaining.length).toBe(0);
    });

    it('keeps traces above threshold', () => {
      store.deposit(defaultInput);
      const pruned = store.prune();
      expect(pruned).toBe(0);
    });
  });

  describe('gradient', () => {
    it('returns top traces by effective intensity', () => {
      store.deposit({ ...defaultInput, area: 'src/a.ts', intensity: 0.9 });
      store.deposit({ ...defaultInput, area: 'src/b.ts', intensity: 0.5 });
      store.deposit({ ...defaultInput, area: 'src/c.ts', intensity: 0.3 });

      const result = store.gradient({ area: 'src/', limit: 2 });
      expect(result.top_traces.length).toBe(2);
      expect(result.top_traces[0].effective_intensity).toBeGreaterThan(result.top_traces[1].effective_intensity);
      expect(result.area).toBe('src/');
    });

    it('groups traces by type', () => {
      store.deposit({ ...defaultInput, area: 'src/a.ts', trace_type: 'attraction' });
      store.deposit({ ...defaultInput, area: 'src/b.ts', trace_type: 'danger' });
      store.deposit({ ...defaultInput, area: 'src/c.ts', trace_type: 'info' });

      const result = store.gradient({ area: 'src/', limit: 10 });
      expect(result.by_type.attraction.length).toBe(1);
      expect(result.by_type.danger.length).toBe(1);
      expect(result.by_type.info.length).toBe(1);
    });

    it('returns empty result for no matches', () => {
      const result = store.gradient({ area: 'nonexistent/', limit: 5 });
      expect(result.top_traces).toEqual([]);
      expect(result.by_type).toEqual({ attraction: [], danger: [], info: [] });
    });
  });
});
