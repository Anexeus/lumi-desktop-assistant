import { app, BrowserWindow, dialog, globalShortcut, Menu, screen, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { initialSnapshot, transition, TRANSIENT_MS, type CharacterEvent, type CharacterState } from '@shared/character'
import { Events, Invoke, Send, type AppState, type ChooseModelResult } from '@shared/ipc'
import { handle, on } from './ipc'
import { DEFAULT_MODEL, importModel, readCustomModel, removeCustomModel } from './model'
import { hardenSession, hardenWebContents, registerAppScheme, serveBundle } from './security'
import { menuTemplate, createTray, type TrayActions } from './tray'
import type { VrmMeta } from './vrm-meta'
import { loadWindowState, saveWindowState } from './window-state'
import { WindowManager } from './windows'

const SHORTCUT = 'Control+Alt+Shift+A'
const CURSOR_POLL_MS = 66 // ~15 Hz is enough for eyes to follow the pointer

// Lets E2E tests run against an isolated profile. Ignored in packaged builds.
const testUserData = process.env['DESKTOP_ASSISTANT_USER_DATA']
if (testUserData && !app.isPackaged) app.setPath('userData', testUserData)

app.enableSandbox()
registerAppScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('window-all-closed', () => {
    // Tray app: windows hide instead of closing, and quitting is explicit.
  })
  void app.whenReady().then(start)
}

