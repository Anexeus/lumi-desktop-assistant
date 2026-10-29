import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Runs the production build (out/) with an isolated profile. `npm run test:e2e` builds first.

let app: ElectronApplication
let character: Page
let userData: string
const pageErrors: string[] = []
// Errors the tests provoke on purpose (the CSP and IPC rejection checks).
const expectedConsoleErrors = [/inline script violates the following Content Security Policy/i, /Rejected (window:open|model:get|character:event)/]

test.beforeAll(async () => {
  userData = mkdtempSync(join(tmpdir(), 'desktop-assistant-e2e-'))
  // Point the AI at a closed port so this suite never depends on (or talks to) a real model.
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ ai: { baseUrl: 'http://127.0.0.1:9/v1', model: 'none' } }))
  const env = { ...process.env, DESKTOP_ASSISTANT_USER_DATA: userData } as Record<string, string>
  delete env['ELECTRON_RENDERER_URL']
  app = await electron.launch({ args: ['.'], env })
  const watch = (page: Page): void => {
    page.on('pageerror', (error) => pageErrors.push(`${page.url()}: ${error.message}`))
    // Console errors too: a CSP block only shows up here, not as an exception.
    page.on('console', (m) => {
      if (m.type() === 'error' && !expectedConsoleErrors.some((re) => re.test(m.text()))) pageErrors.push(`${page.url()}: ${m.text()}`)
    })
  }
  app.on('window', watch)
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('/character.html'))).toBe(true)
  character = app.windows().find((w) => w.url().endsWith('/character.html'))!
  for (const w of app.windows()) watch(w)
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

  // Real transparency: once the model has loaded, the corner has zero alpha and the
  // character covers a plausible share of the window (a full-body figure, not a blank or solid box).
  await expect(character.locator('body')).toHaveAttribute('data-model', 'default', { timeout: 20_000 })
  await character.waitForTimeout(300)
  const alpha = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/character.html'))!
    const image = await win.webContents.capturePage()
    const bitmap = image.toBitmap() // BGRA
    let opaque = 0
    for (let i = 3; i < bitmap.length; i += 4) if (bitmap[i]! > 16) opaque++
    return { corner: bitmap[3]!, opaqueShare: opaque / (bitmap.length / 4) }
  })
  expect(alpha.corner).toBe(0)
  expect(alpha.opaqueShare).toBeGreaterThan(0.08)
  expect(alpha.opaqueShare).toBeLessThan(0.8)
})

test('renderer has no Node access and only the typed API', async () => {
  const result = await character.evaluate(() => ({
    require: typeof (globalThis as Record<string, unknown>)['require'],
    process: typeof (globalThis as Record<string, unknown>)['process'],
    api: Object.keys(window.assistant).sort()
  }))
  expect(result.require).toBe('undefined')
  expect(result.process).toBe('undefined')
  expect(result.api).toEqual([
    'ai',
    'approve',
    'character',
    'characterEvent',
    'chat',
    'claude',
    'deleteAllData',
    'getState',
    'history',
    'integrations',
    'island',
    'memory',
    'model',
    'onDataChanged',
    'onState',
    'openWindow',
    'setAlwaysOnTop',
    'setAssistantName',
    'setCharacterVisible',
    'setIslandVisible',
    'tools',
    'voice',
    'windowControl'
  ])
})

