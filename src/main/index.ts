import { app, BrowserWindow, dialog, globalShortcut, Menu, screen, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { initialSnapshot, transition, TRANSIENT_MS, type CharacterEvent, type CharacterState } from '@shared/character'
import { Events, Invoke, Send, type AppState, type ChatEvent, type ChooseModelResult, type ListModelsResult } from '@shared/ipc'
import { runCommand, saveMemory } from './ai/commands'
import { Conversation } from './ai/conversation'
import { listModels, ProviderError, streamChat } from './ai/provider'
import { synthesize, transcribe } from './ai/voice'
import { handle, on } from './ipc'
import { DEFAULT_MODEL, importModel, readCustomModel, removeCustomModel } from './model'
import { hardenSession, hardenWebContents, registerAppScheme, serveBundle } from './security'
import { getSecret, hasSecret, isLocalUrl, loadSettings, saveSettings, setSecret } from './settings'
import { openStore } from './storage/store'
import { menuTemplate, createTray, type TrayActions } from './tray'
import type { VrmMeta } from './vrm-meta'
import { loadWindowState, saveWindowState } from './window-state'
import { WindowManager } from './windows'

const SHORTCUT = 'Control+Alt+Shift+A'
const ISLAND_SHORTCUT = 'Alt+Shift+Space' // Ctrl+Alt+Space is often taken; Alt+Space is the Windows window menu
const API_KEY = 'ai.apiKey'
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
  // Push-to-talk: the microphone, audio only, for the chat and island windows while voice input is on.
  // Settings may also open it, to test the mic and read device names.
  hardenSession(
    (contents) =>
      settings.voice.input &&
      (windows.isPanel(contents, 'chat') || windows.isPanel(contents, 'settings') || contents === windows.island.webContents)
  )
  hardenWebContents()
  serveBundle(join(__dirname, '../renderer'))

  const store = openStore(join(app.getPath('userData'), 'assistant.db'))
  const saved = loadWindowState(store)
  const settings = loadSettings(store)
  const aiStatus = (): AppState['ai'] => ({
    ...settings.ai,
    hasApiKey: hasSecret(API_KEY),
    local: isLocalUrl(settings.ai.baseUrl)
  })
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
    model: custom ? modelInfo(custom.meta, true, 0) : modelInfo(DEFAULT_MODEL, false, 0),
    islandVisible: settings.islandVisible,
    islandExpanded: false,
    islandShortcut: { accelerator: ISLAND_SHORTCUT, registered: false },
    ai: aiStatus(),
    historyEnabled: settings.historyEnabled,
    voice: settings.voice
  }

  const persist = (): void => saveWindowState(store, { character: windows.characterBounds(), alwaysOnTop: state.alwaysOnTop })

  const windows = new WindowManager(
    saved.character,
    state.alwaysOnTop,
    persist,
    () => setState({ characterVisible: false }),
    () => setState({ islandExpanded: false })
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
    if (state.islandVisible !== prev.islandVisible) {
      windows.setIslandVisible(state.islandVisible)
      settings.islandVisible = state.islandVisible
      saveSettings(store, settings)
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
  windows.island.once('ready-to-show', () => {
    if (state.islandVisible) windows.setIslandVisible(true)
  })

  const broadcastChat = (event: ChatEvent): void => {
    for (const win of windows.allWindows()) win.webContents.send(Events.chat, event)
  }
  const notifyData = (): void => {
    for (const win of windows.allWindows()) win.webContents.send(Events.dataChanged)
  }
  // The row for the chat on screen is created on its first saved message; "New chat" starts another.
  let conversationId: number | undefined
  const conversation = new Conversation({
    async *stream(messages, signal) {
      yield* streamChat({ ...settings.ai, apiKey: await getSecret(API_KEY) }, messages, { signal })
    },
    onSnapshot: (snapshot) => broadcastChat({ type: 'snapshot', snapshot }),
    onDelta: (id, text) => broadcastChat({ type: 'delta', id, text }),
    // With voice on, the character window says when speaking is over (the audio outlasts the text stream).
    onCharacter: (event) => (event === 'done' && settings.voice.output !== 'off' ? undefined : fire(event)),
    memories: () => store.listMemories().filter((m) => m.kind === 'memory').map((m) => m.text),
    onPersist(message) {
      if (!settings.historyEnabled) return
      conversationId ??= store.createConversation()
      store.addMessage(conversationId, message)
      notifyData()
    }
  })
  if (settings.historyEnabled) {
    const last = store.latestConversation()
    if (last) {
      conversationId = last.id
      conversation.restore(last.messages)
    }
  }
  const newChat = (): void => {
    conversation.clear()
    conversationId = undefined
  }
  const addMemory = (kind: 'memory' | 'note', text: string): void => {
    store.addMemory(kind, text)
    notifyData()
  }

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
  handle(Invoke.setIslandVisible, ({ value }) => setState({ islandVisible: value }))
  handle(Invoke.setIslandExpanded, ({ expanded }, e) => {
    if (e.sender !== windows.island.webContents) throw new Error('Rejected island:set-expanded: not the island window')
    windows.setIslandExpanded(expanded)
    setState({ islandExpanded: windows.isIslandExpanded() })
  })
  handle(Invoke.chatGet, () => conversation.snapshot())
  handle(Invoke.chatSend, ({ text }) => {
    const reply = runCommand(text, addMemory)
    if (reply !== null) return conversation.addLocal(text, reply)
    void conversation.send(text) // replies stream back as chat events
  })
  handle(Invoke.chatCancel, () => {
    conversation.cancel()
    fire('cancel') // also stops her talking if the text already finished but the voice has not
  })
  handle(Invoke.chatClear, () => newChat())
  handle(Invoke.aiSetSettings, async (next) => {
    // A key belongs to one service: never send it to a different host after the address changes.
    if (new URL(next.baseUrl).origin !== new URL(settings.ai.baseUrl).origin) await setSecret(API_KEY, null)
    settings.ai = next
    saveSettings(store, settings)
    return setState({ ai: aiStatus() })
  })
  handle(Invoke.aiSetApiKey, async ({ key }) => {
    await setSecret(API_KEY, key)
    return setState({ ai: aiStatus() })
  })
  handle(Invoke.memoryList, () => store.listMemories())
  handle(Invoke.memoryAdd, ({ kind, text }) => saveMemory(addMemory, kind, text))
  handle(Invoke.memoryDelete, ({ id }) => {
    store.deleteMemory(id)
    notifyData()
  })
  handle(Invoke.historyList, () => store.listConversations())
  handle(Invoke.historyDelete, ({ id }) => {
    store.deleteConversation(id)
    if (id === conversationId) newChat() // the chat on screen was just deleted
    notifyData()
  })
  handle(Invoke.historyDeleteAll, () => {
    store.deleteAllConversations()
    newChat()
    notifyData()
  })
  handle(Invoke.historySetEnabled, ({ value }) => {
    settings.historyEnabled = value
    saveSettings(store, settings)
    if (!value) conversationId = undefined // turning it back on starts a fresh saved chat
    return setState({ historyEnabled: value })
  })
  handle(Invoke.voiceSetSettings, (voice) => {
    settings.voice = voice
    saveSettings(store, settings)
    return setState({ voice })
  })
  const voiceConfig = async () => ({ baseUrl: settings.ai.baseUrl, model: settings.voice.model, apiKey: await getSecret(API_KEY) })
  handle(Invoke.voiceTranscribe, async ({ wav }, e) => {
    const allowed = settings.voice.input && (windows.isPanel(e.sender, 'chat') || e.sender === windows.island.webContents)
    if (!allowed) throw new Error('Rejected voice:transcribe: voice input is off or not allowed from this window')
    try {
      return { ok: true as const, text: await transcribe(await voiceConfig(), wav) }
    } catch (error) {
      return { ok: false as const, message: error instanceof ProviderError ? error.message : 'Could not understand the recording.' }
    }
  })
  handle(Invoke.voiceSynthesize, async ({ text }, e) => {
    // The character speaks replies; Settings plays the "Test voice" sample.
    if (!fromCharacter(e.sender) && !windows.isPanel(e.sender, 'settings')) throw new Error('Rejected voice:synthesize: not allowed from this window')
    try {
      const audio = await synthesize({ ...(await voiceConfig()), voice: settings.voice.voice, speed: settings.voice.speed }, text)
      return { ok: true as const, audio }
    } catch (error) {
      return { ok: false as const, message: error instanceof ProviderError ? error.message : 'Could not speak.' }
    }
  })
  handle(Invoke.dataDeleteAll, () => {
    store.deleteAllConversations()
    store.deleteAllMemories()
    newChat()
    notifyData()
  })
  handle(Invoke.aiListModels, async ({ baseUrl }): Promise<ListModelsResult> => {
    const url = baseUrl ?? settings.ai.baseUrl
    const sameService = new URL(url).origin === new URL(settings.ai.baseUrl).origin
    try {
      const models = await listModels({ baseUrl: url, model: settings.ai.model, apiKey: sameService ? await getSecret(API_KEY) : undefined })
      return { ok: true, models }
    } catch (error) {
      return { ok: false, message: error instanceof ProviderError ? error.message : 'Could not list models.' }
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
  const islandRegistered = globalShortcut.register(ISLAND_SHORTCUT, () => {
    if (!state.islandVisible) setState({ islandVisible: true })
    windows.setIslandExpanded(!windows.isIslandExpanded())
    setState({ islandExpanded: windows.isIslandExpanded() })
  })
  if (!islandRegistered) console.warn(`Global shortcut ${ISLAND_SHORTCUT} is taken by another application`)
  setState({
    shortcut: { accelerator: SHORTCUT, registered },
    islandShortcut: { accelerator: ISLAND_SHORTCUT, registered: islandRegistered }
  })

  for (const event of ['display-added', 'display-removed', 'display-metrics-changed'] as const) {
    screen.on(event as 'display-added', () => {
      windows.settleCharacter()
      if (state.islandVisible) windows.setIslandVisible(true)
    })
  }

  app.on('second-instance', () => setState({ characterVisible: true }))
  app.on('before-quit', () => {
    conversation.cancel()
    persist()
    windows.markQuitting()
  })
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    store.close()
  })
}
