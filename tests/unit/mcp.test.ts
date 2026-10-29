import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { McpServerConfig } from '../../src/shared/ipc'
import { McpManager, mcpToolName, parseCommandLine } from '../../src/main/tools/mcp'

describe('parseCommandLine', () => {
  it('splits commands and respects quotes', () => {
    expect(parseCommandLine('npx -y @upstash/context7-mcp')).toEqual({ command: 'npx', args: ['-y', '@upstash/context7-mcp'] })
    expect(parseCommandLine('"C:\\Program Files\\node.exe" "a b" \'c d\' e')).toEqual({ command: 'C:\\Program Files\\node.exe', args: ['a b', 'c d', 'e'] })
    expect(parseCommandLine('   ')).toEqual({ command: '', args: [] })
  })

  it('makes safe, bounded tool names', () => {
    expect(mcpToolName('My Docs!', 'get-library.docs')).toBe('mcp_my_docs_get_library_docs')
    expect(mcpToolName('x'.repeat(80), 'y').length).toBeLessThanOrEqual(64)
  })
})

describe('McpManager with a real stdio server', () => {
  const servers: McpServerConfig[] = [
    { id: 'echo', name: 'Echo', command: process.execPath, args: [join(process.cwd(), 'tests/fixtures/mcp-echo.mjs')], trusted: false, enabled: true }
  ]
  const manager = new McpManager(() => servers, () => {})
  afterAll(() => manager.closeAll())

  it('connects, lists tools, and calls them; untrusted servers always ask', { timeout: 30_000 }, async () => {
    await manager.sync()
    const info = manager.info()[0]!
    expect(info.status).toBe('ready')
    expect(info.tools.sort()).toEqual(['echo', 'shout'])

    const [plugin] = manager.plugins()
    const echo = plugin!.tools.find((t) => t.name === 'mcp_echo_echo')!
    expect(echo.risk).toBe('act') // untrusted: even read-only tools ask
    expect(await echo.run({ text: 'hi' }, new AbortController().signal)).toBe('echo: hi')
  })

  it('a trusted server’s read-only tools run without asking, others still ask', async () => {
    servers[0]!.trusted = true
    const tools = manager.plugins()[0]!.tools
    expect(tools.find((t) => t.name === 'mcp_echo_echo')!.risk).toBe('read')
    expect(tools.find((t) => t.name === 'mcp_echo_shout')!.risk).toBe('act')
  })

  it('disabling a server disconnects it and removes its tools', async () => {
    servers[0]!.enabled = false
    await manager.sync()
    expect(manager.plugins()).toEqual([])
    expect(manager.info()[0]!.status).toBe('off')
  })

  it('reports a server that cannot start', { timeout: 30_000 }, async () => {
    const bad = new McpManager(() => [{ id: 'bad', name: 'Bad', command: 'definitely-not-a-real-command-xyz', args: [], trusted: false, enabled: true }], () => {})
    await bad.sync()
    expect(bad.info()[0]!.status).toBe('error')
    await bad.closeAll()
  })
})
