// Coding help without a shell: run a project's own package.json scripts (npm run <script>) in an approved folder,
// with an explicit working directory, captured output, timeouts and cancellation. No other command can be run.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import { z } from 'zod'
import { tool, type Plugin } from './types'

const MAX_OUTPUT = 12_000
const RUN_TIMEOUT_MS = 15 * 60_000
const SERVER_WAIT_MS = 20_000
/** Scripts that keep running (dev servers, watchers): started in the background and left running. */
const LONG_RUNNING = /^(dev|start|serve|preview|watch)(:|$)|:watch$/

export interface ProjectInfo {
  folder: string
  scripts: Record<string, string>
  manager: 'npm' | 'pnpm' | 'yarn' | 'bun'
}

/** Finds the project folder: an approved folder, or a folder inside one, that contains package.json. */
export function resolveProject(approved: string[], project: string): ProjectInfo {
  const wanted = project.trim()
  const candidates: string[] = []
  for (const root of approved) {
    if (isAbsolute(wanted)) candidates.push(wanted)
    else {
      candidates.push(join(root, wanted))
      if (basename(root).toLowerCase() === wanted.toLowerCase()) candidates.push(root)
    }
  }
  for (const folder of candidates) {
    const inside = approved.some((root) => {
      const rel = relative(root, folder)
      return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
    })
    if (!inside || !existsSync(join(folder, 'package.json'))) continue
    let pkg: { scripts?: Record<string, string> }
    try {
      pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
    } catch {
      throw new Error(`${join(folder, 'package.json')} is not valid JSON.`)
    }
    const manager = existsSync(join(folder, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(join(folder, 'yarn.lock')) ? 'yarn' : existsSync(join(folder, 'bun.lockb')) ? 'bun' : 'npm'
    return { folder, scripts: pkg.scripts ?? {}, manager }
  }
  throw new Error(
    `No package.json found for “${project}” inside your approved folders (${approved.map((a) => basename(a)).join(', ') || 'none'}). ` +
      'Add the project folder in Settings → Tools, or give its path.'
  )
}

/** node.exe from PATH and the npm that ships with it (npm.cmd can't be started without a shell). */
function findNpm(): { node: string; cli: string } {
  let node: string
  try {
    node = execFileSync('where.exe', ['node'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)[0]!.trim()
  } catch {
    throw new Error('Node.js is not installed (or not on PATH), so project scripts cannot run. Install it from nodejs.org.')
  }
  const cli = join(dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(cli)) throw new Error(`npm was not found next to ${node}.`)
  return { node, cli }
}

interface Owned {
  id: number
  project: string
  script: string
  proc: ChildProcess
  output: string
  exit: number | null
}

const tail = (s: string): string => (s.length > MAX_OUTPUT ? `…${s.slice(-MAX_OUTPUT)}` : s)
const killTree = (pid: number | undefined): void => {
  if (pid) spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }).on('error', () => {})
}

export function projectsPlugin(folders: () => string[]): Plugin {
  const owned = new Map<number, Owned>()
  let nextId = 1
  const project = z.string().trim().min(1).max(1000)
  return {
    id: 'core.projects',
    name: 'Projects (scripts, VS Code, terminal)',
    version: '1.0.0',
    description: 'Run a project’s own package.json scripts (build, test, lint, dev) in approved folders, read their output, stop them. Asks first.',
    permissions: ['projects.run'],
    tools: [
      tool({
        name: 'project_info',
        description: 'Check a project: its folder, that package.json exists, its scripts and package manager. Do this before running anything.',
        parameters: { type: 'object', properties: { project: { type: 'string', description: 'Folder name or path inside an approved folder' } }, required: ['project'] },
        input: z.object({ project }),
        risk: 'read',
        describe: ({ project }) => `Checked project ${project}`,
        async run({ project }) {
          const p = resolveProject(folders(), project)
          const scripts = Object.entries(p.scripts).map(([k, v]) => `- ${k}: ${v}`)
          return `Folder: ${p.folder}\npackage.json: found\nPackage manager: ${p.manager}\nScripts:\n${scripts.join('\n') || '(none)'}`
        }
      }),
      tool({
        name: 'project_run',
        description:
          'Run one of the project’s package.json scripts (npm run <script>) in its folder and return the exit code and output. Dev servers (dev, start, serve, watch) keep running in the background.',
        parameters: { type: 'object', properties: { project: { type: 'string' }, script: { type: 'string' } }, required: ['project', 'script'] },
        input: z.object({ project, script: z.string().trim().min(1).max(100) }),
        risk: 'act',
        describe: ({ project, script }) => `Run “npm run ${script}” in ${basename(project)}`,
        check: ({ project, script }) => {
          try {
            const p = resolveProject(folders(), project)
            if (p.manager !== 'npm') return `This project uses ${p.manager}; Lumi can only run npm scripts.`
            return p.scripts[script] ? null : `package.json has no “${script}” script. Available: ${Object.keys(p.scripts).join(', ') || 'none'}.`
          } catch (error) {
            return error instanceof Error ? error.message : String(error)
          }
        },
        async run({ project, script }, signal) {
          const p = resolveProject(folders(), project)
          const { node, cli } = findNpm()
          // Only the script name reaches npm, as an argument (no shell), from a folder Lumi verified above.
          const proc = spawn(node, [cli, 'run', script], { cwd: p.folder, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0' } })
          const job: Owned = { id: nextId++, project: p.folder, script, proc, output: '', exit: null }
          owned.set(job.id, job)
          const collect = (d: Buffer): void => void (job.output = tail(job.output + d.toString()))
          proc.stdout?.on('data', collect)
          proc.stderr?.on('data', collect)
          const ended = new Promise<number>((resolve) => {
            proc.on('error', (e) => {
              job.output += `\n${e.message}`
              resolve(-1)
            })
            proc.on('exit', (code) => resolve((job.exit = code ?? -1)))
          })
          const longRunning = LONG_RUNNING.test(script)
          const limit = new Promise<'time'>((r) => setTimeout(() => r('time'), longRunning ? SERVER_WAIT_MS : RUN_TIMEOUT_MS))
          const cancel = new Promise<'cancel'>((r) => signal.addEventListener('abort', () => r('cancel'), { once: true }))
          const outcome = await Promise.race([ended, limit, cancel])
          const where = `Folder: ${p.folder}\nCommand: npm run ${script}`
          if (outcome === 'cancel') {
            killTree(proc.pid)
            return `${where}\nCanceled.`
          }
          if (outcome === 'time') {
            if (longRunning) return `${where}\nStill running in the background (job ${job.id}; stop it with project_stop). Output so far:\n${job.output}`
            killTree(proc.pid)
            return `${where}\nStopped after ${RUN_TIMEOUT_MS / 60_000} minutes without finishing. Output:\n${job.output}`
          }
          owned.delete(job.id)
          return `${where}\nExit code: ${outcome} (${outcome === 0 ? 'success' : 'FAILED'})\nOutput:\n${job.output || '(none)'}`
        }
      }),
      tool({
        name: 'project_jobs',
        description: 'List scripts Lumi started that are still running (dev servers), with their latest output.',
        parameters: { type: 'object', properties: {} },
        input: z.object({}),
        risk: 'read',
        describe: () => 'Checked running scripts',
        async run() {
          const jobs = [...owned.values()]
          if (!jobs.length) return 'Nothing Lumi started is running.'
          return jobs
            .map((j) => `Job ${j.id}: npm run ${j.script} in ${j.project} — ${j.exit === null ? 'running' : `exited ${j.exit}`}\n${j.output.slice(-2000)}`)
            .join('\n\n')
        }
      }),
      tool({
        name: 'project_stop',
        description: 'Stop a script Lumi started (job number from project_run or project_jobs), or all of them.',
        parameters: { type: 'object', properties: { job: { type: 'integer', description: 'Omit to stop all' } } },
        input: z.object({ job: z.number().int().min(1).optional() }),
        risk: 'act',
        describe: ({ job }) => (job ? `Stop job ${job}` : 'Stop every script Lumi started'),
        async run({ job }) {
          const jobs = job ? [owned.get(job)].filter((j): j is Owned => !!j) : [...owned.values()]
          if (!jobs.length) return 'Nothing to stop.'
          for (const j of jobs) {
            killTree(j.proc.pid)
            owned.delete(j.id)
          }
          return `Stopped ${jobs.map((j) => `npm run ${j.script}`).join(', ')}.`
        }
      }),
      tool({
        name: 'project_open',
        description: 'Open a project folder in VS Code (or a terminal in that folder, with where="terminal"). The user does the typing in a terminal.',
        parameters: { type: 'object', properties: { project: { type: 'string' }, where: { type: 'string', enum: ['vscode', 'terminal'] } }, required: ['project'] },
        input: z.object({ project, where: z.enum(['vscode', 'terminal']).default('vscode') }),
        risk: 'act',
        describe: ({ project, where }) => `Open ${basename(project)} in ${where === 'terminal' ? 'a terminal' : 'VS Code'}`,
        async run({ project, where }) {
          const folder = resolveProject(folders(), project).folder
          const local = process.env['LOCALAPPDATA'] ?? ''
          const exe =
            where === 'terminal'
              ? join(local, 'Microsoft', 'WindowsApps', 'wt.exe')
              : [join(local, 'Programs', 'Microsoft VS Code', 'Code.exe'), join(process.env['ProgramFiles'] ?? '', 'Microsoft VS Code', 'Code.exe')].find(existsSync) ?? ''
          if (!existsSync(exe)) return where === 'terminal' ? 'Windows Terminal is not installed.' : 'VS Code is not installed in its usual place.'
          spawn(exe, where === 'terminal' ? ['-d', folder] : [folder], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
          return `Opened ${folder} in ${where === 'terminal' ? 'Windows Terminal' : 'VS Code'}.`
        }
      })
    ]
  }
}
