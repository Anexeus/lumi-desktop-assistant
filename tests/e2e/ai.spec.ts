import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const speech: string[] = []
let transcriptions = 0
let speechSeconds = 0.3

/** A 24 kHz sine-tone WAV with the 0xFFFFFFFF "unknown length" sizes Ollama sends. */
function toneWav(seconds: number): Buffer {
  const rate = 24_000
  const n = Math.round(rate * seconds)
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(0xffffffff, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(0xffffffff, 40)
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 12000), 44 + i * 2)
  return b
}

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ data: [{ id: 'fake-model' }, { id: 'slow-model' }] }))
    }
    if (req.url === '/v1/audio/transcriptions') {
      transcriptions++
      req.resume()
      return req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ text: 'hello from the mic' }))
      })
    }
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const parsed = JSON.parse(body)
      if (req.url === '/v1/audio/speech') {
        speech.push(parsed.input)
        res.writeHead(200, { 'Content-Type': 'audio/wav' })
        return res.end(toneWav(speechSeconds))
      }
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
      const parts = ['<think>private reasoning</think>', '(test)', ' fake', ' reply'] // obviously not a real model
      // A short pause before the first token, like a real model "thinking".
      parts.forEach((p, i) => setTimeout(() => res.write(chunk(p)), 400 + 60 * i))
      setTimeout(() => res.end('data: [DONE]\n\n'), 400 + 60 * parts.length)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`

  userData = mkdtempSync(join(tmpdir(), 'desktop-assistant-ai-'))
  // A pre-SQLite settings file: the app imports it into its database on first start.
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ ai: { baseUrl, model: 'fake-model' }, islandVisible: true }))
  await launch()
})

async function launch(): Promise<void> {
  const env = { ...process.env, DESKTOP_ASSISTANT_USER_DATA: userData } as Record<string, string>
  delete env['ELECTRON_RENDERER_URL']
  app = await electron.launch({ args: ['.', '--use-fake-device-for-media-stream'], env })
  const watch = (page: Page): void => {
    page.on('pageerror', (e) => pageErrors.push(`${page.url()}: ${e.message}`))
    page.on('console', (m) => {
      const expected = /Error invoking remote method '(ai:set-settings|voice:transcribe|voice:synthesize)'/
      if (m.type() === 'error' && !expected.test(m.text())) pageErrors.push(`${page.url()}: ${m.text()}`)
    })
  }
  app.on('window', watch)
  await expect.poll(() => pages().length).toBeGreaterThanOrEqual(2)
  for (const w of app.windows()) watch(w)
}

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
  // Record every state the character passes through, so a short THINKING phase can't be missed by polling.
  const character = await page('character')
  await character.evaluate(() => {
    const seen: string[] = ((window as unknown as { __states: string[] }).__states = [])
    new MutationObserver(() => seen.push(document.body.dataset['state'] ?? '')).observe(document.body, { attributeFilter: ['data-state'] })
  })
  await chat.getByRole('textbox', { name: 'Message' }).fill('hi there')
  await chat.keyboard.press('Enter')
  await expect(chat.locator('.bubble.assistant')).toHaveText('Assistant: (test) fake reply')
  await expect.poll(characterState).toBe('IDLE')
  expect(await character.evaluate(() => (window as unknown as { __states: string[] }).__states)).toEqual(['THINKING', 'SPEAKING', 'IDLE'])
  await expect(chat.getByText('private reasoning')).toHaveCount(0)

  const last = requests.at(-1)!
  expect(last.model).toBe('fake-model')
  expect(last.messages[0]!.role).toBe('system')
  expect(last.messages.at(-1)).toEqual({ role: 'user', content: 'hi there' })
  await expect(chat.locator('.badge')).toHaveText('fake-model, on this PC')
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
  await expect(island.locator('.reply')).toHaveText('(test) fake reply')

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

test('old settings.json was imported into the database and removed', () => {
  expect(existsSync(join(userData, 'settings.json'))).toBe(false)
  expect(existsSync(join(userData, 'assistant.db'))).toBe(true)
})

test('/remember saves a memory the AI then receives; secrets are refused', async () => {
  const chat = await openPanel('chat')
  await chat.evaluate(() => window.assistant.chat.send('/remember my cat is called Miso'))
  await expect(chat.locator('.bubble.assistant').last()).toHaveText('Assistant: Got it. I’ll remember: my cat is called Miso')
  const before = requests.length
  await chat.evaluate(() => window.assistant.chat.send('/remember my password is hunter2'))
  await expect(chat.locator('.bubble.assistant').last()).toContainText('won’t save it')
  expect(requests.length).toBe(before) // commands never reach the AI

  const settings = await openPanel('settings')
  await expect(settings.getByRole('region', { name: 'Memory' }).locator('.data-list').first()).toContainText('my cat is called Miso')
  await expect(settings.getByText('hunter2')).toHaveCount(0)

  await chat.evaluate(() => window.assistant.chat.send('what is my cat called?'))
  await expect.poll(() => requests.length).toBe(before + 1)
  expect(requests.at(-1)!.messages[0]!.content).toContain('- my cat is called Miso')
})

test('the chat and memories survive a restart', async () => {
  const chat = await openPanel('chat')
  await chat.evaluate(() => window.assistant.chat.send('remember this chat'))
  await expect(chat.locator('.bubble.assistant').last()).toHaveText('Assistant: (test) fake reply')
  await app.close()
  await launch()

  const again = await openPanel('chat')
  await expect(again.locator('.bubble.user').last()).toHaveText('You: remember this chat')
  await expect(again.locator('.bubble.assistant').last()).toHaveText('Assistant: (test) fake reply')
  expect((await again.evaluate(() => window.assistant.memory.list())).map((m) => m.text)).toContain('my cat is called Miso')
})

test('history can be turned off, chats deleted, and everything wiped', async () => {
  const settings = await openPanel('settings')
  const chat = await openPanel('chat')
  const chats = (): Promise<number> => settings.evaluate(async () => (await window.assistant.history.list()).length)

  // New chat keeps the old one in history.
  const count = await chats()
  await chat.getByRole('button', { name: 'New chat' }).click()
  await chat.evaluate(() => window.assistant.chat.send('a new chat'))
  await expect.poll(chats).toBe(count + 1)

  // Off: nothing more is saved.
  await settings.getByRole('checkbox', { name: /Save chats/ }).click()
  await expect(settings.getByRole('checkbox', { name: /Save chats/ })).not.toBeChecked()
  await chat.evaluate(() => window.assistant.chat.send('not saved'))
  await expect(chat.locator('.bubble.user').last()).toHaveText('You: not saved')
  expect(await chats()).toBe(count + 1)
  const titles = await settings.evaluate(async () => (await window.assistant.history.list()).map((c) => c.title))
  expect(titles).not.toContain('not saved')
  await settings.getByRole('checkbox', { name: /Save chats/ }).click()

  // Deleting everything empties history, memories and the chat on screen.
  await settings.getByRole('button', { name: 'Delete all my data…' }).click()
  await settings.getByRole('button', { name: 'Yes, delete everything' }).click()
  await expect.poll(chats).toBe(0)
  expect(await settings.evaluate(() => window.assistant.memory.list())).toEqual([])
  await expect(chat.locator('.bubble')).toHaveCount(0)
})

test('replies are spoken: she stays SPEAKING until the audio ends', async () => {
  speechSeconds = 1.2
  const chat = await openPanel('chat')
  const character = await page('character')
  await character.evaluate(() => {
    const seen: string[] = ((window as unknown as { __states: string[] }).__states = [])
    new MutationObserver(() => seen.push(document.body.dataset['state'] ?? '')).observe(document.body, { attributeFilter: ['data-state'] })
  })
  const before = speech.length
  await chat.evaluate(() => window.assistant.chat.send('say something'))
  await expect.poll(() => speech.length).toBe(before + 1)
  expect(speech.at(-1)).toBe('(test) fake reply') // the reasoning was never spoken
  // The text is done long before the 1.2 s clip, but she keeps talking until it ends.
  await expect(chat.locator('.bubble.assistant').last()).toHaveText('Assistant: (test) fake reply')
  expect(await characterState()).toBe('SPEAKING')
  await expect(chat.getByRole('button', { name: 'Stop' })).toBeVisible()
  await expect.poll(characterState, { timeout: 10_000 }).toBe('IDLE')
  expect(await character.evaluate(() => (window as unknown as { __states: string[] }).__states)).toEqual(['THINKING', 'SPEAKING', 'IDLE'])
  speechSeconds = 0.3
})

test('Stop silences her mid-sentence', async () => {
  speechSeconds = 6
  const chat = await openPanel('chat')
  await chat.evaluate(() => window.assistant.chat.send('talk for a while'))
  await expect.poll(characterState).toBe('SPEAKING')
  await expect(chat.locator('.bubble.assistant').last()).toHaveText('Assistant: (test) fake reply')
  await chat.getByRole('button', { name: 'Stop' }).click()
  await expect.poll(characterState, { timeout: 2000 }).toBe('IDLE')
  speechSeconds = 0.3
})

test('push to talk: the mic records, is transcribed, and is sent as a message', async () => {
  const chat = await openPanel('chat')
  const mic = chat.getByRole('button', { name: 'Talk (push to talk)' })
  await mic.click()
  await expect(chat.getByRole('button', { name: 'Stop and send voice message' })).toBeVisible()
  await expect.poll(characterState).toBe('LISTENING')
  await chat.waitForTimeout(800)
  const before = transcriptions
  await chat.getByRole('button', { name: 'Stop and send voice message' }).click()
  await expect.poll(() => transcriptions).toBe(before + 1)
  await expect(chat.locator('.bubble.user').last()).toHaveText('You: hello from the mic')
  await expect(chat.locator('.bubble.assistant').last()).toHaveText('Assistant: (test) fake reply')
  await expect.poll(characterState, { timeout: 10_000 }).toBe('IDLE')
})

test('with voice input off, the microphone is refused', async () => {
  const chat = await openPanel('chat')
  const voice = (await chat.evaluate(() => window.assistant.getState())).voice
  await chat.evaluate((v) => window.assistant.voice.setSettings({ ...v, input: false }), voice)
  await expect(chat.getByRole('button', { name: 'Talk (push to talk)' })).toHaveCount(0)
  const denied = await chat.evaluate(() => navigator.mediaDevices.getUserMedia({ audio: true }).then(() => 'granted', () => 'denied'))
  expect(denied).toBe('denied')
  const rejected = await chat.evaluate(() => window.assistant.voice.transcribe(new Uint8Array(100)).then(() => 'accepted', () => 'rejected'))
  expect(rejected).toBe('rejected')
  // Never video, even with voice on.
  await chat.evaluate((v) => window.assistant.voice.setSettings({ ...v, input: true }), voice)
  const video = await chat.evaluate(() => navigator.mediaDevices.getUserMedia({ video: true }).then(() => 'granted', () => 'denied'))
  expect(video).toBe('denied')
})

test('only the character and settings windows may synthesize speech', async () => {
  const chat = await openPanel('chat')
  const outcome = await chat.evaluate(() => window.assistant.voice.synthesize('hi').then(() => 'accepted', () => 'rejected'))
  expect(outcome).toBe('rejected')
})

test('no uncaught renderer errors', () => {
  expect(pageErrors).toEqual([])
})
