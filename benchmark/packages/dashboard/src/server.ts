import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { BenchmarkStore } from '@stigmergy-benchmark/storage';
import { createRoutes } from './api/routes.js';
import { createLiveRoutes } from './api/live.js';
import { attachWebSocket } from './ws/handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AppInstance {
  app: ReturnType<typeof express>;
  server: ReturnType<typeof createServer>;
  store: BenchmarkStore;
}

export function createApp(dbPath?: string): AppInstance {
  const store = new BenchmarkStore(dbPath ?? process.env.STIGMERGY_BENCHMARK_DB ?? './stigmergy-benchmark.db');
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use(createRoutes(store));
  app.use(createLiveRoutes(store));

  // Serve frontend static files
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  const server = createServer(app);
  attachWebSocket(server);

  return { app, server, store };
}

// Run when executed directly
if (!process.env.VITEST) {
  const port = Number(process.env.PORT) || 3456;
  const { server } = createApp();
  server.listen(port, () => {
    console.log(`Stigmergy Benchmark Dashboard: http://localhost:${port}`);
  });
}
