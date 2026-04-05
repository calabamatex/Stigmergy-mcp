import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/server.js';
import type { Server } from 'http';

let server: Server;
let baseUrl: string;
let cleanup: () => void;

beforeAll(async () => {
  const app = createApp(':memory:');
  server = app.server;
  cleanup = () => app.store.close();

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  server.close();
  cleanup();
});

describe('Dashboard API', () => {
  it('GET /api/tasks returns task list', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`);
    expect(res.status).toBe(200);
    const tasks = await res.json();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBe(6);
    expect(tasks[0]).toHaveProperty('id');
    expect(tasks[0]).toHaveProperty('name');
  });

  it('GET /api/tasks/:id returns specific task', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/research-report`);
    expect(res.status).toBe(200);
    const task = await res.json();
    expect(task.id).toBe('research-report');
    expect(task.name).toBe('Research Report Pipeline');
  });

  it('GET /api/tasks/:id returns 404 for unknown task', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('GET /api/comparisons returns empty array initially', async () => {
    const res = await fetch(`${baseUrl}/api/comparisons`);
    expect(res.status).toBe(200);
    const comparisons = await res.json();
    expect(Array.isArray(comparisons)).toBe(true);
    expect(comparisons.length).toBe(0);
  });

  it('GET /api/comparisons/:id returns 404 for unknown ID', async () => {
    const res = await fetch(`${baseUrl}/api/comparisons/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('POST /api/compare requires taskId', async () => {
    const res = await fetch(`${baseUrl}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/compare starts a comparison', async () => {
    const res = await fetch(`${baseUrl}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'single-agent-null',
        config: { trialCount: 3, provider: 'mock' },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('comparisonId');
    expect(data.status).toBe('started');
  });
});
