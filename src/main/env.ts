import { app } from 'electron'

// The dev server URL comes from electron-vite. A packaged build ignores it, so an
// environment variable can never point the app at remote content.
const raw = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']

export const devServerUrl = raw && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+\/?$/.test(raw) ? raw.replace(/\/$/, '') : undefined
export const devOrigin = devServerUrl ? new URL(devServerUrl).origin : undefined
