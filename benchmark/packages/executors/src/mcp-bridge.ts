import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TraceStore } from 'stigmergy-mcp/store';
import { createServer } from 'stigmergy-mcp/server';
import type { ToolDefinition } from '@stigmergy-benchmark/core';

/**
 * In-process bridge to stigmergy-mcp.
 * Creates a TraceStore + McpServer + MCP Client connected via InMemoryTransport.
 * Each instance is isolated (in-memory DB) for trial independence.
 */
export class McpBridge {
  private store: TraceStore;
  private server: McpServer;
  private client: Client;
  private connected = false;

  constructor() {
    this.store = new TraceStore(':memory:');
    this.server = createServer(this.store);
    this.client = new Client({ name: 'benchmark-client', version: '1.0.0' });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await this.server.connect(serverTransport);
    await this.client.connect(clientTransport);
    this.connected = true;
  }

  /**
   * Call an MCP tool and return the result as parsed JSON.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) await this.connect();
    const result = await this.client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    if (content.length > 0 && content[0].text) {
      return JSON.parse(content[0].text);
    }
    return result.content;
  }

  /**
   * Get tool definitions for injection into LLM requests.
   * These are the stigmergy tools the agent can call.
   */
  async getToolDefinitions(): Promise<ToolDefinition[]> {
    if (!this.connected) await this.connect();
    const { tools } = await this.client.listTools();
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description ?? '',
      input_schema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    await this.server.close();
    this.store.close();
    this.connected = false;
  }
}
