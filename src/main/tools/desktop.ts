// Seeing and operating Windows apps: a long-lived helper (resources/scripts/desktop.ps1, fixed and bundled) answers
// structured requests through Windows UI Automation, Windows OCR and SendInput. The model never sends commands, only
// these operations, and every action returns the window's new state so the model can check that it worked.
import { shell } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { z } from 'zod'
import { tool, type Plugin } from './types'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}
interface WindowInfo {
  handle: number
  title: string
  process: string
  rect: Rect | null
  minimized: boolean
  active?: boolean
}
interface Element {
  n: number
  type: string
  name: string
  value: string | null
  enabled: boolean
  rect: Rect
}
interface Look {
  window: WindowInfo
  elements: Element[]
  text: { text: string; x: number; y: number }[] | null
}

const TIMEOUT_MS = 20_000

/** The helper process. One request at a time; restarted if it dies; killed by stop(). */
export class DesktopHelper {
  private proc: ChildProcess | undefined
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly script: () => string) {}

  private start(): ChildProcess {
    if (this.proc && this.proc.exitCode === null) return this.proc
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.script()], {
      windowsHide: true,
      env: { ...process.env, LUMI_PID: String(process.pid) }, // so the helper never treats Lumi's own windows as the target
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.proc = proc
    createInterface({ input: proc.stdout! }).on('line', (line) => {
      let msg: { id: number; ok: boolean; result?: unknown; error?: string }
      try {
        msg = JSON.parse(line)
      } catch {
        return // stray output
      }
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      clearTimeout(p.timer)
      if (msg.ok) p.resolve(msg.result)
      else p.reject(new Error(msg.error ?? 'The desktop helper failed.'))
    })
    proc.stderr?.resume()
    proc.on('exit', () => {
      for (const p of this.pending.values()) p.reject(new Error('The desktop helper stopped.'))
      this.pending.clear()
      if (this.proc === proc) this.proc = undefined
    })
    return proc
  }

  /** Sends one operation; requests are serialised so two actions never interleave on the desktop. */
  request<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    const run = (): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const proc = this.start()
        const id = this.nextId++
        const timer = setTimeout(() => {
          this.pending.delete(id)
          reject(new Error('Windows did not respond in time.'))
          this.stop() // a hung helper is restarted on the next request
        }, TIMEOUT_MS)
        this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
        proc.stdin!.write(`${JSON.stringify({ ...args, id, op })}\n`)
      })
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => {})
    return result
  }

  /** Emergency stop: kills the helper (any action in flight fails) and drops queued ones. */
  stop(): void {
    this.proc?.kill()
    this.proc = undefined
    this.queue = Promise.resolve()
  }
}

const rectText = (r: Rect | null): string => (r ? `at ${r.x},${r.y} size ${r.w}×${r.h}` : '')

/** What the model reads: the window, its numbered controls, and (if UI Automation sees little) OCR text. */
export function describeLook(look: Look): string {
  const w = look.window
  const lines = [`Window: “${w.title}” (${w.process}) ${rectText(w.rect)}${w.minimized ? ' (minimized)' : ''}`]
  if (look.elements.length) {
    lines.push('Controls (use the number with ui_act / ui_type):')
    for (const e of look.elements) {
      lines.push(`${e.n}. [${e.type}] ${e.name || '(no name)'}${e.value ? ` = “${e.value}”` : ''}${e.enabled ? '' : ' (disabled)'}`)
    }
  } else lines.push('No controls are exposed to UI Automation in this window.')
  if (look.text?.length) {
    lines.push('Text seen on screen (OCR, with positions for mouse_click):')
    for (const t of look.text.slice(0, 80)) lines.push(`- (${t.x},${t.y}) ${t.text}`)
  }
  return lines.join('\n')
}

const target = z.object({ window: z.string().trim().max(200).optional() })
const windowArgs = (window?: string): Record<string, unknown> => (window ? { title: window } : {})

/** WhatsApp Web's "send" link: opens the chat with the message typed in (`phone` is digits with the country code). */
export const whatsappUrl = (phone: string, message: string): string =>
  `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`

export interface Vision {
  /** Why a screenshot can't be described now, or null if it can. */
  unavailable(): string | null
  /** Where the screenshot would go (named in the approval prompt). */
  where(): string
  describe(pngBase64: string, question: string): Promise<string>
}

