import { type BenchmarkTask, TaskCategory, TaskDifficulty } from '@stigmergy-benchmark/core';
import { registerTask } from './registry.js';

/**
 * T6.4 — Iterative Refinement: "Code Review"
 *
 * Author writes code, reviewer provides feedback, author revises.
 * Tests iterative coordination patterns.
 */
const task: BenchmarkTask = {
  id: 'code-review',
  name: 'Iterative Code Review',
  description: 'An author writes code, a reviewer provides feedback, and the author revises based on feedback.',
  category: TaskCategory.ITERATIVE,
  difficulty: TaskDifficulty.MEDIUM,
  agentCount: 3,
  steps: [
    {
      id: 'initial-code',
      agentRole: 'author',
      description: 'Write the initial implementation of the requested function.',
      dependsOn: [],
      expectedOutputTokenRange: [200, 600],
    },
    {
      id: 'review',
      agentRole: 'reviewer',
      description: 'Review the code for bugs, performance issues, and best practices. Provide specific feedback.',
      dependsOn: ['initial-code'],
      expectedOutputTokenRange: [200, 500],
    },
    {
      id: 'revision',
      agentRole: 'author',
      description: 'Revise the code based on reviewer feedback. Address each point raised.',
      dependsOn: ['review'],
      expectedOutputTokenRange: [200, 600],
    },
  ],
  expectedCoordinationPoints: 2,
  userPrompt: 'Write a TypeScript function that implements a rate limiter using the token bucket algorithm. It should support configurable rate and burst size.',
  singleAgentPrompt: 'You are an expert TypeScript developer. Write a rate limiter function using the token bucket algorithm with configurable rate and burst size. Then review your own code for bugs and best practices, and revise it.',
  crossoverTask: false,
  equivalenceMargin: 5,
};

registerTask(task);
export default task;
