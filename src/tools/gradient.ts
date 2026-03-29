import { GradientInput } from '../store/schema.js';
import { TraceStore } from '../store/trace-store.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGradient(server: McpServer, store: TraceStore): void {
  server.tool(
    'get_gradient',
    'Return strongest stigmergic signals across an area, grouped by trace type',
    GradientInput.shape,
    async (args) => {
      const input = GradientInput.parse(args);
      const result = store.gradient(input);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
