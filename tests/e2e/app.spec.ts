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
    'local',
    'memory',
    'menu',
    'model',
    'onDataChanged',
    'onState',
    'openWindow',
    'setAlwaysOnTop',
    'setAssistantName',
    'setCharacterVisible',
    'setIslandStyle',
    'setIslandVisible',
    'setShortcut',
    'stop',
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
  const settings = await panel('settings') // Settings opens inside the chat window, on the General tab
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

test('scrolling over her resizes smoothly around her feet; scrolling elsewhere does not', async () => {
  await character.evaluate(() => {
    window.assistant.character.resize(320, 420)
    window.assistant.character.resizeEnd()
  })
  await expect.poll(() => characterWindow((w) => w.getContentSize())).toEqual([320, 420])
  const feet = (): Promise<number[]> => characterWindow((w) => { const b = w.getContentBounds(); return [b.x + b.width / 2, b.y + b.height] })
  const before = await feet()
  await character.mouse.move(160, 250)
  await character.mouse.wheel(0, -300) // scroll up = bigger
  await expect.poll(() => characterWindow((w) => w.getContentSize()[0]), { timeout: 5000 }).toBeGreaterThan(400)
  await character.waitForTimeout(600) // let the easing finish
  const [w, h] = await characterWindow((win) => win.getContentSize())
  expect(w! / h!).toBeCloseTo(320 / 420, 1)
  const after = await feet()
  expect(Math.abs(after[0]! - before[0]!)).toBeLessThanOrEqual(2)
  expect(Math.abs(after[1]! - before[1]!)).toBeLessThanOrEqual(2)
  await character.mouse.wheel(0, 2000) // scroll down a lot = smaller, but never below the minimum
  await character.waitForTimeout(1500)
  expect((await characterWindow((win) => win.getContentSize()))[0]).toBeGreaterThanOrEqual(160)
  expect(await character.evaluate(() => document.getElementById('grip'))).toBeNull()
})

test('character can be hidden and shown; shortcut state matches registration', async () => {
  await character.evaluate(() => window.assistant.setCharacterVisible(false))
  await expect.poll(() => characterWindow((w) => w.isVisible())).toBe(false)
  await character.evaluate(() => window.assistant.setCharacterVisible(true))
  await expect.poll(() => characterWindow((w) => w.isVisible())).toBe(true)

  const state = await character.evaluate(() => window.assistant.getState())
  const registered = await app.evaluate(({ globalShortcut }, acc) => globalShortcut.isRegistered(acc), state.shortcuts.character.accelerator)
  expect(state.shortcuts.character.registered).toBe(registered)
})

test('a global shortcut can be rebound in Settings and reset', async () => {
  const settings = await panel('settings', 'General')
  const isRegistered = (acc: string): Promise<boolean> => app.evaluate(({ globalShortcut }, a) => globalShortcut.isRegistered(a), acc)
  const keys = settings.getByRole('button', { name: 'Open the island for a quick question' })
  await keys.click()
  await expect(keys).toHaveText('Press the new keys…')
  await settings.keyboard.press('Shift+K') // Shift alone is not enough for a global shortcut: still recording
  await expect(keys).toHaveText('Press the new keys…')
  await settings.keyboard.press('Control+Alt+Shift+F9')
  await expect(keys).toHaveText('Ctrl + Alt + Shift + F9')
  await expect.poll(() => isRegistered('Control+Alt+Shift+F9')).toBe(true)
  expect(await isRegistered('Alt+Shift+Space')).toBe(false)

  // Another Lumi action's keys are refused, and the old binding keeps working.
  await keys.click()
  await settings.keyboard.press('Control+Alt+Shift+X')
  await expect(settings.getByRole('alert')).toContainText('Another Lumi shortcut')
  expect(await isRegistered('Control+Alt+Shift+F9')).toBe(true)

  await settings.locator('.shortcut').filter({ has: keys }).getByRole('button', { name: 'Reset' }).click()
  await expect(keys).toHaveText('Alt + Shift + Space')
  await expect.poll(() => isRegistered('Alt+Shift+Space')).toBe(true)
  expect(await isRegistered('Control+Alt+Shift+F9')).toBe(false)
})

/** Chat and Settings share the chat window; "settings" switches its view (and picks a tab). */
test('the menu opens from the character, runs an item and closes; only it may run items', async () => {
  await character.evaluate(() => window.assistant.character.showMenu())
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('/menu.html'))).toBe(true)
  const menu = app.windows().find((w) => w.url().endsWith('/menu.html'))!
  const visible = (): Promise<boolean> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/menu.html'))!.isVisible())
  await expect.poll(visible).toBe(true)
  await expect(menu.getByRole('menuitemcheckbox', { name: /Keep on top/ })).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Settings' }).click()
  await expect.poll(visible).toBe(false)
  await expect.poll(() => character.evaluate(() => window.assistant.getState().then((s) => s.panelView))).toBe('settings')
  await expect(character.evaluate(() => window.assistant.menu.run('quit'))).rejects.toThrow(/not the menu window/)
})

