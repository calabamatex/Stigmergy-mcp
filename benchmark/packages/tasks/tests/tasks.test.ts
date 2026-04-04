import { describe, it, expect } from 'vitest';
import { getTask, listTasks } from '../src/index.js';
import { TaskCategory, TaskDifficulty } from '@stigmergy-benchmark/core';

describe('Task Registry', () => {
  it('registers all 6 tasks', () => {
    const tasks = listTasks();
    expect(tasks.length).toBe(6);
  });

  it('retrieves task by id', () => {
    const task = getTask('research-report');
    expect(task.name).toBe('Research Report Pipeline');
    expect(task.agentCount).toBe(3);
    expect(task.steps.length).toBe(3);
  });

  it('throws for unknown task', () => {
    expect(() => getTask('nonexistent')).toThrow('not found');
  });

  it('research-report is sequential with 3 steps', () => {
    const task = getTask('research-report');
    expect(task.category).toBe(TaskCategory.SEQUENTIAL);
    expect(task.steps.map(s => s.agentRole)).toEqual(['researcher', 'writer', 'reviewer']);
  });

  it('multi-source is parallel with 4 agents', () => {
    const task = getTask('multi-source-analysis');
    expect(task.category).toBe(TaskCategory.PARALLEL);
    expect(task.agentCount).toBe(4);
    // First 3 steps have no dependencies (parallel)
    expect(task.steps[0].dependsOn).toEqual([]);
    expect(task.steps[1].dependsOn).toEqual([]);
    expect(task.steps[2].dependsOn).toEqual([]);
    // 4th depends on all 3
    expect(task.steps[3].dependsOn.length).toBe(3);
  });

  it('code-review is iterative', () => {
    const task = getTask('code-review');
    expect(task.category).toBe(TaskCategory.ITERATIVE);
  });

  it('single-agent-null has 1 agent and 0 coordination points', () => {
    const task = getTask('single-agent-null');
    expect(task.agentCount).toBe(1);
    expect(task.expectedCoordinationPoints).toBe(0);
    expect(task.crossoverTask).toBe(false);
  });

  it('tiny-handoff is a crossover task', () => {
    const task = getTask('tiny-handoff');
    expect(task.crossoverTask).toBe(true);
    expect(task.equivalenceMargin).toBe(5);
    expect(task.agentCount).toBe(2);
  });

  it('ten-agent-pipeline has 10 agents', () => {
    const task = getTask('ten-agent-pipeline');
    expect(task.agentCount).toBe(10);
    expect(task.steps.length).toBe(10);
    expect(task.expectedCoordinationPoints).toBe(9);
    expect(task.difficulty).toBe(TaskDifficulty.COMPLEX);
  });

  it('all tasks have required fields', () => {
    for (const task of listTasks()) {
      expect(task.id).toBeTruthy();
      expect(task.name).toBeTruthy();
      expect(task.userPrompt).toBeTruthy();
      expect(task.singleAgentPrompt).toBeTruthy();
      expect(task.steps.length).toBeGreaterThan(0);
      expect(task.agentCount).toBeGreaterThan(0);
    }
  });
});
