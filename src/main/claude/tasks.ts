import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ClaudeMode, ClaudeTask } from '@shared/ipc'

// Runs tasks with the user's own Claude Code CLI in headless mode (documented `claude -p`). Never
// bypasses permissions: plan (read-only), manual (anything needing approval is denied and reported),
// or acceptEdits. Auth stays inside Claude Code; this module never reads credentials.

const MAX_PROGRESS = 30

/** Finds a `claude` executable: the configured one, then PATH, then the Claude desktop app's bundled copy. */
export function findClaude(configured: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (configured && existsSync(configured)) return configured
  for (const dir of (env['PATH'] ?? '').split(';')) {
    for (const name of ['claude.exe', 'claude.cmd', 'claude']) {
      const p = join(dir, name)
      if (dir && existsSync(p)) return p
    }
  }
  const root = join(env['LOCALAPPDATA'] ?? '', 'Claude-Data')
  try {
    for (const profile of readdirSync(root)) {
      const versions = join(root, profile, 'claude-code')
      for (const v of readdirSync(versions).sort().reverse()) {
        for (const build of readdirSync(join(versions, v))) {
          const exe = join(versions, v, build, 'claude.exe')
          if (existsSync(exe)) return exe
        }
      }
    }
  } catch {
    // not installed
  }
  return null
}

/** One line of `--output-format stream-json` → a short progress line (or null), plus the final result. */
export function describeEvent(line: string): { progress?: string; result?: { ok: boolean; text: string; cost?: number; denials: number } } {
  let e: Record<string, unknown>
  try {
    e = JSON.parse(line)
  } catch {
    return {}
  }
  if (e['type'] === 'system' && e['subtype'] === 'init') return { progress: `Started (${String(e['model'] ?? 'Claude')}, ${String(e['permissionMode'] ?? '')} mode)` }
  if (e['type'] === 'assistant') {
    const content = ((e['message'] as { content?: unknown[] } | undefined)?.content ?? []) as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[]
    const parts = content.map((c) => {
      if (c.type === 'tool_use') {
        const target = c.input?.['file_path'] ?? c.input?.['path'] ?? c.input?.['pattern'] ?? c.input?.['command'] ?? c.input?.['url'] ?? ''
        return `${c.name}${target ? `: ${basename(String(target)).slice(0, 80)}` : ''}`
      }
      return c.type === 'text' && c.text ? c.text.replace(/\s+/g, ' ').slice(0, 160) : ''
    })
    const progress = parts.filter(Boolean).join(' · ')
    return progress ? { progress } : {}
  }
  if (e['type'] === 'result') {
    const text = String(e['result'] ?? '')
    const denials = Array.isArray(e['permission_denials']) ? e['permission_denials'].length : 0
    const ok = e['subtype'] === 'success' && e['is_error'] !== true
    return { result: { ok, text, cost: typeof e['total_cost_usd'] === 'number' ? e['total_cost_usd'] : undefined, denials } }
  }
  return {}
}

/** Turns known CLI problems into something the user can act on. */
export function explainFailure(text: string): string {
  if (/not logged in|\/login/i.test(text)) return 'Claude Code isn’t signed in for command-line use. Open a terminal, run `claude`, then type /login. (Lumi never handles your Claude login.)'
  return text.slice(0, 2000) || 'Claude Code stopped without a result.'
}

export interface TaskRunnerDeps {
  command(): string | null
  onChange(tasks: ClaudeTask[]): void
  onFinished(task: ClaudeTask): void
  /** Tests only: run a fake CLI script with node instead of the real binary. */
  spawnOverride?: (args: string[], cwd: string) => ChildProcess
}

export class ClaudeTasks {
  private readonly tasks: ClaudeTask[] = []
  private readonly children = new Map<string, ChildProcess>()

  constructor(private readonly deps: TaskRunnerDeps) {}

  list(): ClaudeTask[] {
    return this.tasks.map((t) => ({ ...t, progress: [...t.progress] }))
  }

  start(prompt: string, project: string, mode: ClaudeMode): ClaudeTask {
    const task: ClaudeTask = {
      id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      prompt,
      project,
      mode,
      status: 'running',
      progress: [],
      startedAt: Date.now()
    }
    this.tasks.unshift(task)
    this.tasks.splice(20) // keep the last 20
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', mode]
    const command = this.deps.command()
    if (!command && !this.deps.spawnOverride) return this.end(task, 'failed', 'Claude Code was not found. Install it (or set its path in Settings → Claude Code).')

    let child: ChildProcess
    try {
      // No shell: the prompt is one argument, never parsed as a command line.
      child = this.deps.spawnOverride ? this.deps.spawnOverride(args, project) : spawn(command!, args, { cwd: project, windowsHide: true, shell: false })
    } catch (error) {
      return this.end(task, 'failed', error instanceof Error ? error.message : 'Could not start Claude Code.')
    }
    this.children.set(task.id, child)
    let buffer = ''
    let final: ReturnType<typeof describeEvent>['result']
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const { progress, result } = describeEvent(line)
        if (progress) {
          task.progress.push(progress)
          task.progress.splice(0, Math.max(0, task.progress.length - MAX_PROGRESS))
          this.emit()
        }
        if (result) final = result
      }
    })
    child.on('error', (error) => this.end(task, 'failed', `Could not run Claude Code: ${error.message}`))
    child.on('close', (code) => {
      this.children.delete(task.id)
      if (task.status !== 'running') return
      if (final?.ok) {
        task.cost = final.cost
        task.denials = final.denials
        return this.end(task, 'done', final.text)
      }
      this.end(task, 'failed', explainFailure(final?.text ?? `Claude Code exited with code ${code}.`))
    })
    this.emit()
    return task
  }

  cancel(id: string): void {
    const child = this.children.get(id)
    const task = this.tasks.find((t) => t.id === id)
    if (!child || !task || task.status !== 'running') return
    this.end(task, 'canceled', 'Canceled.')
    // Stop the whole process tree (Claude Code may have started commands of its own).
    if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false })
    else child.kill('SIGINT')
  }

  cancelAll(): void {
    for (const id of this.children.keys()) this.cancel(id)
  }

  private end(task: ClaudeTask, status: ClaudeTask['status'], result: string): ClaudeTask {
    if (task.status !== 'running') return task
    task.status = status
    task.result = result
    task.endedAt = Date.now()
    this.emit()
    this.deps.onFinished({ ...task })
    return task
  }

  private emit(): void {
    this.deps.onChange(this.list())
  }
}