test('the island switches between the pill and frosted glass', async () => {
  const style = (): Promise<string> => character.evaluate(() => window.assistant.getState().then((s) => s.islandStyle))
  expect(await style()).toBe('pill')
  await character.evaluate(() => window.assistant.setIslandStyle('glass'))
  await expect.poll(style).toBe('glass')
  await expect.poll(() => app.windows().filter((w) => w.url().endsWith('/island.html')).length).toBe(1)
  await character.evaluate(() => window.assistant.setIslandStyle('pill'))
  await expect.poll(style).toBe('pill')
  await expect.poll(() => app.windows().filter((w) => w.url().endsWith('/island.html')).length).toBe(1)
  await expect(app.windows().find((w) => w.url().endsWith('/island.html'))!.locator('.pill')).toBeVisible()
})

test('connecting an online AI: "Get a key" opens that provider’s key page', async () => {
  await app.evaluate(({ shell }) => {
    const g = globalThis as unknown as { opened: string[] }
    g.opened = []
    shell.openExternal = (async (u: string) => void g.opened.push(u)) as typeof shell.openExternal
  })
  const settings = await panel('settings', 'AI')
  await settings.getByRole('radio', { name: /Google Gemini/ }).click()
  await expect(settings.getByRole('heading', { name: 'Connect Google Gemini' })).toBeVisible()
  await settings.getByRole('button', { name: 'Get a key' }).click()
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened)).toEqual(['https://aistudio.google.com/apikey'])
  await settings.getByRole('radio', { name: /Lumi built-in/ }).click()
})

test('dropped onto the taskbar she sits on it; picked up, she stands', async () => {
  const area = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea)
  const b = await characterWindow((w) => w.getContentBounds())
  await character.evaluate(
    ([dx, dy]) => {
      const c = window.assistant.character
      c.dragStart(500, 500)
      c.dragMove(500 + dx, 500 + dy)
      c.dragEnd()
    },
    [area.x + 200 - b.x, area.y + area.height - b.height * 0.5 - b.y]
  )
  await expect(character.locator('body')).toHaveAttribute('data-perch', 'sit', { timeout: 15_000 })
  // Hips on the taskbar's top edge once she has slid down onto it.
  const hips = (): Promise<number> => characterWindow((w) => w.getContentBounds()).then((r) => Math.round(r.y + r.height * 0.62))
  await expect.poll(async () => Math.abs((await hips()) - (area.y + area.height))).toBeLessThanOrEqual(2)
  await character.evaluate(() => {
    window.assistant.character.dragStart(500, 500)
    window.assistant.character.dragMove(400, 200)
  })
  await expect(character.locator('body')).toHaveAttribute('data-perch', 'none')
  await character.evaluate(() => window.assistant.character.dragEnd())
})

const panel = async (name: 'chat' | 'settings', tab?: string): Promise<Page> => {
  await character.evaluate((n) => window.assistant.openWindow(n), name)
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('/chat.html'))).toBe(true)
  const p = app.windows().find((w) => w.url().endsWith('/chat.html'))!
  if (name === 'settings') {
    await expect(p.getByRole('tablist', { name: 'Settings sections' })).toBeVisible()
    if (tab) await p.getByRole('tab', { name: tab, exact: true }).click()
  }
  return p
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

test('settings credits the model, switches characters with a matching voice, loads a custom .vrm', async () => {
  const settings = await panel('settings', 'Character')
  await expect(settings.getByText(/© VirtualCast, Inc. · VRM Public License 1.0/)).toBeVisible()
  const characters = settings.getByRole('radiogroup', { name: 'Characters' })
  await characters.getByRole('radio', { name: /Sendagaya Shino/ }).click()
  await expect(characters.getByRole('radio', { name: /Sendagaya Shino/ })).toHaveAttribute('aria-checked', 'true')
  await expect(character.locator('body')).toHaveAttribute('data-model', 'default', { timeout: 20_000 })
  const shino = await character.evaluate(() => window.assistant.getState())
  expect([shino.model.file, shino.voice.voice]).toEqual(['Sendagaya-Shino.vrm', 'female'])

  const stubDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as typeof dialog.showOpenDialog
    }, file)

  // A file that is not a VRM is refused with a message and changes nothing.
  await stubDialog(join(process.cwd(), 'package.json'))
  await settings.getByRole('button', { name: 'Use my own .vrm file…' }).click()
  await expect(settings.getByRole('alert')).toHaveText(/Not a VRM/)
  expect((await character.evaluate(() => window.assistant.getState())).model.custom).toBe(false)

  // A real VRM is copied into the profile and the character reloads it.
  await stubDialog(join(process.cwd(), 'src/renderer/public/models/Seed-san.vrm'))
  await settings.getByRole('button', { name: 'Use my own .vrm file…' }).click()
  await expect(characters.getByRole('radio', { checked: true })).toHaveCount(0)
  await expect(character.locator('body')).toHaveAttribute('data-model', 'custom', { timeout: 20_000 })
  expect(readFileSync(join(userData, 'models', 'custom.vrm')).byteLength).toBeGreaterThan(1_000_000)

  await characters.getByRole('radio', { name: /Sakurada Fumiriya/ }).click()
  await expect(character.locator('body')).toHaveAttribute('data-model', 'default', { timeout: 20_000 })
  expect((await character.evaluate(() => window.assistant.getState())).voice.voice).toBe('male')
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
