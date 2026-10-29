import { app, net, protocol, session } from 'electron'
import { pathToFileURL } from 'node:url'
import { devOrigin } from './env'
import { APP_HOST, APP_SCHEME, PROD_CSP, devCsp, isTrustedUrl, resolveBundlePath } from './policy'
import { browserContents, isPublicWebUrl } from './tools/web'

/** Must run before `app.whenReady()`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

/** Serves the built renderer from `root` over app://bundle/ with a strict CSP. */
export function serveBundle(root: string): void {
  const notFound = (): Response => new Response('Not found', { status: 404 })
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== APP_HOST) return notFound()
    const file = resolveBundlePath(root, url.pathname)
    if (!file) return notFound()
    const res = await net.fetch(pathToFileURL(file).toString()).catch(() => null)
    if (!res?.ok) return notFound()
    const headers = new Headers(res.headers)
    headers.set('Content-Security-Policy', PROD_CSP)
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(res.body, { status: 200, headers })
  })
}

/**
 * Session-wide defaults: deny every permission except microphone-only media for the windows
 * `allowMic` approves (push-to-talk), and add the dev CSP to Vite responses.
 */
export function hardenSession(allowMic: (contents: Electron.WebContents) => boolean): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const types = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
    callback(permission === 'media' && types.length > 0 && types.every((t) => t === 'audio') && allowMic(contents))
  })
  ses.setPermissionCheckHandler((contents, permission, _origin, details) => {
    const type = 'mediaType' in details ? details.mediaType : undefined
    return permission === 'media' && type !== 'video' && !!contents && allowMic(contents)
  })
  if (devOrigin) {
    ses.webRequest.onHeadersReceived({ urls: [`${devOrigin}/*`] }, (details, callback) => {
      callback({
        responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [devCsp(devOrigin!)] }
      })
    })
  }
}

/** Every web contents: no navigation away from our pages, no popups, no webviews. */
export function hardenWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    const block = (event: { preventDefault(): void }, url: string): void => {
      // The app's own pages never navigate away; Lumi's browser window may go to public web pages only.
      const allowed = browserContents.has(contents) ? isPublicWebUrl(url) : isTrustedUrl(url, devOrigin)
      if (!allowed) {
        event.preventDefault()
        console.warn(`Blocked navigation to ${url}`)
      }
    }
    contents.on('will-navigate', block)
    contents.on('will-redirect', block)
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    let crashes = 0
    contents.on('render-process-gone', (_e, details) => {
      // Recover our own windows from a renderer crash; give up after a few so a crash loop can't spin.
      if (details.reason === 'clean-exit' || browserContents.has(contents) || ++crashes > 3) return
      console.warn(`Renderer ${details.reason}; reloading`)
      contents.reload()
    })
  })
}
