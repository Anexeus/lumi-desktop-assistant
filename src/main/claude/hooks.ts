import { randomBytes, timingSafeEqual } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { dirname } from 'node:path'
import { z } from 'zod'

// Claude Code → Lumi: documented hooks POST their event JSON to a loopback-only endpoint with a
// per-install token. Lumi only reads the event name, folder and message; nothing is executed.

export const HOOK_PORT = 47821
const MAX_BODY = 64 * 1024
export const MARKER = 'lumi-desktop-assistant' // identifies our hook entries, so uninstall removes only ours

const eventSchema = z.object({
  hook_event_name: z.string().max(60),
  cwd: z.string().max(1000).optional(),
  message: z.string().max(2000).optional(),
  session_id: z.string().max(200).optional()
})
export type HookEvent = z.infer<typeof eventSchema>

export const newToken = (): string => randomBytes(24).toString('hex')

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Starts the receiver. Returns null if the port is taken (another Lumi, or another app). */
export function startHookServer(token: () => string, onEvent: (e: HookEvent) => void, port = HOOK_PORT): Promise<Server | null> {
  let recent: number[] = []
  const server = createServer((req, res) => {
    const deny = (code: number): void => void res.writeHead(code).end()
    if (req.method !== 'POST' || req.url !== '/hook') return deny(404)
    // Browsers attach Origin; hooks (curl) don't. Refusing it blocks web pages from poking the endpoint.
    if (req.headers.origin) return deny(403)
    if (!sameToken(String(req.headers.authorization ?? ''), `Bearer ${token()}`)) return deny(401)
    const now = Date.now()
    recent = recent.filter((t) => now - t < 10_000)
    if (recent.push(now) > 30) return deny(429)
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) req.destroy()
      else chunks.push(c)
    })
    req.on('end', () => {
      let parsed
      try {
        parsed = eventSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        return deny(400)
      }
      if (!parsed.success) return deny(400)
      res.writeHead(204).end()
      onEvent(parsed.data)
    })
  })
  return new Promise((resolve) => {
    server.once('error', () => resolve(null))
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

/** The hook command: Windows' built-in curl posts the event JSON from stdin; it never blocks Claude Code for long. */
export function hookCommand(token: string, port = HOOK_PORT): string {
  return `curl -s -m 2 -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" --data-binary @- http://127.0.0.1:${port}/hook # ${MARKER}`
}

type HookEntry = { matcher?: string; hooks: { type: string; command: string; async?: boolean }[] }
type ClaudeSettings = { hooks?: Record<string, HookEntry[]> } & Record<string, unknown>

const EVENTS = ['Stop', 'Notification'] as const

const ours = (e: HookEntry): boolean => e.hooks.some((h) => h.command.includes(MARKER))

/** Adds (or replaces) Lumi's hooks in a Claude Code settings file, after backing it up. Returns the backup path. */
export function installHooks(file: string, token: string, now = Date.now()): string | null {
  let settings: ClaudeSettings = {}
  let backup: string | null = null
  if (existsSync(file)) {
    settings = JSON.parse(readFileSync(file, 'utf8')) as ClaudeSettings // refuse to touch a file we can't parse
    backup = `${file}.lumi-backup-${now}`
    copyFileSync(file, backup)
  }
  const hooks = { ...(settings.hooks ?? {}) }
  for (const event of EVENTS) {
    hooks[event] = [...(hooks[event] ?? []).filter((e) => !ours(e)), { hooks: [{ type: 'command', command: hookCommand(token), async: true }] }]
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ ...settings, hooks }, null, 2))
  return backup
}

/** Removes only Lumi's hook entries; everything else in the file is kept. */
export function uninstallHooks(file: string): void {
  if (!existsSync(file)) return
  const settings = JSON.parse(readFileSync(file, 'utf8')) as ClaudeSettings
  if (!settings.hooks) return
  const hooks: Record<string, HookEntry[]> = {}
  for (const [event, entries] of Object.entries(settings.hooks)) {
    const kept = entries.filter((e) => !ours(e))
    if (kept.length) hooks[event] = kept
  }
  if (Object.keys(hooks).length) settings.hooks = hooks
  else delete settings.hooks
  writeFileSync(file, JSON.stringify(settings, null, 2))
}

export function hooksInstalled(file: string): boolean {
  try {
    const settings = JSON.parse(readFileSync(file, 'utf8')) as ClaudeSettings
    return EVENTS.every((e) => settings.hooks?.[e]?.some(ours))
  } catch {
    return false
  }
}
