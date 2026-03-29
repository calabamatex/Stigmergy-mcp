import { DepositInput } from '../store/schema.js';
import { TraceStore } from '../store/trace-store.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDeposit(server: McpServer, store: TraceStore): void {
  server.tool(
    'deposit_trace',
    'Leave a stigmergic trace in the shared environment for other agents to sense',
    DepositInput.shape,
    async (args) => {
      const input = DepositInput.parse(args);
      const trace = store.deposit(input);
      return {
        content: [{ type: 'text', text: JSON.stringify(trace, null, 2) }],
      };
    },
  );
}
