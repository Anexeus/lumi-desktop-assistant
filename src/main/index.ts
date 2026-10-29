import { app, globalShortcut, Menu, screen } from 'electron'
import { join } from 'node:path'
import { Events, Invoke, Send, type AppState } from '@shared/ipc'
import { handle, on } from './ipc'
import { hardenSession, hardenWebContents, registerAppScheme, serveBundle } from './security'
import { menuTemplate, createTray, type TrayActions } from './tray'
import { loadWindowState, saveWindowState } from './window-state'
import { WindowManager } from './windows'

const SHORTCUT = 'Control+Alt+Shift+A'

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

function start(): void {
  app.setAppUserModelId('dev.desktop-assistant.app')
  Menu.setApplicationMenu(null)
  hardenSession()
  hardenWebContents()
  serveBundle(join(__dirname, '../renderer'))

  const saved = loadWindowState()
  let state: AppState = {
    characterVisible: true,
    alwaysOnTop: saved.alwaysOnTop ?? true,
    shortcut: { accelerator: SHORTCUT, registered: false }
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

  windows.character.once('ready-to-show', () => {
    if (state.characterVisible) windows.character.showInactive()
  })

  // Invoke channels: any of our windows may call these.
  handle(Invoke.getState, () => state)
  handle(Invoke.setAlwaysOnTop, ({ value }) => setState({ alwaysOnTop: value }))
  handle(Invoke.setCharacterVisible, ({ value }) => setState({ characterVisible: value }))
  handle(Invoke.openWindow, ({ name }) => windows.openPanel(name))

  // Send channels drive the character window and are accepted only from it.
  const fromCharacter = (sender: Electron.WebContents): boolean => sender === windows.character.webContents
  on(Send.setIgnoreMouse, ({ ignore }, e) => fromCharacter(e.sender) && windows.setIgnoreMouse(ignore))
  on(Send.dragStart, (p, e) => fromCharacter(e.sender) && windows.dragStart(p.screenX, p.screenY))
  on(Send.dragMove, (p, e) => fromCharacter(e.sender) && windows.dragMove(p.screenX, p.screenY))
  on(Send.dragEnd, (_p, e) => fromCharacter(e.sender) && windows.dragEnd())
  on(Send.resize, (p, e) => fromCharacter(e.sender) && windows.resizeCharacter(p.width, p.height))
  on(Send.resizeEnd, (_p, e) => fromCharacter(e.sender) && windows.settleCharacter())
  on(Send.showMenu, (_p, e) => {
    if (fromCharacter(e.sender)) Menu.buildFromTemplate(menuTemplate(state, actions)).popup({ window: windows.character })
  })

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
