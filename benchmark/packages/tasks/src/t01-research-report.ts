import { type BenchmarkTask, TaskCategory, TaskDifficulty } from '@stigmergy-benchmark/core';
import { registerTask } from './registry.js';

/**
 * T6.2 — Sequential Pipeline: "Research Report"
 *
 * 3 agents in sequence: researcher → writer → reviewer.
 * Tests how CT grows in message-passing (each agent passes full output forward)
 * vs stigmergy (each agent deposits a trace summary).
 */
const task: BenchmarkTask = {
  id: 'research-report',
  name: 'Research Report Pipeline',
  description: 'A sequential pipeline where a researcher gathers information, a writer composes a report, and a reviewer provides feedback.',
  category: TaskCategory.SEQUENTIAL,
  difficulty: TaskDifficulty.MEDIUM,
  agentCount: 3,
  steps: [
    {
      id: 'research',
      agentRole: 'researcher',
      description: 'Research the topic and compile key findings, data points, and sources.',
      dependsOn: [],
      expectedOutputTokenRange: [300, 800],
    },
    {
      id: 'write',
      agentRole: 'writer',
      description: 'Write a structured report based on the research findings.',
      dependsOn: ['research'],
      expectedOutputTokenRange: [500, 1200],
    },
    {
      id: 'review',
      agentRole: 'reviewer',
      description: 'Review the report for accuracy, clarity, and completeness. Suggest improvements.',
      dependsOn: ['write'],
      expectedOutputTokenRange: [200, 500],
    },
  ],
  expectedCoordinationPoints: 2,
  userPrompt: 'Write a brief research report about the benefits and challenges of using AI coding assistants in software development teams.',
  singleAgentPrompt: 'You are an expert assistant. Research the topic, write a structured report, and review it for accuracy. Topic: the benefits and challenges of using AI coding assistants in software development teams.',
  crossoverTask: false,
  equivalenceMargin: 5,
};

registerTask(task);
export default task;
