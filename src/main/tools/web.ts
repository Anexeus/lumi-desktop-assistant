import { app, BrowserWindow, session, shell } from 'electron'
import { z } from 'zod'
import { tool, type Plugin } from './types'

// A visible, isolated browser window that Lumi uses to search and read pages. Separate in-memory
// session (no cookies kept, no permissions, no downloads), no preload, sandboxed.

const PARTITION = 'lumi-web'
const LOAD_TIMEOUT_MS = 20_000
const MAX_TEXT = 15_000

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
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false }
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

export function webPlugin(): Plugin {
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
        description: `Open a website, or search on one, in the user's own browser so they can watch or use it (for "open YouTube and search lofi", "play X on YouTube"). Give site (${Object.keys(SITE_SEARCH).join(', ')}) and query, or a url. You can't see the page; use web_read to read one.`,
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
