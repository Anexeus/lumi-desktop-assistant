// Pure security policy helpers (no Electron imports) so they can be unit tested.
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const APP_SCHEME = 'app'
export const APP_HOST = 'bundle'

/** Production pages: scripts and styles only from the bundle, nothing remote. */
export const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

/** Dev only: Vite's React Refresh preamble is an inline script and HMR uses a websocket. */
export function devCsp(devOrigin: string): string {
  const ws = devOrigin.replace(/^http/, 'ws')
  return [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${ws}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ')
}

/** True only for our own pages: the app:// bundle, or the local Vite dev server in development. */
export function isTrustedUrl(url: string, devOrigin: string | undefined): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol === `${APP_SCHEME}:` && u.host === APP_HOST) return true
  if (!devOrigin) return false
  const dev = new URL(devOrigin)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(dev.hostname)
  return loopback && u.origin === dev.origin
}

/**
 * Maps an app:// URL path to a file under `root`. Returns null for anything that would
 * escape the root (.., encoded separators, absolute or drive paths).
 */
export function resolveBundlePath(root: string, urlPath: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  const rel = decoded.replace(/^\/+/, '') || 'index.html'
  if (isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return null
  const base = resolve(root)
  const target = resolve(base, rel)
  const fromBase = relative(base, target)
  if (fromBase === '' || fromBase.startsWith('..') || isAbsolute(fromBase) || fromBase.split(sep).includes('..')) {
    return null
  }
  return target
}
