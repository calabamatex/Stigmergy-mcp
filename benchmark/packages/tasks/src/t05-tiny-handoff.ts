import { type BenchmarkTask, TaskCategory, TaskDifficulty } from '@stigmergy-benchmark/core';
import { registerTask } from './registry.js';

/**
 * T6.6 — Crossover Detection: "Two-Agent Tiny Handoff"
 *
 * A minimal 2-agent task where each agent produces very little output (~50 tokens).
 * At this scale, stigmergy's mechanism overhead may exceed its CT savings.
 *
 * Uses TOST equivalence test: if savings are within ±5%, stigmergy provides
 * no meaningful advantage for this task profile.
 *
 * Requires n >= 15 for TOST to be meaningful.
 */
const task: BenchmarkTask = {
  id: 'tiny-handoff',
  name: 'Two-Agent Tiny Handoff (Crossover)',
  description: 'A minimal two-agent handoff to test where stigmergy overhead exceeds savings. Used for TOST equivalence testing.',
  category: TaskCategory.SEQUENTIAL,
  difficulty: TaskDifficulty.SIMPLE,
  agentCount: 2,
  steps: [
    {
      id: 'step-1',
      agentRole: 'starter',
      description: 'Provide a one-sentence answer to the question.',
      dependsOn: [],
      expectedOutputTokenRange: [20, 80],
    },
    {
      id: 'step-2',
      agentRole: 'finisher',
      description: 'Add one more sentence elaborating on the previous answer.',
      dependsOn: ['step-1'],
      expectedOutputTokenRange: [20, 80],
    },
  ],
  expectedCoordinationPoints: 1,
  userPrompt: 'What is dependency injection? Why is it useful?',
  singleAgentPrompt: 'What is dependency injection? Why is it useful? Answer in 2-3 sentences.',
  crossoverTask: true,
  equivalenceMargin: 5,
};

registerTask(task);
export default task;
