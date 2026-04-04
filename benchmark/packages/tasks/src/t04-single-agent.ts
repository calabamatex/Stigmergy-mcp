import { type BenchmarkTask, TaskCategory, TaskDifficulty } from '@stigmergy-benchmark/core';
import { registerTask } from './registry.js';

/**
 * T6.5 — Minimal Task: "Single Agent" (Null Hypothesis)
 *
 * A task that requires only 1 agent. All three architectures should
 * produce ~0% inter-agent savings because there's no coordination.
 *
 * Statistical purpose: validates instrumentation. If this task produces
 * inter-agent savings with CV > 5%, the classifier or mock has a bug.
 */
const task: BenchmarkTask = {
  id: 'single-agent-null',
  name: 'Single Agent (Null Hypothesis)',
  description: 'A minimal task requiring only one agent. Used to validate that the instrumentation correctly reports ~0% inter-agent savings.',
  category: TaskCategory.SEQUENTIAL,
  difficulty: TaskDifficulty.SIMPLE,
  agentCount: 1,
  steps: [
    {
      id: 'solve',
      agentRole: 'solver',
      description: 'Answer the question directly.',
      dependsOn: [],
      expectedOutputTokenRange: [50, 200],
    },
  ],
  expectedCoordinationPoints: 0,
  userPrompt: 'Explain the difference between a stack and a queue data structure. Give one example use case for each.',
  singleAgentPrompt: 'Explain the difference between a stack and a queue data structure. Give one example use case for each.',
  crossoverTask: false,
  equivalenceMargin: 5,
};

registerTask(task);
export default task;
