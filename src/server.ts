import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TraceStore } from './store/trace-store.js';
import { registerDeposit } from './tools/deposit.js';
import { registerSense } from './tools/sense.js';
import { registerReinforce } from './tools/reinforce.js';
import { registerGradient } from './tools/gradient.js';

export function createServer(store: TraceStore): McpServer {
  const server = new McpServer({
    name: 'stigmergy-mcp',
    version: '0.1.0',
  });

  registerDeposit(server, store);
  registerSense(server, store);
  registerReinforce(server, store);
  registerGradient(server, store);

  return server;
}

export async function startServer(store: TraceStore): Promise<McpServer> {
  const server = createServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