test('CSP blocks inline script and popups are blocked', async () => {
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
  await expect(chat.getByRole('textbox', { name: 'Message' })).toHaveValue('')
  // The AI address is unreachable in this suite: the user gets a readable error and the character shows it.
  await expect(chat.locator('.bubble.error')).toContainText("Can't reach the AI")
  await expect.poll(() => character.locator('body').getAttribute('data-state')).toBe('ERROR')
  await character.evaluate(() => window.assistant.characterEvent('cancel'))

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
  // The checkbox mirrors main's state, so click and wait for the round trip instead of check()/uncheck().
  await toggle.click()
  await expect(toggle).not.toBeChecked()

  await expect.poll(() => characterWindow((w) => w.isAlwaysOnTop())).toBe(false)
  // Settings live in SQLite now; read the committed row straight from the database file.
  const db = new DatabaseSync(join(userData, 'assistant.db'), { readOnly: true })
  const row = db.prepare("SELECT value FROM kv WHERE key = 'windowState'").get() as { value: string }
  db.close()
  expect(JSON.parse(row.value).alwaysOnTop).toBe(false)

  await toggle.click()
  await expect(toggle).toBeChecked()
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

const panel = async (name: 'chat' | 'settings'): Promise<Page> => {
  await character.evaluate((n) => window.assistant.openWindow(n), name)
  await expect.poll(() => app.windows().some((w) => w.url().endsWith(`/${name}.html`))).toBe(true)
  return app.windows().find((w) => w.url().endsWith(`/${name}.html`))!
}
const characterState = (): Promise<string | null> => character.locator('body').getAttribute('data-state')

test('transient states end on their own; invalid events are ignored', async () => {
  await character.evaluate(() => window.assistant.characterEvent('notify'))
  await expect.poll(characterState).toBe('NOTIFICATION')
  await expect.poll(characterState, { timeout: 8_000 }).toBe('IDLE')

  const afterDone = await character.evaluate(() => window.assistant.characterEvent('done'))
  expect(afterDone.character).toBe('IDLE') // done while idle does nothing

  const timeout = await character.evaluate(() =>
    window.assistant.characterEvent('timeout').then(
      () => 'accepted',
      () => 'rejected'
    )
  )
  expect(timeout).toBe('rejected') // only main's own timers may send timeout
})

test('only the character window may read the model bytes', async () => {
  const settings = await panel('settings')
  const outcome = await settings.evaluate(() =>
    window.assistant.model.get().then(
      () => 'accepted',
      () => 'rejected'
    )
  )
  expect(outcome).toBe('rejected')
})

test('settings credits the default model, loads a custom .vrm and resets', async () => {
  const settings = await panel('settings')
  await expect(settings.getByText('Seed-san © VirtualCast, Inc.')).toBeVisible()

  const stubDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as typeof dialog.showOpenDialog
    }, file)

  // A file that is not a VRM is refused with a message and changes nothing.
  await stubDialog(join(process.cwd(), 'package.json'))
  await settings.getByRole('button', { name: 'Choose a .vrm file…' }).click()
  await expect(settings.getByRole('alert')).toHaveText(/Not a VRM/)
  expect((await character.evaluate(() => window.assistant.getState())).model.custom).toBe(false)

  // A real VRM is copied into the profile and the character reloads it.
  await stubDialog(join(process.cwd(), 'src/renderer/public/models/Seed-san.vrm'))
  await settings.getByRole('button', { name: 'Choose a .vrm file…' }).click()
  await expect(settings.getByRole('button', { name: 'Use the default' })).toBeVisible()
  await expect(character.locator('body')).toHaveAttribute('data-model', 'custom', { timeout: 20_000 })
  expect(readFileSync(join(userData, 'models', 'custom.vrm')).byteLength).toBeGreaterThan(1_000_000)

  await settings.getByRole('button', { name: 'Use the default' }).click()
  await expect(character.locator('body')).toHaveAttribute('data-model', 'default', { timeout: 20_000 })
  expect(existsSync(join(userData, 'models', 'custom.vrm'))).toBe(false)
})

// Runs late on purpose: Playwright treats the blocked navigation as still pending, which
// stalls later locator assertions on the same page.
test('navigation away from the app is blocked', async () => {
  await character.evaluate(() => {
    location.href = 'https://example.com/'
  })
  await character.waitForTimeout(500)
  expect(character.url()).toBe('app://bundle/character.html')
  expect(await character.evaluate(() => typeof window.assistant)).toBe('object')
})

test('a crashed window reloads itself', async () => {
  await panel('chat')
  const chatContents = (fn: string) =>
    app.evaluate(async ({ BrowserWindow }, code) => {
      const wc = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/chat.html'))!.webContents
      if (code === 'crash') return wc.forcefullyCrashRenderer(), null
      return wc.isCrashed() || wc.isLoading() ? null : await wc.executeJavaScript(code)
    }, fn)
  await chatContents("document.body.dataset.beforeCrash = '1'")
  await chatContents('crash')
  // Playwright loses its handle to a crashed page, so check the reload through main.
  await expect.poll(() => chatContents("typeof window.assistant + ':' + ('beforeCrash' in document.body.dataset)").catch(() => null)).toBe('object:false')
})

test('no uncaught renderer errors', () => {
  expect(pageErrors).toEqual([])
})
