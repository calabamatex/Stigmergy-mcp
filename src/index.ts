#!/usr/bin/env node
import { TraceStore } from './store/trace-store.js';
import { startServer } from './server.js';

const dbPath = process.env.STIGMERGY_DB_PATH || 'stigmergy.db';
const store = new TraceStore(dbPath);

startServer(store).then(() => {
  console.error(`stigmergy-mcp: running (db: ${dbPath})`);
}).catch((err) => {
  console.error('stigmergy-mcp: failed to start', err);
  process.exit(1);
});

process.on('SIGINT', () => { store.close(); process.exit(0); });
process.on('SIGTERM', () => { store.close(); process.exit(0); });
