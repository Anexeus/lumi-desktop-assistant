import { app, BrowserWindow, session, shell } from 'electron'
import { createWriteStream, existsSync } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { once } from 'node:events'
import { extname, join } from 'node:path'
import { z } from 'zod'
import { tool, type Plugin } from './types'

// A visible, isolated browser window that Lumi uses to search and read pages. Separate in-memory
// session (no cookies kept, no permissions, no downloads), no preload, sandboxed.

const PARTITION = 'lumi-web'
const LOAD_TIMEOUT_MS = 20_000
const MAX_TEXT = 15_000
const SETTLE_MS = 1800
const MAX_DOWNLOAD_BYTES = 4 * 1024 ** 3

/** Web contents of the browser window: they may navigate to public http(s) pages, unlike the app's own windows. */
export const browserContents = new WeakSet<Electron.WebContents>()

/** Only public web addresses: no localhost, private networks, link-local, or non-http(s) schemes. */
export function isPublicWebUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  if (u.username || u.password) return false
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false
  if (!h.includes('.') && !h.includes(':')) return false // single-label names resolve on the local network
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return false // carrier-grade NAT
  if (h.includes(':') && (h === '::1' || /^(fe80|fc|fd)/.test(h) || h.startsWith('::ffff:'))) return false
  return true
}

let win: BrowserWindow | undefined
let quitting = false
app.on('before-quit', () => (quitting = true))

function browser(): BrowserWindow {
  if (win && !win.isDestroyed()) return win
  const ses = session.fromPartition(PARTITION) // not "persist:": nothing survives a restart
  ses.setPermissionRequestHandler((_c, _p, cb) => cb(false))
  ses.setPermissionCheckHandler(() => false)
  ses.on('will-download', (event) => event.preventDefault())
  win = new BrowserWindow({
    width: 1000,
    height: 760,
    title: 'Lumi — Browser',
    show: false,
    autoHideMenuBar: true,
    // Videos may start without a click (the click comes from Lumi, not the mouse).
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false, autoplayPolicy: 'no-user-gesture-required' }
  })
  browserContents.add(win.webContents)
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win?.hide()
  })
  return win
}

async function load(url: string, signal: AbortSignal): Promise<BrowserWindow> {
  const w = browser()
  w.showInactive() // browsing is always visible
  const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The page took too long to load.')), LOAD_TIMEOUT_MS))
  const aborted = new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('Canceled.')), { once: true }))
  await Promise.race([w.loadURL(url), timer, aborted])
  return w
}

// Runs in the (untrusted) page; whatever it returns is treated as untrusted data.
const READ_PAGE = `(() => ({ title: document.title, url: location.href, text: (document.body ? document.body.innerText : '').slice(0, ${MAX_TEXT}) }))()`
const READ_RESULTS = `(() => [...document.querySelectorAll('.result')].slice(0, 8).map((r) => {
  const a = r.querySelector('.result__a'); const s = r.querySelector('.result__snippet')
  return { title: a ? a.innerText : '', href: a ? a.href : '', snippet: s ? s.innerText : '' }
}))()`

/** DuckDuckGo wraps result links as /l/?uddg=<real url>. */
export function unwrapResultUrl(href: string): string {
  try {
    const u = new URL(href, 'https://duckduckgo.com')
    return u.searchParams.get('uddg') ?? u.href
  } catch {
    return href
  }
}

