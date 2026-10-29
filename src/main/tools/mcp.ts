import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { z } from 'zod'
import type { McpServerConfig, McpServerInfo } from '@shared/ipc'
import { tool, type Plugin, type Tool } from './types'

// MCP client for servers the user added. Their tools become Lumi tools; their output is untrusted.

const CONNECT_TIMEOUT_MS = 30_000
const CALL_TIMEOUT_MS = 60_000

/** Splits a command line like `npx -y "@scope/pkg" --flag` into command + args (quotes respected). */
export function parseCommandLine(line: string): { command: string; args: string[] } {
  const parts = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!)
  return { command: parts[0] ?? '', args: parts.slice(1) }
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
export const mcpToolName = (server: string, toolName: string): string => `mcp_${slug(server)}_${slug(toolName)}`.slice(0, 64)

interface McpToolInfo {
  name: string
  title?: string
  description?: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
}

interface Connection {
  client?: Client
  status: McpServerInfo['status']
  error?: string
  tools: McpToolInfo[]
}

export class McpManager {
  private readonly conns = new Map<string, Connection>()

  constructor(
    private readonly servers: () => McpServerConfig[],
    private readonly onChange: () => void
  ) {}

  /** Connects enabled servers and disconnects removed or disabled ones. */
  async sync(): Promise<void> {
    const wanted = new Map(this.servers().filter((s) => s.enabled).map((s) => [s.id, s]))
    for (const [id, conn] of this.conns) {
      if (!wanted.has(id)) {
        this.conns.delete(id)
        void conn.client?.close().catch(() => {})
      }
    }
    await Promise.all([...wanted.values()].filter((s) => !this.conns.has(s.id)).map((s) => this.connect(s)))
  }

  private async connect(server: McpServerConfig): Promise<void> {
    const conn: Connection = { status: 'connecting', tools: [] }
    this.conns.set(server.id, conn)
    this.onChange()
    const client = new Client({ name: 'Lumi', version: '1.0.0' })
    try {
      const transport = server.url
        ? new StreamableHTTPClientTransport(new URL(server.url))
        : new StdioClientTransport({ command: server.command, args: server.args, env: getDefaultEnvironment(), stderr: 'ignore' })
      await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS })
      const { tools } = await client.listTools(undefined, { timeout: CONNECT_TIMEOUT_MS })
      if (this.conns.get(server.id) !== conn) return void client.close() // removed while connecting
      client.onclose = () => {
        if (this.conns.get(server.id) !== conn) return
        conn.status = 'error'
        conn.error = 'The server stopped.'
        conn.tools = []
        this.onChange()
      }
      Object.assign(conn, { client, status: 'ready', tools: tools as McpToolInfo[], error: undefined })
    } catch (error) {
      void client.close().catch(() => {})
      Object.assign(conn, { status: 'error', error: error instanceof Error ? error.message.slice(0, 300) : 'Could not connect.' })
    }
    this.onChange()
  }

  /** Reconnects a server (e.g. after it stopped). */
  async restart(id: string): Promise<void> {
    const conn = this.conns.get(id)
    this.conns.delete(id)
    await conn?.client?.close().catch(() => {})
    await this.sync()
  }

  info(): McpServerInfo[] {
    return this.servers().map((s) => {
      const c = this.conns.get(s.id)
      return {
        ...s,
        status: s.enabled ? (c?.status ?? 'connecting') : 'off',
        error: c?.error,
        tools: c?.tools.map((t) => t.name) ?? []
      }
    })
  }

  plugins(): Plugin[] {
    return this.servers().flatMap((server) => {
      const conn = this.conns.get(server.id)
      if (!server.enabled || conn?.status !== 'ready' || !conn.client) return []
      const client = conn.client
      const tools: Tool[] = conn.tools.map((t) =>
        tool({
          name: mcpToolName(server.name, t.name),
          description: `[${server.name}] ${t.description ?? t.title ?? t.name}`.slice(0, 1000),
          parameters: t.inputSchema ?? { type: 'object' },
          // The server validates against its own schema; here: an object of bounded size.
          input: z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length <= 20_000, 'Arguments are too large.'),
          // Only a server the user trusts can mark its own tools as read-only (no prompt).
          risk: server.trusted && t.annotations?.readOnlyHint ? 'read' : 'act',
          describe: () => `${server.name}: ${t.title ?? t.name}`,
          async run(args, signal) {
            const result = await client.callTool({ name: t.name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS, signal })
            const content = (result.content ?? []) as { type: string; text?: string }[]
            const text = content.map((c) => (c.type === 'text' ? (c.text ?? '') : `[${c.type}]`)).join('\n')
            if (result.isError) throw new Error(text.slice(0, 500) || 'The tool reported an error.')
            return text || '(no output)'
          }
        })
      )
      return [
        {
          id: `mcp.${server.id}`,
          name: `MCP: ${server.name}`,
          version: '—',
          description: `Tools from the MCP server “${server.name}”.`,
          permissions: ['mcp' as const],
          tools
        }
      ]
    })
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.conns.values()].map((c) => c.client?.close().catch(() => {})))
    this.conns.clear()
  }
}
