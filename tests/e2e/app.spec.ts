import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Runs the production build (out/) with an isolated profile. `npm run test:e2e` builds first.

let app: ElectronApplication
let character: Page
let userData: string
const pageErrors: string[] = []

test.beforeAll(async () => {
  userData = mkdtempSync(join(tmpdir(), 'desktop-assistant-e2e-'))
  const env = { ...process.env, DESKTOP_ASSISTANT_USER_DATA: userData } as Record<string, string>
  delete env['ELECTRON_RENDERER_URL']
  app = await electron.launch({ args: ['.'], env })
  const watch = (page: Page): void => {
    page.on('pageerror', (error) => pageErrors.push(`${page.url()}: ${error.message}`))
  }
  app.on('window', watch)
  character = await app.firstWindow()
  watch(character)
  await character.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
})

const characterWindow = <T>(fn: (w: Electron.BrowserWindow) => T): Promise<T> =>
  app.evaluate(({ BrowserWindow }, src) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/character.html'))!
    return new Function('w', `return (${src})(w)`)(win)
  }, fn.toString())

test('character window is transparent, frameless, on top and served from the bundle', async () => {
  expect(character.url()).toBe('app://bundle/character.html')
  const info = await characterWindow((w) => ({
    onTop: w.isAlwaysOnTop(),
    visible: w.isVisible(),
    // Present at runtime but missing from Electron 45's type definitions.
    prefs: (w.webContents as unknown as { getLastWebPreferences(): Record<string, unknown> }).getLastWebPreferences()
  }))
  expect(info.onTop).toBe(true)
  expect(info.visible).toBe(true)
  expect(info.prefs).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false })
  await expect(character.locator('#stage')).toBeVisible()

  // Real transparency: the top-left corner of the rendered page has zero alpha,
  // while the centre (the character's body) is opaque.
  await character.waitForTimeout(300)
  const alpha = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/character.html'))!
    const image = await win.webContents.capturePage()
    const { width, height } = image.getSize()
    const bitmap = image.toBitmap() // BGRA
    const at = (x: number, y: number): number => bitmap[(y * width + x) * 4 + 3]!
    return { corner: at(2, 2), centre: at(Math.floor(width / 2), Math.floor(height / 2)) }
  })
  expect(alpha.corner).toBe(0)
  expect(alpha.centre).toBe(255)
})

test('renderer has no Node access and only the typed API', async () => {
  const result = await character.evaluate(() => ({
    require: typeof (globalThis as Record<string, unknown>)['require'],
    process: typeof (globalThis as Record<string, unknown>)['process'],
    api: Object.keys(window.assistant).sort()
  }))
  expect(result.require).toBe('undefined')
  expect(result.process).toBe('undefined')
  expect(result.api).toEqual(['character', 'getState', 'onState', 'openWindow', 'setAlwaysOnTop', 'setCharacterVisible'])
})

test('CSP blocks inline script, navigation and popups are blocked', async () => {
  const injected = await character.evaluate(async () => {
    const s = document.createElement('script')
    s.textContent = 'window.__injected = true'
    document.head.append(s)
    await new Promise((r) => setTimeout(r, 50))
    return (window as unknown as { __injected?: boolean }).__injected ?? false
  })
  expect(injected).toBe(false)

  const popup = await character.evaluate(() => window.open('https://example.com') === null)
  expect(popup).toBe(true)

  await character.evaluate(() => {
    location.href = 'https://example.com/'
  })
  await character.waitForTimeout(500)
  expect(character.url()).toBe('app://bundle/character.html')
})

test('IPC rejects invalid payloads', async () => {
  const outcome = await character.evaluate(() =>
    window.assistant.openWindow('devtools' as never).then(
      () => 'accepted',
      () => 'rejected'
    )
  )
  expect(outcome).toBe('rejected')
})

test('opens the chat window beside the character', async () => {
  const opened = app.waitForEvent('window')
  await character.evaluate(() => window.assistant.openWindow('chat'))
  const chat = await opened
  await chat.waitForLoadState('domcontentloaded')
  expect(chat.url()).toBe('app://bundle/chat.html')
  await expect(chat.getByRole('textbox', { name: 'Message' })).toBeVisible()

  await chat.getByRole('textbox', { name: 'Message' }).fill('hello')
  await chat.keyboard.press('Enter')
  await expect(chat.locator('.bubble.user')).toHaveText('You: hello')
  await expect(chat.getByText('no AI provider is connected')).toBeVisible()
  await expect(chat.getByRole('textbox', { name: 'Message' })).toHaveValue('')

  const [charBounds, chatBounds] = await app.evaluate(({ BrowserWindow }) => {
    const find = (page: string) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith(page))!
    return [find('/character.html').getBounds(), find('/chat.html').getBounds()]
  })
  const beside = chatBounds.x + chatBounds.width <= charBounds.x || chatBounds.x >= charBounds.x + charBounds.width
  expect(beside).toBe(true)
})

test('settings toggle always-on-top and persist it', async () => {
  const opened = app.waitForEvent('window')
  await character.evaluate(() => window.assistant.openWindow('settings'))
  const settings = await opened
  await settings.waitForLoadState('domcontentloaded')
  const toggle = settings.getByRole('checkbox', { name: /Always on top/ })
  await expect(toggle).toBeChecked()
  await toggle.uncheck()

  await expect.poll(() => characterWindow((w) => w.isAlwaysOnTop())).toBe(false)
  const saved = JSON.parse(readFileSync(join(userData, 'window-state.json'), 'utf8'))
  expect(saved.alwaysOnTop).toBe(false)

  await toggle.check()
  await expect.poll(() => characterWindow((w) => w.isAlwaysOnTop())).toBe(true)
})

test('character can be resized within limits and dragged', async () => {
  await character.evaluate(() => {
    window.assistant.character.resize(50, 50)
    window.assistant.character.resizeEnd()
  })
  await expect.poll(() => characterWindow((w) => w.getContentSize())).toEqual([160, 200])

  await character.evaluate(() => {
    window.assistant.character.resize(320, 420)
    window.assistant.character.resizeEnd()
  })
  await expect.poll(() => characterWindow((w) => w.getContentSize())).toEqual([320, 420])

  const before = await characterWindow((w) => { const b = w.getContentBounds(); return [b.x, b.y] })
  await character.evaluate(() => {
    const c = window.assistant.character
    c.dragStart(500, 500)
    c.dragMove(460, 470)
    c.dragEnd()
  })
  await expect.poll(() => characterWindow((w) => { const b = w.getContentBounds(); return [b.x, b.y] })).toEqual([before[0]! - 40, before[1]! - 30])
  await expect.poll(() => characterWindow((w) => w.getContentSize())).toEqual([320, 420])
})

test('character can be hidden and shown; shortcut state matches registration', async () => {
  await character.evaluate(() => window.assistant.setCharacterVisible(false))
  await expect.poll(() => characterWindow((w) => w.isVisible())).toBe(false)
  await character.evaluate(() => window.assistant.setCharacterVisible(true))
  await expect.poll(() => characterWindow((w) => w.isVisible())).toBe(true)

  const state = await character.evaluate(() => window.assistant.getState())
  const registered = await app.evaluate(({ globalShortcut }, acc) => globalShortcut.isRegistered(acc), state.shortcut.accelerator)
  expect(state.shortcut.registered).toBe(registered)
})

test('no uncaught renderer errors', () => {
  expect(pageErrors).toEqual([])
})
