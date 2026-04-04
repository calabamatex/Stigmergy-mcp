import { type BenchmarkTask, TaskCategory, TaskDifficulty } from '@stigmergy-benchmark/core';
import { registerTask } from './registry.js';

/**
 * T6.3 — Parallel Fan-Out: "Multi-Source Analysis"
 *
 * 3 agents analyze different aspects in parallel, then a 4th synthesizes.
 * Tests parallel coordination overhead.
 */
const task: BenchmarkTask = {
  id: 'multi-source-analysis',
  name: 'Multi-Source Analysis',
  description: 'Multiple agents analyze different aspects of a topic in parallel, then a synthesizer combines their findings.',
  category: TaskCategory.PARALLEL,
  difficulty: TaskDifficulty.MEDIUM,
  agentCount: 4,
  steps: [
    {
      id: 'analyze-technical',
      agentRole: 'technical-analyst',
      description: 'Analyze the technical implementation aspects and architecture decisions.',
      dependsOn: [],
      expectedOutputTokenRange: [200, 600],
    },
    {
      id: 'analyze-business',
      agentRole: 'business-analyst',
      description: 'Analyze the business impact, ROI, and market considerations.',
      dependsOn: [],
      expectedOutputTokenRange: [200, 600],
    },
    {
      id: 'analyze-risk',
      agentRole: 'risk-analyst',
      description: 'Analyze potential risks, security concerns, and mitigation strategies.',
      dependsOn: [],
      expectedOutputTokenRange: [200, 600],
    },
    {
      id: 'synthesize',
      agentRole: 'synthesizer',
      description: 'Combine all analyses into a unified recommendation with trade-offs.',
      dependsOn: ['analyze-technical', 'analyze-business', 'analyze-risk'],
      expectedOutputTokenRange: [400, 1000],
    },
  ],
  expectedCoordinationPoints: 3,
  userPrompt: 'Analyze the decision to migrate a monolithic application to microservices. Consider technical, business, and risk perspectives, then provide a unified recommendation.',
  singleAgentPrompt: 'You are an expert consultant. Analyze the decision to migrate a monolithic application to microservices from technical, business, and risk perspectives. Provide a unified recommendation with trade-offs.',
  crossoverTask: false,
  equivalenceMargin: 5,
};

registerTask(task);
export default task;
