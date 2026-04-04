import type { BenchmarkTask } from '@stigmergy-benchmark/core';

const tasks = new Map<string, BenchmarkTask>();

export function registerTask(task: BenchmarkTask): void {
  if (tasks.has(task.id)) {
    throw new Error(`Task "${task.id}" already registered`);
  }
  tasks.set(task.id, task);
}

export function getTask(id: string): BenchmarkTask {
  const task = tasks.get(id);
  if (!task) {
    throw new Error(`Task "${id}" not found. Available: ${[...tasks.keys()].join(', ')}`);
  }
  return task;
}

export function listTasks(): BenchmarkTask[] {
  return [...tasks.values()];
}
