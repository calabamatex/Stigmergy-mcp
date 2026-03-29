import { SenseInput } from '../store/schema.js';
import { TraceStore } from '../store/trace-store.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSense(server: McpServer, store: TraceStore): void {
  server.tool(
    'sense_environment',
    'Read stigmergic traces near a given area, sorted by effective intensity',
    SenseInput.shape,
    async (args) => {
      const input = SenseInput.parse(args);
      const traces = store.sense(input);
      return {
        content: [{ type: 'text', text: JSON.stringify(traces, null, 2) }],
      };
    },
  );
}
