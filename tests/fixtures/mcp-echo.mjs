// A tiny real MCP server for tests: `echo` (read-only) and `shout` (not read-only).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'echo', version: '1.0.0' })
server.registerTool(
  'echo',
  { title: 'Echo', description: 'Repeats the text.', inputSchema: { text: z.string() }, annotations: { readOnlyHint: true } },
  async ({ text }) => ({ content: [{ type: 'text', text: `echo: ${text}` }] })
)
server.registerTool(
  'shout',
  { title: 'Shout', description: 'Repeats the text loudly.', inputSchema: { text: z.string() } },
  async ({ text }) => ({ content: [{ type: 'text', text: text.toUpperCase() }] })
)
await server.connect(new StdioServerTransport())