// Numbers the page's visible clickable things and fields (videos first) so the model can say "click 3".
const LIST_ITEMS = `(() => {
  document.querySelectorAll('[data-lumi-n]').forEach((e) => e.removeAttribute('data-lumi-n'))
  const seen = new Set()
  const items = []
  for (const el of document.querySelectorAll('a[href], button, input, textarea, [role="button"], [role="link"], [role="tab"]')) {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none') continue
    const field = el.matches('textarea, input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=hidden])')
    const raw = field ? el.placeholder || el.getAttribute('aria-label') || el.name || 'text box' : el.innerText || el.getAttribute('aria-label') || el.title || el.value || ''
    const text = String(raw).replace(/\\s+/g, ' ').trim().slice(0, 90)
    if (!text) continue
    const href = el.href ? String(el.href) : ''
    if (seen.has(text + '|' + href)) continue
    seen.add(text + '|' + href)
    const kind = field ? 'field' : /\\/watch\\?v=/.test(href) ? 'video' : /\\/shorts\\//.test(href) ? 'short' : el.tagName === 'A' ? 'link' : 'button'
    items.push({ el, text, kind })
  }
  // Real videos first so "play the first video" means item 1; Shorts sort after links.
  const order = { video: 0, field: 1, link: 2, short: 3, button: 4 }
  items.sort((a, b) => order[a.kind] - order[b.kind])
  return items.slice(0, 40).map((it, i) => (it.el.setAttribute('data-lumi-n', String(i + 1)), { n: i + 1, kind: it.kind, text: it.text }))
})()`

const clickItem = (n: number): string => `(() => {
  const el = document.querySelector('[data-lumi-n="${n}"]')
  if (!el) return false
  el.scrollIntoView({ block: 'center' })
  el.click()
  return true
})()`

const typeItem = (n: number, text: string, enter: boolean): string => `(() => {
  const el = document.querySelector('[data-lumi-n="${n}"]')
  if (!el || !('value' in el)) return false
  el.focus()
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  if (${enter}) {
    if (el.form) el.form.requestSubmit()
    else for (const type of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
  }
  return true
})()`

/** The page as the model sees it: title, address and the numbered list of things it can click or type into. */
async function snapshot(w: BrowserWindow): Promise<string> {
  await new Promise((r) => setTimeout(r, SETTLE_MS)) // single-page sites (YouTube…) render after "load"
  const items = (await w.webContents.executeJavaScript(LIST_ITEMS, true)) as { n: number; kind: string; text: string }[]
  const list = Array.isArray(items) ? items.map((i) => `${i.n}. [${String(i.kind)}] ${String(i.text).slice(0, 90)}`).join('\n') : ''
  return `${w.webContents.getTitle().slice(0, 200)}\n${w.webContents.getURL().slice(0, 300)}\n\nOn the page (browser_click or browser_type with the number):\n${list || '(nothing clickable found)'}`
}

const RISKY_FILE = /\.(exe|msi|bat|cmd|ps1|vbs|js|jar|scr|com|lnk|reg|dll)$/i
// Characters Windows forbids in file names, plus control characters.
// eslint-disable-next-line no-control-regex
const BAD_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
/** A safe file name for a download, from Content-Disposition or the URL. */
export function downloadName(url: string, disposition: string | null): string {
  const fromHeader = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition ?? '')?.[1]
  let name = fromHeader ?? new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? ''
  try {
    name = decodeURIComponent(name)
  } catch {
    // keep as is
  }
  return name.replace(BAD_NAME_CHARS, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 120) || 'download'
}

const urlInput = z.object({ url: z.url().max(2000).refine(isPublicWebUrl, 'Only public http(s) web addresses.') })

/** Sites the model can search by name, so a small model never has to build the URL itself. */
export const SITE_SEARCH = {
  youtube: 'https://www.youtube.com/results?search_query=',
  google: 'https://www.google.com/search?q=',
  wikipedia: 'https://en.wikipedia.org/w/index.php?search=',
  github: 'https://github.com/search?q=',
  reddit: 'https://www.reddit.com/search/?q=',
  maps: 'https://www.google.com/maps/search/',
  spotify: 'https://open.spotify.com/search/',
  amazon: 'https://www.amazon.com/s?k='
} as const
type Site = keyof typeof SITE_SEARCH

const openInput = z
  .object({
    url: z.url().max(2000).refine(isPublicWebUrl, 'Only public http(s) web addresses.').optional(),
    site: z.enum(Object.keys(SITE_SEARCH) as [Site, ...Site[]]).optional(),
    query: z.string().trim().min(1).max(300).optional()
  })
  .refine((i) => i.url || i.site, 'Give a url, or a site (with an optional query).')

