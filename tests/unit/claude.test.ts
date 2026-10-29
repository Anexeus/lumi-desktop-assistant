import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ClaudeTask } from '../../src/shared/ipc'
import { hookCommand, hooksInstalled, installHooks, MARKER, startHookServer, uninstallHooks } from '../../src/main/claude/hooks'
import { ClaudeTasks, describeEvent, explainFailure } from '../../src/main/claude/tasks'

const fake = join(process.cwd(), 'tests/fixtures/fake-claude.mjs')

function runner() {
  const finished: ClaudeTask[] = []
  const tasks = new ClaudeTasks({
    command: () => 'unused',
    onChange: () => {},
    onFinished: (t) => finished.push(t),
    spawnOverride: (args, cwd) => spawn(process.execPath, [fake, ...args], { cwd })
  })
  return { tasks, finished }
}

const until = async (check: () => boolean, ms = 10_000): Promise<void> => {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe('stream-json parsing', () => {
  it('turns events into progress and a result', () => {
    expect(describeEvent('{"type":"system","subtype":"init","model":"m","permissionMode":"plan"}').progress).toBe('Started (m, plan mode)')
    expect(describeEvent('{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"C:\\\\x\\\\a.ts"}}]}}').progress).toBe('Edit: a.ts')
    expect(describeEvent('{"type":"result","subtype":"success","is_error":false,"result":"ok","total_cost_usd":0.5,"permission_denials":[{}]}').result).toEqual({
      ok: true,
      text: 'ok',
      cost: 0.5,
      denials: 1
    })
    expect(describeEvent('not json')).toEqual({})
  })

  it('explains a missing login without touching credentials', () => {
    expect(explainFailure('Not logged in · Please run /login')).toContain('run `claude`, then type /login')
  })
})

describe('ClaudeTasks', () => {
  it('runs a task in the project folder with the chosen mode and reports progress and cost', async () => {
    const project = mkdtempSync(join(tmpdir(), 'proj-'))
    const { tasks, finished } = runner()
    tasks.start('fix the tests', project, 'plan')
    await until(() => finished.length === 1)
    const t = finished[0]!
    expect(t.status).toBe('done')
    expect(t.result).toBe('Done: fix the tests')
    expect(t.cost).toBe(0.0123)
    expect(t.denials).toBe(1)
    expect(tasks.list()[0]!.progress.join('\n')).toContain('Working in plan mode on: fix the tests')
    expect(tasks.list()[0]!.progress[1]).toBe('Read: README.md')
  })

  it('reports a failure in plain words', async () => {
    const { tasks, finished } = runner()
    tasks.start('needs login', tmpdir(), 'plan')
    await until(() => finished.length === 1)
    expect(finished[0]!.status).toBe('failed')
    expect(finished[0]!.result).toContain('/login')
  })

  it('can be canceled', async () => {
    const { tasks, finished } = runner()
    const t = tasks.start('slow job', tmpdir(), 'manual')
    await until(() => tasks.list()[0]!.progress.length > 0)
    tasks.cancel(t.id)
    await until(() => finished.length === 1)
    expect(finished[0]!.status).toBe('canceled')
  })

  it('fails clearly when Claude Code is not installed', () => {
    const tasks = new ClaudeTasks({ command: () => null, onChange: () => {}, onFinished: () => {} })
    expect(tasks.start('x', tmpdir(), 'plan').status).toBe('failed')
  })
})

describe('hooks', () => {
  it('installs alongside existing settings with a backup, and uninstalls only its own entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'claude-cfg-'))
    const file = join(dir, 'settings.json')
    const original = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] } }
    writeFileSync(file, JSON.stringify(original))
    const backup = installHooks(file, 'tok123')
    expect(JSON.parse(readFileSync(backup!, 'utf8'))).toEqual(original)
    const after = JSON.parse(readFileSync(file, 'utf8'))
    expect(after.model).toBe('opus')
    expect(after.hooks.Stop).toHaveLength(2)
    expect(hooksInstalled(file)).toBe(true)
    installHooks(file, 'tok456') // reinstall replaces, never duplicates
    expect(JSON.parse(readFileSync(file, 'utf8')).hooks.Stop).toHaveLength(2)
    uninstallHooks(file)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(original)
    expect(hookCommand('t')).toContain(MARKER)
  })

  it('accepts only authenticated, well-formed events from non-browser clients', async () => {
    const events: string[] = []
    const server = await startHookServer(() => 'secret', (e) => events.push(e.hook_event_name), 0)
    const port = (server!.address() as { port: number }).port
    const post = (headers: Record<string, string>, body: string) =>
      fetch(`http://127.0.0.1:${port}/hook`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body }).then((r) => r.status)
    expect(await post({ Authorization: 'Bearer secret' }, '{"hook_event_name":"Stop","cwd":"C:\\\\p"}')).toBe(204)
    expect(await post({ Authorization: 'Bearer wrong' }, '{"hook_event_name":"Stop"}')).toBe(401)
    expect(await post({ Authorization: 'Bearer secret', Origin: 'https://evil.example' }, '{"hook_event_name":"Stop"}')).toBe(403)
    expect(await post({ Authorization: 'Bearer secret' }, 'not json')).toBe(400)
    expect(await post({ Authorization: 'Bearer secret' }, '{"nope":1}')).toBe(400)
    expect(events).toEqual(['Stop'])
    server!.close()
  })
})