async function start(): Promise<void> {
  app.setAppUserModelId('dev.desktop-assistant.app')
  Menu.setApplicationMenu(null)
  hardenSession()
  hardenWebContents()
  serveBundle(join(__dirname, '../renderer'))

  const saved = loadWindowState()
  const custom = await readCustomModel()
  const modelInfo = (meta: VrmMeta, isCustom: boolean, revision: number): AppState['model'] => ({
    name: meta.name,
    authors: meta.authors,
    licenseUrl: meta.licenseUrl,
    custom: isCustom,
    revision
  })

  let state: AppState = {
    characterVisible: true,
    alwaysOnTop: saved.alwaysOnTop ?? true,
    shortcut: { accelerator: SHORTCUT, registered: false },
    character: initialSnapshot.state,
    model: custom ? modelInfo(custom.meta, true, 0) : modelInfo(DEFAULT_MODEL, false, 0)
  }

  const persist = (): void => saveWindowState({ character: windows.characterBounds(), alwaysOnTop: state.alwaysOnTop })

  const windows = new WindowManager(saved.character, state.alwaysOnTop, persist, () =>
    setState({ characterVisible: false })
  )

  const actions: TrayActions = {
    toggleCharacter: () => setState({ characterVisible: !state.characterVisible }),
    setAlwaysOnTop: (value) => setState({ alwaysOnTop: value }),
    openChat: () => windows.openPanel('chat'),
    openSettings: () => windows.openPanel('settings'),
    quit: () => app.quit()
  }
  const tray = createTray(actions)

  function setState(patch: Partial<AppState>): AppState {
    const prev = state
    state = { ...state, ...patch }
    if (state.characterVisible !== prev.characterVisible) windows.setCharacterVisible(state.characterVisible)
    if (state.alwaysOnTop !== prev.alwaysOnTop) {
      windows.setAlwaysOnTop(state.alwaysOnTop)
      persist()
    }
    tray.update(state)
    for (const win of windows.allWindows()) win.webContents.send(Events.state, state)
    return state
  }

  // Character state machine. Main owns it so every window sees the same state.
  let snapshot = initialSnapshot
  let transientTimer: NodeJS.Timeout | undefined
  function fire(event: CharacterEvent): AppState {
    const next = transition(snapshot, event)
    if (!next) return state
    snapshot = next
    clearTimeout(transientTimer)
    const ms = TRANSIENT_MS[next.state]
    if (ms) transientTimer = setTimeout(() => fire('timeout'), ms)
    return setState({ character: next.state })
  }

  windows.character.once('ready-to-show', () => {
    if (state.characterVisible) windows.character.showInactive()
  })

  const fromCharacter = (sender: Electron.WebContents): boolean => sender === windows.character.webContents

  // Invoke channels: any of our windows may call these unless noted.
  handle(Invoke.getState, () => state)
  handle(Invoke.setAlwaysOnTop, ({ value }) => setState({ alwaysOnTop: value }))
  handle(Invoke.setCharacterVisible, ({ value }) => setState({ characterVisible: value }))
  handle(Invoke.openWindow, ({ name }) => windows.openPanel(name))
  handle(Invoke.characterEvent, ({ event }) => fire(event))
  handle(Invoke.getModel, async (_p, e) => {
    if (!fromCharacter(e.sender)) throw new Error('Rejected model:get: not the character window')
    return state.model.custom ? ((await readCustomModel())?.bytes ?? null) : null
  })
  handle(Invoke.chooseModel, async (_p, e): Promise<ChooseModelResult> => {
    const parent = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose a VRM character',
      filters: [{ name: 'VRM avatar', extensions: ['vrm'] }],
      properties: ['openFile']
    }
    const picked = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    const file = picked.filePaths[0]
    if (picked.canceled || !file) return { ok: false, canceled: true }
    try {
      const meta = await importModel(file)
      return { ok: true, state: setState({ model: modelInfo(meta, true, state.model.revision + 1) }) }
    } catch (error) {
      return { ok: false, canceled: false, message: error instanceof Error ? error.message : 'Could not load that file.' }
    }
  })
  handle(Invoke.resetModel, async () => {
    await removeCustomModel()
    return setState({ model: modelInfo(DEFAULT_MODEL, false, state.model.revision + 1) })
  })

  // Send channels drive the character window and are accepted only from it.
  on(Send.setIgnoreMouse, ({ ignore }, e) => fromCharacter(e.sender) && windows.setIgnoreMouse(ignore))
  on(Send.dragStart, (p, e) => fromCharacter(e.sender) && windows.dragStart(p.screenX, p.screenY))
  on(Send.dragMove, (p, e) => fromCharacter(e.sender) && windows.dragMove(p.screenX, p.screenY))
  on(Send.dragEnd, (_p, e) => fromCharacter(e.sender) && windows.dragEnd())
  on(Send.resize, (p, e) => fromCharacter(e.sender) && windows.resizeCharacter(p.width, p.height))
  on(Send.resizeEnd, (_p, e) => fromCharacter(e.sender) && windows.settleCharacter())
  on(Send.showMenu, (_p, e) => {
    if (!fromCharacter(e.sender)) return
    const template: MenuItemConstructorOptions[] = menuTemplate(state, actions)
    if (!app.isPackaged) template.splice(-1, 0, { label: 'Preview state (dev)', submenu: previewMenu() }, { type: 'separator' })
    Menu.buildFromTemplate(template).popup({ window: windows.character })
  })

  // Dev aid: trigger each state by hand to check its animation.
  function previewMenu(): MenuItemConstructorOptions[] {
    const events: [CharacterState, CharacterEvent[]][] = [
      ['LISTENING', ['cancel', 'listen']],
      ['THINKING', ['cancel', 'think']],
      ['SPEAKING', ['cancel', 'speak']],
      ['WORKING', ['cancel', 'work']],
      ['NOTIFICATION', ['cancel', 'notify']],
      ['ERROR', ['cancel', 'error']],
      ['IDLE', ['cancel', 'done']]
    ]
    return events.map(([label, seq]) => ({ label, click: () => seq.forEach(fire) }))
  }

  // Feed the cursor position to the character so its eyes can follow it anywhere on screen.
  let lastCursor = ''
  setInterval(() => {
    if (!state.characterVisible || windows.character.isDestroyed()) return
    const p = screen.getCursorScreenPoint()
    const b = windows.characterBounds()
    const key = `${p.x - b.x},${p.y - b.y}`
    if (key === lastCursor) return
    lastCursor = key
    windows.character.webContents.send(Events.cursor, p.x - b.x, p.y - b.y)
  }, CURSOR_POLL_MS)

  const registered = globalShortcut.register(SHORTCUT, actions.toggleCharacter)
  if (!registered) console.warn(`Global shortcut ${SHORTCUT} is taken by another application`)
  setState({ shortcut: { accelerator: SHORTCUT, registered } })

  for (const event of ['display-added', 'display-removed', 'display-metrics-changed'] as const) {
    screen.on(event as 'display-added', () => windows.settleCharacter())
  }

  app.on('second-instance', () => setState({ characterVisible: true }))
  app.on('before-quit', () => {
    persist()
    windows.markQuitting()
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
