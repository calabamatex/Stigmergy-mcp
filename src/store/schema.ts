/**
 * schema.ts — Zod schemas and TypeScript types for stigmergic traces.
 * 
 * This is the data model. Everything else depends on these types.
 */

import { z } from 'zod';

// === Enums ===

export const TraceType = z.enum(['attraction', 'danger', 'info']);
export type TraceType = z.infer<typeof TraceType>;

// === Core Trace Schema ===

export const TraceSchema = z.object({
  id: z.string(),
  area: z.string().min(1),
  action: z.string().min(1),
  agent_id: z.string().min(1),
  trace_type: TraceType,
  intensity: z.number().min(0).max(1),
  decay_hours: z.number().positive(),
  created_at: z.string().datetime(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
});

export type Trace = z.infer<typeof TraceSchema>;

// === Input Schemas (for MCP tools) ===

export const DepositInput = z.object({
  area: z.string().min(1).describe('File path or module name (e.g. "src/auth/session.ts")'),
  action: z.string().min(1).describe('What happened (e.g. "refactored session management")'),
  agent_id: z.string().min(1).describe('ID of the agent leaving this trace'),
  trace_type: TraceType.describe('Type: attraction (good path), danger (warning), info (neutral)'),
  intensity: z.number().min(0).max(1).default(0.5).describe('Signal strength 0.0-1.0'),
  decay_hours: z.number().positive().default(24).describe('Hours until trace fades to ~37% intensity'),
  tags: z.array(z.string()).default([]).describe('Searchable labels'),
  metadata: z.record(z.string(), z.unknown()).default({}).describe('Arbitrary JSON payload'),
});

export type DepositInput = z.infer<typeof DepositInput>;

export const SenseInput = z.object({
  area: z.string().min(1).describe('File path or prefix to scan (e.g. "src/auth/")'),
  radius: z.number().int().min(0).default(2).describe('Path depth for prefix matching'),
  min_intensity: z.number().min(0).max(1).default(0.05).describe('Minimum effective intensity to include'),
  trace_type: TraceType.optional().describe('Filter by trace type'),
});

export type SenseInput = z.infer<typeof SenseInput>;

export const ReinforceInput = z.object({
  trace_id: z.string().min(1).describe('ID of trace to reinforce'),
  delta: z.number().min(-1).max(1).describe('Positive to strengthen, negative to weaken'),
});

export type ReinforceInput = z.infer<typeof ReinforceInput>;

export const GradientInput = z.object({
  area: z.string().min(1).describe('Broad area prefix (e.g. "src/")'),
  limit: z.number().int().positive().default(5).describe('Max traces to return'),
});

export type GradientInput = z.infer<typeof GradientInput>;

// === Output Types ===

export interface TraceWithEffective extends Trace {
  effective_intensity: number;
}

export interface GradientResult {
  area: string;
  top_traces: TraceWithEffective[];
  by_type: {
    attraction: TraceWithEffective[];
    danger: TraceWithEffective[];
    info: TraceWithEffective[];
  };
}
