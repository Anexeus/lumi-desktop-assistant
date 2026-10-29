import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// AI conversation, end to end, against a fake OpenAI-compatible server (no real model needed).

let app: ElectronApplication
let userData: string
let server: Server
let baseUrl: string
const requests: { auth: string | undefined; model: string; messages: { role: string; content: string }[] }[] = []
const pageErrors: string[] = []

const chunk = (content: string): string => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ data: [{ id: 'fake-model' }, { id: 'slow-model' }] }))
    }
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const parsed = JSON.parse(body)
      requests.push({ auth: req.headers.authorization, model: parsed.model, messages: parsed.messages })
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      if (parsed.model === 'slow-model') {
        let i = 0
        const timer = setInterval(() => {
          if (res.destroyed) return clearInterval(timer)
          res.write(chunk(`word${i++} `))
        }, 150)
        res.on('close', () => clearInterval(timer))
        return
      }
      const parts = ['<think>private reasoning</think>', 'Hello', ' from', ' fake']
      // A short pause before the first token, like a real model "thinking".
      parts.forEach((p, i) => setTimeout(() => res.write(chunk(p)), 400 + 60 * i))
      setTimeout(() => res.end('data: [DONE]\n\n'), 400 + 60 * parts.length)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`

  userData = mkdtempSync(join(tmpdir(), 'desktop-assistant-ai-'))
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ ai: { baseUrl, model: 'fake-model' }, islandVisible: true }))
  const env = { ...process.env, DESKTOP_ASSISTANT_USER_DATA: userData } as Record<string, string>
  delete env['ELECTRON_RENDERER_URL']
  app = await electron.launch({ args: ['.'], env })
  const watch = (page: Page): void => {
    page.on('pageerror', (e) => pageErrors.push(`${page.url()}: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Error invoking remote method 'ai:set-settings'/.test(m.text())) pageErrors.push(`${page.url()}: ${m.text()}`)
    })
  }
  app.on('window', watch)
  await expect.poll(() => pages().length).toBeGreaterThanOrEqual(2)
  for (const w of app.windows()) watch(w)
})

test.afterAll(async () => {
  await app?.close()
  server?.close()
  rmSync(userData, { recursive: true, force: true })
})

const pages = (): Page[] => app.windows()
const page = async (name: string): Promise<Page> => {
  await expect.poll(() => pages().some((w) => w.url().endsWith(`/${name}.html`))).toBe(true)
  const p = pages().find((w) => w.url().endsWith(`/${name}.html`))!
  await p.waitForLoadState('domcontentloaded')
  return p
}
const openPanel = async (name: 'chat' | 'settings'): Promise<Page> => {
  await (await page('character')).evaluate((n) => window.assistant.openWindow(n), name)
  return page(name)
}
const characterState = async (): Promise<string | null> => (await page('character')).locator('body').getAttribute('data-state')
const winBounds = (name: string): Promise<Electron.Rectangle> =>
  app.evaluate(({ BrowserWindow }, n) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith(`/${n}.html`))!.getContentBounds(), name)

test('chat streams a reply, hides reasoning and animates the character', async () => {
  const chat = await openPanel('chat')
  await chat.getByRole('textbox', { name: 'Message' }).fill('hi there')
  await chat.keyboard.press('Enter')
  await expect.poll(characterState).toBe('THINKING')
  await expect(chat.locator('.bubble.assistant')).toHaveText('Assistant: Hello from fake')
  await expect.poll(characterState).toBe('IDLE')
  await expect(chat.getByText('private reasoning')).toHaveCount(0)

  const last = requests.at(-1)!
  expect(last.model).toBe('fake-model')
  expect(last.messages[0]!.role).toBe('system')
  expect(last.messages.at(-1)).toEqual({ role: 'user', content: 'hi there' })
  await expect(chat.locator('.badge')).toHaveText('fake-model · on this PC')
})

