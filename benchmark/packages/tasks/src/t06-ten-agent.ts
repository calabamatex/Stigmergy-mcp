import { type BenchmarkTask, TaskCategory, TaskDifficulty } from '@stigmergy-benchmark/core';
import { registerTask } from './registry.js';

/**
 * T6.7 — High-Fanout: "Ten-Agent Pipeline"
 *
 * 10 agents in sequence, each adding a section to a document.
 * This is where CT grows quadratically in message-passing (agent 10 ingests
 * all 9 predecessors' outputs) while stigmergy CT stays O(N).
 *
 * Expected to show the largest inter-agent savings.
 */
const task: BenchmarkTask = {
  id: 'ten-agent-pipeline',
  name: 'Ten-Agent Pipeline',
  description: 'A long sequential pipeline with 10 agents, each contributing a section. Tests O(N²) vs O(N) content transfer scaling.',
  category: TaskCategory.SEQUENTIAL,
  difficulty: TaskDifficulty.COMPLEX,
  agentCount: 10,
  steps: Array.from({ length: 10 }, (_, i) => ({
    id: `section-${i + 1}`,
    agentRole: `section-${i + 1}-writer`,
    description: `Write section ${i + 1} of the document, building on previous sections.`,
    dependsOn: i > 0 ? [`section-${i}`] : [],
    expectedOutputTokenRange: [100, 400] as [number, number],
  })),
  expectedCoordinationPoints: 9,
  userPrompt: 'Write a 10-section guide to building a production-ready REST API. Each section should cover one topic: 1) Project setup, 2) Routing, 3) Middleware, 4) Database, 5) Authentication, 6) Validation, 7) Error handling, 8) Testing, 9) Deployment, 10) Monitoring.',
  singleAgentPrompt: 'You are an expert backend developer. Write a comprehensive 10-section guide to building a production-ready REST API covering: project setup, routing, middleware, database, authentication, validation, error handling, testing, deployment, and monitoring.',
  crossoverTask: false,
  equivalenceMargin: 5,
};

registerTask(task);
export default task;
