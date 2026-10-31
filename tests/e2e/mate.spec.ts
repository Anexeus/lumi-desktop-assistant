import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// Importing Mate Engine from the user's own copy. A tiny made-up Mate Engine folder stands in for the real one (whose
// animations, sounds and avatars may not be redistributed), so this never needs their files.

let app: ElectronApplication
let character: Page
let userData: string

/** A humanoid muscle clip in Unity's text format: a few muscles held at gentle values for two seconds. */
function fakeClip(name: string): string {
  const curve = (attribute: string, value: number): string => `  - serializedVersion: 2
    curve:
      serializedVersion: 2
      m_Curve:
      - serializedVersion: 3
        time: 0
        value: ${value}
        inSlope: 0
        outSlope: 0
      - serializedVersion: 3
        time: 2
        value: ${value}
        inSlope: 0
        outSlope: 0
    attribute: ${attribute}
    path:
    classID: 95`
  const muscles: [string, number][] = [
    ['RootT.y', 0.97],
    ['RootQ.w', 1],
    ...['Left', 'Right'].flatMap((s): [string, number][] => [
      [`${s} Arm Down-Up`, -0.5],
      [`${s} Arm Front-Back`, 0.3],
      [`${s} Forearm Stretch`, 0.6],
      [`${s} Upper Leg Front-Back`, 0.55],
      [`${s} Lower Leg Stretch`, 0.95],
      [`${s} Hand Down-Up`, 0]
    ])
  ]
  return `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!74 &7400000
AnimationClip:
  m_Name: ${name}
  m_FloatCurves:
${muscles.map(([a, v]) => curve(a, v)).join('\n')}
  m_PPtrCurves: []
  m_AnimationClipSettings:
    m_StopTime: 2
    m_LoopTime: 1
`
}

/** A short silent WAV (decodable as a sound). */
function wav(): Buffer {
  const samples = 800
  const b = Buffer.alloc(44 + samples * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + samples * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(8000, 24)
  b.writeUInt32LE(16000, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(samples * 2, 40)
  return b
}

test.beforeAll(async () => {
  userData = mkdtempSync(join(tmpdir(), 'desktop-assistant-mate-'))
  const mate = join(userData, 'Mate Engine')
  const put = (path: string, data: string | Buffer): void => {
    mkdirSync(dirname(join(mate, path)), { recursive: true })
    writeFileSync(join(mate, path), data)
  }
  const anims = 'Assets/MATE ENGINE - Animations'
  for (const path of ['PET_IDLE/PET_IDLE', 'PET_MISC/PET_DRAGGING', 'PET_MISC/PET_HAPPY', 'PET_DANCING/PET_DANCING'])
    put(`${anims}/${path}.anim`, fakeClip(path.split('/').pop()!))
  put('Assets/MATE ENGINE - Sounds/Laugh_1.mp3', wav())
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ ai: { baseUrl: 'http://127.0.0.1:9/v1', model: 'none' } }))
  const env = { ...process.env, DESKTOP_ASSISTANT_USER_DATA: userData } as Record<string, string>
  delete env['ELECTRON_RENDERER_URL']
  app = await electron.launch({ args: ['.', `--import-mate=${mate}`], env })
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('/character.html'))).toBe(true)
  character = app.windows().find((w) => w.url().endsWith('/character.html'))!
  await character.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
})

const playing = (): Promise<string | undefined> => character.evaluate(() => document.body.dataset['mate'])

test('a Mate Engine folder given at launch is imported and its clips play her body', async () => {
  await expect.poll(() => character.evaluate(() => window.assistant.getState().then((s) => s.mate)), { timeout: 20_000 }).toMatchObject({ clips: 4, sounds: 1, progress: null })
  await expect.poll(playing, { timeout: 10_000 }).toMatch(/^idle:PET_IDLE$/)
  // Picked up, she plays the dragging clip; put down, she goes back to standing.
  const { width, height } = await character.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  await character.mouse.move(width / 2, height * 0.55)
  await character.mouse.down()
  await character.mouse.move(width / 2 + 30, height * 0.5, { steps: 5 })
  await expect.poll(playing).toBe('drag:PET_DRAGGING')
  await character.mouse.up()
  await expect.poll(playing).toBe('idle:PET_IDLE')
})

test('the menu offers Dance once clips are imported, and picking a dance plays it', async () => {
  await character.evaluate(() => window.assistant.character.showMenu())
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('/menu.html'))).toBe(true)
  const menu = app.windows().find((w) => w.url().endsWith('/menu.html'))!
  const dance = menu.getByRole('menuitemcheckbox', { name: /Dance/ })
  await expect(dance).toHaveAttribute('aria-checked', 'false')
  await dance.click()
  await expect.poll(() => character.evaluate(() => document.body.dataset['dancing'])).toBe('true')
  await expect.poll(playing).toBe('dance:PET_DANCING')
  await character.evaluate(() => window.assistant.character.showMenu())
  await menu.getByRole('menuitemcheckbox', { name: /Dance/ }).click()
  await expect.poll(playing).toBe('idle:PET_IDLE')
})

test('only the character window may read clips and sounds, and only ones the import listed', async () => {
  expect(await character.evaluate(() => window.assistant.mate.clip('PET_IDLE').then((j) => JSON.parse(j).name))).toBe('PET_IDLE')
  await expect(character.evaluate(() => window.assistant.mate.clip('../library'))).rejects.toThrow()
  await expect(character.evaluate(() => window.assistant.mate.clip('PET_IDLE_99'))).rejects.toThrow(/not imported/)
  await expect(character.evaluate(() => window.assistant.mate.sound('Laugh_1.mp3').then((b) => b.byteLength))).resolves.toBeGreaterThan(44)
  await character.evaluate(() => window.assistant.openWindow('settings'))
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('/chat.html'))).toBe(true)
  const settings = app.windows().find((w) => w.url().endsWith('/chat.html'))!
  await expect(settings.evaluate(() => window.assistant.mate.clip('PET_IDLE'))).rejects.toThrow(/not the character window/)
  await expect(character.evaluate(() => window.assistant.mate.remove())).rejects.toThrow(/not the settings window/)
})

test('Settings shows what is in use and can stop using it', async () => {
  await character.evaluate(() => window.assistant.openWindow('settings'))
  const settings = app.windows().find((w) => w.url().endsWith('/chat.html'))!
  await settings.getByRole('tab', { name: 'Character', exact: true }).click()
  await expect(settings.getByText(/4 animations and 1 sounds in use/)).toBeVisible()
  await settings.getByRole('button', { name: 'Stop using them' }).click()
  await expect(settings.getByRole('button', { name: 'Import from Mate Engine…' })).toBeVisible()
  await expect.poll(playing).toBe('')
})