test('the island sits at the top centre, expands, answers and shares the conversation', async () => {
  const island = await page('island')
  const collapsed = await winBounds('island')
  const area = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea)
  expect(Math.abs(collapsed.x + collapsed.width / 2 - (area.x + area.width / 2))).toBeLessThanOrEqual(2)
  expect(collapsed.y - area.y).toBeLessThan(30)
  expect(collapsed.height).toBeLessThan(60)

  const state = await island.evaluate(() => window.assistant.getState())
  expect(state.islandShortcut.accelerator).toBe('Alt+Shift+Space')
  const registered = await app.evaluate(({ globalShortcut }, k) => globalShortcut.isRegistered(k), state.islandShortcut.accelerator)
  expect(state.islandShortcut.registered).toBe(registered)

  await island.getByRole('button', { name: /Open quick ask/ }).click()
  await expect(island.getByRole('textbox', { name: 'Message' })).toBeFocused()
  expect((await winBounds('island')).height).toBeGreaterThan(200)

  await island.getByRole('textbox', { name: 'Message' }).fill('from the island')
  await island.keyboard.press('Enter')
  await expect(island.locator('.reply')).toHaveText('Hello from fake')

  // Escape cancels while a reply streams, so wait for the turn to finish before folding the island.
  await expect(island.getByRole('button', { name: 'Send' })).toBeVisible()
  await island.keyboard.press('Escape')
  await expect(island.getByRole('button', { name: /Open quick ask/ })).toBeVisible()
  expect((await winBounds('island')).height).toBeLessThan(60)

  // Same conversation in the chat window.
  const chat = await openPanel('chat')
  await expect(chat.locator('.bubble.user').last()).toHaveText('You: from the island')

  // Focusing another window folds an expanded island back into its pill.
  await island.getByRole('button', { name: /Open quick ask/ }).click()
  await expect(island.getByRole('textbox', { name: 'Message' })).toBeVisible()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/chat.html'))!.focus())
  await expect(island.getByRole('button', { name: /Open quick ask/ })).toBeVisible()
})

test('Stop cancels a streaming reply and keeps what arrived', async () => {
  const chat = await openPanel('chat')
  await chat.evaluate((url) => window.assistant.ai.setSettings({ baseUrl: url, model: 'slow-model' }), baseUrl)
  await chat.getByRole('textbox', { name: 'Message' }).fill('tell me a long story')
  await chat.keyboard.press('Enter')
  await expect(chat.locator('.bubble.assistant').last()).toContainText('word1')
  await expect.poll(characterState).toBe('SPEAKING')
  await chat.getByRole('button', { name: 'Stop' }).click()
  await expect.poll(characterState).toBe('IDLE')
  const kept = await chat.locator('.bubble.assistant').last().textContent()
  await chat.waitForTimeout(500)
  expect(await chat.locator('.bubble.assistant').last().textContent()).toBe(kept) // nothing more streams in
  await expect(chat.getByRole('button', { name: 'Send' })).toBeVisible()
})

test('settings tests the connection and lists models', async () => {
  const settings = await openPanel('settings')
  await settings.getByRole('button', { name: 'Test connection' }).click()
  await expect(settings.getByRole('status')).toHaveText('Connected. 2 models available.')
})

test('API keys are encrypted at rest, sent as a bearer token, and dropped when the service changes', async () => {
  const chat = await openPanel('chat')
  await chat.evaluate((url) => window.assistant.ai.setSettings({ baseUrl: url, model: 'fake-model' }), baseUrl)
  const state = await chat.evaluate(() => window.assistant.ai.setApiKey('sk-test-123456'))
  expect(state.ai.hasApiKey).toBe(true)
  expect(JSON.stringify(state)).not.toContain('sk-test-123456') // never handed back to a renderer
  expect(readFileSync(join(userData, 'secrets.json'), 'utf8')).not.toContain('sk-test-123456')

  await chat.evaluate(() => window.assistant.chat.send('with a key'))
  await expect.poll(() => requests.at(-1)?.auth).toBe('Bearer sk-test-123456')

  // Same service, different path: the key stays. Different host: it is deleted.
  const samePath = await chat.evaluate((url) => window.assistant.ai.setSettings({ baseUrl: url.replace('/v1', '/v1/'), model: 'fake-model' }), baseUrl)
  expect(samePath.ai.hasApiKey).toBe(true)
  const other = await chat.evaluate(() => window.assistant.ai.setSettings({ baseUrl: 'http://localhost:9/v1', model: 'x' }))
  expect(other.ai.hasApiKey).toBe(false)
  await chat.evaluate((url) => window.assistant.ai.setSettings({ baseUrl: url, model: 'fake-model' }), baseUrl)
})

test('unsafe settings and empty messages are rejected', async () => {
  const chat = await openPanel('chat')
  const outcomes = await chat.evaluate(async () => {
    const tryIt = (p: Promise<unknown>): Promise<string> => p.then(() => 'accepted', () => 'rejected')
    return [
      await tryIt(window.assistant.ai.setSettings({ baseUrl: 'file:///C:/Windows/win.ini', model: 'x' })),
      await tryIt(window.assistant.ai.setSettings({ baseUrl: 'http://user:pass@example.com/v1', model: 'x' })),
      await tryIt(window.assistant.chat.send('   '))
    ]
  })
  expect(outcomes).toEqual(['rejected', 'rejected', 'rejected'])
})

test('no uncaught renderer errors', () => {
  expect(pageErrors).toEqual([])
})
