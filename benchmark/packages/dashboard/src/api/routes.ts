import { Router } from 'express';
import { listTasks, getTask } from '@stigmergy-benchmark/tasks';
import { BenchmarkStore } from '@stigmergy-benchmark/storage';

export function createRoutes(store: BenchmarkStore): Router {
  const router = Router();

  router.get('/api/tasks', (_req, res) => {
    const tasks = listTasks();
    res.json(tasks);
  });

  router.get('/api/tasks/:id', (req, res) => {
    try {
      const task = getTask(req.params.id);
      res.json(task);
    } catch {
      res.status(404).json({ error: `Task not found: ${req.params.id}` });
    }
  });

  router.get('/api/comparisons', (_req, res) => {
    const comparisons = store.listComparisons();
    res.json(comparisons);
  });

  router.get('/api/comparisons/:id', (req, res) => {
    const result = store.getComparisonResult(req.params.id);
    if (!result) {
      res.status(404).json({ error: `Comparison not found: ${req.params.id}` });
      return;
    }
    res.json(result);
  });

  return router;
}
