import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'http';
import { addWSListener } from '../api/live.js';

/**
 * Attach WebSocket server to an HTTP server.
 * Clients connect to ws://host:port/ws to receive live comparison events.
 */
export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    addWSListener(ws);
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  return wss;
}