export function desktopPlugin(helper: DesktopHelper, onControl: (active: boolean) => void, vision: Vision): Plugin {
  /** Runs an action, then looks again so the result reflects what is now on screen. */
  const actThenLook = async (window: string | undefined, act: () => Promise<{ done: string }>): Promise<string> => {
    onControl(true)
    try {
      const { done } = await act()
      await new Promise((r) => setTimeout(r, 600)) // let the app react
      const look = await helper.request<Look>('look', windowArgs(window))
      return `Action: ${done}. Check below whether it had the intended effect before saying it worked.\n\n${describeLook(look)}`
    } finally {
      onControl(false)
    }
  }
  return {
    id: 'core.desktop',
    name: 'Screen and desktop control',
    version: '1.0.0',
    description:
      'See the active window (controls via UI Automation, text via Windows OCR) and operate apps: focus, click, type, keys, scroll. Every action asks first. Disable this plugin to turn desktop control off.',
    permissions: ['desktop.control'],
    tools: [
      tool({
        name: 'screen_look',
        description:
          'Look at a window: its title, numbered controls (buttons, fields, menus, tabs) and visible text. Use before acting and to find errors, buttons or settings. window = part of a title or app name; empty = the active window.',
        parameters: { type: 'object', properties: { window: { type: 'string' }, read_text: { type: 'boolean', description: 'Also read all visible text (OCR)' } } },
        input: target.extend({ read_text: z.boolean().default(false) }),
        risk: 'act', // screen contents are private: asks (once, or for this chat)
        describe: ({ window }) => `Look at ${window ? `the “${window}” window` : 'the active window'}`,
        async run({ window, read_text }) {
          return describeLook(await helper.request<Look>('look', { ...windowArgs(window), ocr: read_text }))
        }
      }),
      tool({
        name: 'screen_picture',
        description:
          'See a window as an image and ask a question about it: for what screen_look cannot read (games, images, canvases, apps without controls). Uses the vision model.',
        parameters: { type: 'object', properties: { question: { type: 'string' }, window: { type: 'string' } }, required: ['question'] },
        input: target.extend({ question: z.string().trim().min(1).max(500) }),
        risk: 'act',
        describe: ({ window }) => `Send a screenshot of ${window ? `“${window}”` : 'the active window'} to ${vision.where()}`,
        check: () => vision.unavailable(),
        async run({ window, question }) {
          const { png } = await helper.request<{ png: string }>('screenshot', windowArgs(window))
          return `What ${vision.where()} sees in the screenshot:\n${await vision.describe(png, `${question}\nDescribe positions of anything the user may need to click.`)}`
        }
      }),
      tool({
        name: 'windows_list',
        description: 'List the open windows (title, app, which one is active).',
        parameters: { type: 'object', properties: {} },
        input: z.object({}),
        risk: 'read',
        describe: () => 'Listed open windows',
        async run() {
          const list = await helper.request<WindowInfo[]>('windows')
          return list.map((w) => `${w.active ? '* ' : '- '}“${w.title}” (${w.process})${w.minimized ? ' minimized' : ''}`).join('\n') || 'No windows.'
        }
      }),
      tool({
        name: 'window_control',
        description: 'Bring a window to the front, or minimize, maximize, restore or close it.',
        parameters: {
          type: 'object',
          properties: { window: { type: 'string' }, action: { type: 'string', enum: ['focus', 'minimize', 'maximize', 'restore', 'close'] } },
          required: ['window', 'action']
        },
        input: z.object({ window: z.string().trim().min(1).max(200), action: z.enum(['focus', 'minimize', 'maximize', 'restore', 'close']) }),
        risk: 'act',
        describe: ({ window, action }) => `${action[0]!.toUpperCase()}${action.slice(1)} the “${window}” window`,
        async run({ window, action }) {
          if (action === 'focus') return actThenLook(window, async () => (await helper.request('focus', { title: window }), { done: 'brought to front' }))
          onControl(true)
          try {
            await helper.request('window', { title: window, action })
          } finally {
            onControl(false)
          }
          return `Done: ${action}.`
        }
      }),
      tool({
        name: 'whatsapp_message',
        description:
          'Send a WhatsApp message through WhatsApp Web in the user’s own browser (they must be logged in there). Needs the phone number ' +
          'with country code, e.g. +91 98765 43210: use one the user gave or asked you to remember, or ask for it.',
        parameters: { type: 'object', properties: { phone: { type: 'string' }, message: { type: 'string' } }, required: ['phone', 'message'] },
        input: z.object({
          phone: z
            .string()
            .transform((p) => p.replace(/\D/g, ''))
            .pipe(z.string().regex(/^\d{8,15}$/, 'Give the number with its country code, e.g. +91 98765 43210.')),
          message: z.string().trim().min(1).max(2000)
        }),
        risk: 'act',
        describe: ({ phone, message }) => `Send “${message.slice(0, 60)}${message.length > 60 ? '…' : ''}” to +${phone} on WhatsApp`,
        async run({ phone, message }) {
          await shell.openExternal(whatsappUrl(phone, message))
          onControl(true)
          try {
            // WhatsApp Web takes a while to load and open the chat; then its Send button appears.
            for (let i = 0; i < 14; i++) {
              await new Promise((r) => setTimeout(r, 2500))
              const look = await helper.request<Look>('look', { title: 'WhatsApp', max: 400 }).catch(() => null)
              const send = look?.elements.find((e) => /^send$/i.test(e.name.trim()) && e.enabled)
              if (send) {
                await helper.request('act', { item: send.n, action: 'click' })
                return `Sent “${message.slice(0, 80)}” to +${phone} with WhatsApp Web.`
              }
            }
          } finally {
            onControl(false)
          }
          return 'WhatsApp Web opened with the message typed in, but no Send button appeared: the user probably has to log in at web.whatsapp.com (scan the QR code with their phone). Tell them.'
        }
      }),
      tool({
        name: 'ui_act',
        description: 'Click or operate control number `item` from the latest screen_look (invoke, toggle, expand, select or focus).',
        parameters: {
          type: 'object',
          properties: { item: { type: 'integer' }, action: { type: 'string', enum: ['click', 'toggle', 'expand', 'select', 'focus'] }, window: { type: 'string' } },
          required: ['item']
        },
        input: target.extend({ item: z.number().int().min(1).max(500), action: z.enum(['click', 'toggle', 'expand', 'select', 'focus']).default('click') }),
        risk: 'act',
        describe: ({ item, action }) => `${action === 'click' ? 'Click' : action[0]!.toUpperCase() + action.slice(1)} control ${item} on screen`,
        run: ({ item, action, window }) => actThenLook(window, () => helper.request('act', { item, action }))
      }),
      tool({
        name: 'ui_type',
        description: 'Type text: into control number `item` (sets its value), or at the keyboard focus if no item. enter=true presses Enter after.',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string' }, item: { type: 'integer' }, enter: { type: 'boolean' }, window: { type: 'string' } },
          required: ['text']
        },
        input: target.extend({ text: z.string().max(5000), item: z.number().int().min(1).max(500).optional(), enter: z.boolean().default(false) }),
        risk: 'act',
        describe: ({ text, item }) => `Type “${text.slice(0, 60)}${text.length > 60 ? '…' : ''}”${item ? ` into control ${item}` : ''}`,
        run: ({ text, item, enter, window }) =>
          actThenLook(window, async () => {
            if (item) {
              try {
                await helper.request('act', { item, action: 'set', text })
                if (enter) await helper.request('keys', { keys: 'enter' })
                return { done: 'set the text' }
              } catch {
                await helper.request('act', { item, action: 'focus' }) // no value pattern: focus it and type instead
              }
            }
            return helper.request<{ done: string }>('type', { text, enter })
          })
      }),
      tool({
        name: 'keys_press',
        description: 'Press a key or shortcut in the active window, e.g. "ctrl+s", "ctrl+shift+p", "alt+tab", "enter", "f5".',
        parameters: { type: 'object', properties: { keys: { type: 'string' } }, required: ['keys'] },
        input: z.object({ keys: z.string().trim().min(1).max(40).regex(/^[a-z0-9+ ]+$/i, 'Use names like ctrl+s') }),
        risk: 'act',
        describe: ({ keys }) => `Press ${keys}`,
        run: ({ keys }) => actThenLook(undefined, () => helper.request('keys', { keys }))
      }),
      tool({
        name: 'mouse_click',
        description: 'Click at screen coordinates (from screen_look positions). Prefer ui_act; use this only when the target has no control number.',
        parameters: {
          type: 'object',
          properties: { x: { type: 'integer' }, y: { type: 'integer' }, right: { type: 'boolean' }, double: { type: 'boolean' } },
          required: ['x', 'y']
        },
        input: z.object({ x: z.number().int().min(-20000).max(20000), y: z.number().int().min(-20000).max(20000), right: z.boolean().default(false), double: z.boolean().default(false) }),
        risk: 'act',
        describe: ({ x, y, right, double }) => `${double ? 'Double-click' : right ? 'Right-click' : 'Click'} at ${x},${y}`,
        run: (a) => actThenLook(undefined, () => helper.request('click', a))
      }),
      tool({
        name: 'mouse_scroll',
        description: 'Scroll the mouse wheel (positive = up) over coordinates, or where the mouse is.',
        parameters: { type: 'object', properties: { amount: { type: 'integer' }, x: { type: 'integer' }, y: { type: 'integer' } }, required: ['amount'] },
        input: z.object({ amount: z.number().int().min(-50).max(50), x: z.number().int().optional(), y: z.number().int().optional() }),
        risk: 'act',
        describe: ({ amount }) => `Scroll ${amount > 0 ? 'up' : 'down'} ${Math.abs(amount)}`,
        run: (a) => actThenLook(undefined, () => helper.request('scroll', a))
      })
    ]
  }
}
