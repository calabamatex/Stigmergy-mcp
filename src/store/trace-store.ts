/**
 * trace-store.ts — SQLite-backed trace persistence with exponential decay.
 *
 * Core operations:
 *   deposit()   — write a new trace
 *   sense()     — read traces near an area, filtered by effective intensity
 *   reinforce() — strengthen or weaken an existing trace
 *   gradient()  — return strongest signals across a broad area
 *   prune()     — garbage collect expired traces (effective < 0.01)
 *
 * Decay formula: effective_intensity = intensity * exp(-elapsed_hours / decay_hours)
 *
 * BUILD THIS SECOND (after schema.ts). Run tests before moving to tools/.
 */

import Database from 'better-sqlite3';
import {
  Trace,
  TraceWithEffective,
  DepositInput,
  SenseInput,
  ReinforceInput,
  GradientInput,
  GradientResult,
} from './schema.js';

const PRUNE_THRESHOLD = 0.01;
const DECAY_MULTIPLIER = Math.log(1 / PRUNE_THRESHOLD); // ln(100) ≈ 4.605
const DEFAULT_PRUNE_INTERVAL_MS = 60_000;

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  action TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  trace_type TEXT NOT NULL CHECK(trace_type IN ('attraction', 'danger', 'info')),
  intensity REAL NOT NULL CHECK(intensity >= 0 AND intensity <= 1),
  decay_hours REAL NOT NULL CHECK(decay_hours > 0),
  created_at TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}'
);
`;

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_traces_area ON traces(area);
CREATE INDEX IF NOT EXISTS idx_traces_type ON traces(trace_type);
CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);
`;

export class TraceStore {
  private db: Database.Database;
  private lastPruneAt = 0;
  private pruneIntervalMs: number;

  constructor(dbPath: string = ':memory:', opts?: { pruneIntervalMs?: number }) {
    this.pruneIntervalMs = opts?.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(CREATE_TABLE);
    this.db.exec(CREATE_INDEXES);
  }

  /**
   * Calculate effective intensity given decay.
   * effective = intensity * exp(-elapsed_hours / decay_hours)
   */
  private effectiveIntensity(intensity: number, decayHours: number, createdAt: string): number {
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    return intensity * Math.exp(-elapsed / decayHours);
  }

  /**
   * Attach effective_intensity to a raw DB row.
   */
  private hydrateTrace(row: Record<string, unknown>): TraceWithEffective {
    const trace: Trace = {
      id: row.id as string,
      area: row.area as string,
      action: row.action as string,
      agent_id: row.agent_id as string,
      trace_type: row.trace_type as Trace['trace_type'],
      intensity: row.intensity as number,
      decay_hours: row.decay_hours as number,
      created_at: row.created_at as string,
      tags: JSON.parse(row.tags as string),
      metadata: JSON.parse(row.metadata as string),
    };
    return {
      ...trace,
      effective_intensity: this.effectiveIntensity(trace.intensity, trace.decay_hours, trace.created_at),
    };
  }

  /**
   * Build area prefix for matching. Given "src/auth/session.ts" with radius 2,
   * walks up 2 segments → "src/" prefix match.
   */
  private areaPrefix(area: string, radius: number): string {
    const parts = area.replace(/\/$/, '').split('/');
    const depth = Math.max(1, parts.length - radius);
    return parts.slice(0, depth).join('/') + '/';
  }

  deposit(input: DepositInput): Trace {
    this.prune();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO traces (id, area, action, agent_id, trace_type, intensity, decay_hours, created_at, tags, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.area, input.action, input.agent_id, input.trace_type,
      input.intensity, input.decay_hours, now, JSON.stringify(input.tags), JSON.stringify(input.metadata));
    return {
      id, area: input.area, action: input.action, agent_id: input.agent_id,
      trace_type: input.trace_type, intensity: input.intensity, decay_hours: input.decay_hours,
      created_at: now, tags: input.tags, metadata: input.metadata,
    };
  }

  sense(input: SenseInput): TraceWithEffective[] {
    const prefix = this.areaPrefix(input.area, input.radius);
    let sql = `SELECT * FROM traces WHERE area LIKE ?`;
    const params: unknown[] = [prefix + '%'];
    if (input.trace_type) {
      sql += ` AND trace_type = ?`;
      params.push(input.trace_type);
    }
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows
      .map(r => this.hydrateTrace(r))
      .filter(t => t.effective_intensity >= input.min_intensity)
      .sort((a, b) => b.effective_intensity - a.effective_intensity);
  }

  reinforce(input: ReinforceInput): TraceWithEffective {
    const row = this.db.prepare(`SELECT * FROM traces WHERE id = ?`).get(input.trace_id) as Record<string, unknown> | undefined;
    if (!row) throw new Error(`Trace not found: ${input.trace_id}`);
    const newIntensity = Math.max(0, Math.min(1, (row.intensity as number) + input.delta));
    this.db.prepare(`UPDATE traces SET intensity = ? WHERE id = ?`).run(newIntensity, input.trace_id);
    row.intensity = newIntensity;
    return this.hydrateTrace(row);
  }

  gradient(input: GradientInput): GradientResult {
    const rows = this.db.prepare(`SELECT * FROM traces WHERE area LIKE ?`).all(input.area + '%') as Record<string, unknown>[];
    const hydrated = rows.map(r => this.hydrateTrace(r))
      .filter(t => t.effective_intensity >= PRUNE_THRESHOLD)
      .sort((a, b) => b.effective_intensity - a.effective_intensity);
    const topTraces = hydrated.slice(0, input.limit);
    const byType = { attraction: [] as TraceWithEffective[], danger: [] as TraceWithEffective[], info: [] as TraceWithEffective[] };
    for (const t of topTraces) {
      byType[t.trace_type as keyof typeof byType].push(t);
    }
    return { area: input.area, top_traces: topTraces, by_type: byType };
  }

  prune(): number {
    const now = Date.now();
    if (now - this.lastPruneAt < this.pruneIntervalMs) return 0;
    this.lastPruneAt = now;

    // effective < 0.01 when elapsed_hours > decay_hours * ln(100)
    const result = this.db.prepare(`
      DELETE FROM traces
      WHERE (julianday('now') - julianday(created_at)) * 24 > decay_hours * ?
    `).run(DECAY_MULTIPLIER);

    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