/** Where web_open goes: the url, a site's search page, or the site's home page. */
export function openTarget({ url, site, query }: z.infer<typeof openInput>): string {
  if (url) return url
  const search = SITE_SEARCH[site!]
  return query ? search + encodeURIComponent(query) : new URL(search).origin
}

export function webPlugin(notify: (title: string, body: string) => void = () => {}): Plugin {
  return {
    id: 'core.web',
    name: 'Web',
    version: '1.0.0',
    description: 'Search the web and read pages in a visible browser window. Asks you first.',
    permissions: ['web.browse'],
    tools: [
      tool({
        name: 'web_search',
        description: 'Search the web (DuckDuckGo) and get the top results with links. Use for current facts and documentation.',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        input: z.object({ query: z.string().trim().min(1).max(300) }),
        risk: 'act',
        describe: ({ query }) => `Search the web for “${query}”`,
        async run({ query }, signal) {
          const w = await load(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, signal)
          const results = (await w.webContents.executeJavaScript(READ_RESULTS, true)) as { title: string; href: string; snippet: string }[]
          if (!Array.isArray(results) || !results.length) return 'No results.'
          return results
            .map((r, i) => `${i + 1}. ${String(r.title).slice(0, 200)}\n   ${unwrapResultUrl(String(r.href))}\n   ${String(r.snippet).slice(0, 300)}`)
            .join('\n')
        }
      }),
      tool({
        name: 'web_open',
        description: `Open a website or a search in the user's OWN browser and stop there (you cannot click or play anything in it). To play a video, click, or fill something in, use browser_open instead. Sites: ${Object.keys(SITE_SEARCH).join(', ')}; or a url.`,
        parameters: {
          type: 'object',
          properties: {
            site: { type: 'string', enum: Object.keys(SITE_SEARCH) },
            query: { type: 'string', description: 'What to search for on that site' },
            url: { type: 'string', description: 'A full https address, instead of site' }
          }
        },
        input: openInput,
        risk: 'act',
        describe: (i) => (i.url ? `Open ${new URL(i.url).host} in your browser` : `Open ${i.site}${i.query ? ` and search for “${i.query}”` : ''} in your browser`),
        async run(i) {
          const target = openTarget(i)
          await shell.openExternal(target)
          return `Opened ${target} in the user's browser.`
        }
      }),
      tool({
        name: 'browser_open',
        description: `Open a site or a search in Lumi's visible browser window and list what can be clicked. Use this whenever the user wants something played, clicked or filled in (e.g. "play lofi on YouTube": site=youtube, query=lofi, then browser_click on the first [video]). Sites: ${Object.keys(SITE_SEARCH).join(', ')}; or a url.`,
        parameters: {
          type: 'object',
          properties: {
            site: { type: 'string', enum: Object.keys(SITE_SEARCH) },
            query: { type: 'string' },
            url: { type: 'string' }
          }
        },
        input: openInput,
        risk: 'act',
        describe: (i) => (i.url ? `Open ${new URL(i.url).host} in Lumi’s browser` : `Open ${i.site}${i.query ? ` and search for “${i.query}”` : ''} in Lumi’s browser`),
        async run(i, signal) {
          const w = await load(openTarget(i), signal)
          w.show()
          return snapshot(w)
        }
      }),
      tool({
        name: 'browser_click',
        description: 'Click item number n from the latest browser_open/browser_click list (a video, link or button) in Lumi’s browser.',
        parameters: { type: 'object', properties: { item: { type: 'integer', minimum: 1 } }, required: ['item'] },
        input: z.object({ item: z.number().int().min(1).max(40) }),
        risk: 'act',
        describe: ({ item }) => `Click item ${item} in Lumi’s browser`,
        async run({ item }) {
          const w = browser()
          if (!w.webContents.getURL()) throw new Error('Nothing is open yet. Use browser_open first.')
          if (!(await w.webContents.executeJavaScript(clickItem(item), true))) throw new Error(`There is no item ${item} on the page any more.`)
          w.show()
          return snapshot(w)
        }
      }),
      tool({
        name: 'browser_type',
        description: 'Type text into field number n from the latest list in Lumi’s browser, optionally pressing Enter.',
        parameters: {
          type: 'object',
          properties: { item: { type: 'integer', minimum: 1 }, text: { type: 'string' }, enter: { type: 'boolean' } },
          required: ['item', 'text']
        },
        input: z.object({ item: z.number().int().min(1).max(40), text: z.string().max(2000), enter: z.boolean().default(true) }),
        risk: 'act',
        describe: ({ item, text }) => `Type “${text.slice(0, 60)}” into field ${item} in Lumi’s browser`,
        async run({ item, text, enter }) {
          const w = browser()
          if (!(await w.webContents.executeJavaScript(typeItem(item, text, enter), true))) throw new Error(`Item ${item} is not a text field.`)
          return snapshot(w)
        }
      }),
      tool({
        name: 'web_download',
        description: 'Download a file from a public web address into the user’s Downloads folder, in the background. Lumi never opens or runs downloaded files.',
        parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        input: urlInput,
        risk: 'act',
        describe: ({ url }) => {
          const name = downloadName(url, null)
          return `Download ${name} from ${new URL(url).host} to your Downloads folder${RISKY_FILE.test(name) ? ' (a program file: Lumi will not run it)' : ''}`
        },
        async run({ url }) {
          let current = url
          let res: Response | undefined
          for (let hop = 0; hop < 6; hop++) {
            res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(60_000) })
            const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
            if (!next) break
            current = new URL(next, current).href
            if (!isPublicWebUrl(current)) throw new Error('The download redirected to a private address, so I stopped.')
          }
          if (!res?.ok || !res.body) throw new Error(`The server answered ${res?.status ?? 'nothing'}.`)
          if (Number(res.headers.get('content-length') ?? 0) > MAX_DOWNLOAD_BYTES) throw new Error('That file is larger than 4 GB.')
          const name = downloadName(current, res.headers.get('content-disposition'))
          const dir = app.getPath('downloads')
          let file = join(dir, name)
          for (let i = 1; existsSync(file); i++) file = join(dir, `${name.slice(0, name.length - extname(name).length)} (${i})${extname(name)}`)
          const body = res.body
          // In the background, so a big file doesn't hold up the conversation; a notification says when it's done.
          void (async () => {
            const tmp = `${file}.part`
            const out = createWriteStream(tmp)
            let bytes = 0
            try {
              for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
                bytes += chunk.byteLength
                if (bytes > MAX_DOWNLOAD_BYTES) throw new Error('larger than 4 GB')
                if (!out.write(chunk)) await once(out, 'drain')
              }
              await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())))
              await rename(tmp, file)
              notify('Download finished', `${name} (${(bytes / 1024 ** 2).toFixed(1)} MB) is in your Downloads folder.`)
            } catch (error) {
              out.destroy()
              await rm(tmp, { force: true })
              notify('Download failed', `${name}: ${error instanceof Error ? error.message : error}`)
            }
          })()
          return `Downloading ${name} to ${dir} in the background; the user gets a notification when it finishes.`
        }
      }),
      tool({
        name: 'web_read',
        description: 'Open a public web page in the browser window and read its text.',
        parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        input: urlInput,
        risk: 'act',
        describe: ({ url }) => `Open ${new URL(url).host} in the browser`,
        async run({ url }, signal) {
          const w = await load(url, signal)
          const page = (await w.webContents.executeJavaScript(READ_PAGE, true)) as { title: string; url: string; text: string }
          return `${String(page.title).slice(0, 200)}\n${String(page.url).slice(0, 500)}\n\n${String(page.text).slice(0, MAX_TEXT)}`
        }
      })
    ]
  }
}
