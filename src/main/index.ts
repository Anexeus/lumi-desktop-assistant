import { app, BrowserWindow, dialog, globalShortcut, Menu, Notification, screen, shell, type MenuItemConstructorOptions } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { z } from 'zod'
import { initialSnapshot, transition, TRANSIENT_MS, type CharacterEvent, type CharacterState } from '@shared/character'
import { Events, Invoke, Send, type AppState, type ChatEvent, type ChooseModelResult, type ListModelsResult } from '@shared/ipc'
import { runCommand, saveMemory } from './ai/commands'
import { Conversation } from './ai/conversation'
import { listModels, ProviderError, streamChat, type StreamEvent } from './ai/provider'
import { HOOK_PORT, hooksInstalled, installHooks, startHookServer, uninstallHooks, type HookEvent } from './claude/hooks'
import { ClaudeTasks, findClaude } from './claude/tasks'
import { PermissionBroker } from './tools/broker'
import { tool, type Plugin } from './tools/types'
import { appsPlugin, filesPlugin, notifyPlugin } from './tools/builtin'
import { githubPlugin } from './tools/github'
import { McpManager, parseCommandLine } from './tools/mcp'
import { createRegistry, runToolCall } from './tools/registry'
import { webPlugin } from './tools/web'
import { synthesize, transcribe } from './ai/voice'
import { handle, on } from './ipc'
import { DEFAULT_MODEL, importModel, readCustomModel, removeCustomModel } from './model'
import { hardenSession, hardenWebContents, registerAppScheme, serveBundle } from './security'
import { getSecret, hasSecret, isLocalUrl, loadSettings, saveSettings, setSecret } from './settings'
import { openStore } from './storage/store'
import { menuTemplate, createTray, type TrayActions } from './tray'
import type { VrmMeta } from './vrm-meta'
import { loadWindowState, saveWindowState } from './window-state'
import { glassSupported, WindowManager } from './windows'

const SHORTCUT = 'Control+Alt+Shift+A'
const ISLAND_SHORTCUT = 'Alt+Shift+Space' // Ctrl+Alt+Space is often taken; Alt+Space is the Windows window menu
const API_KEY = 'ai.apiKey'
const GITHUB_TOKEN = 'github.token'
const CURSOR_POLL_MS = 66 // ~15 Hz is enough for eyes to follow the pointer

// Lets E2E tests run against an isolated profile. Ignored in packaged builds.
const testUserData = process.env['DESKTOP_ASSISTANT_USER_DATA']
if (testUserData && !app.isPackaged) app.setPath('userData', testUserData)
// Pinned so renaming the app (productName) never moves the user's chats, memories and settings.
else app.setPath('userData', join(app.getPath('appData'), 'Desktop Assistant'))

// Fuses block Node's inspect flags but not Chromium's DevTools switches, so an installed Lumi refuses to start with them.
const DEBUG_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk']
if (app.isPackaged && DEBUG_SWITCHES.some((s) => app.commandLine.hasSwitch(s))) app.exit(1)

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
  saveSettings(store, settings) // persists generated defaults (e.g. the hook token) on first run
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
    glass: glassSupported,
    assistantName: settings.assistantName,
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
    voice: settings.voice,
    tools: { plugins: [], folders: settings.tools.folders, apps: settings.tools.apps, notifications: settings.tools.notifications },
    approvals: [],
    integrations: { githubToken: hasSecret(GITHUB_TOKEN), mcp: [] },
    claude: { path: null, hooksInstalled: false, hookServer: false, tasks: [], events: [] }
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
  // Tools: the broker is the only way an "act" tool runs; it asks the user through the chat window.
  const broker = new PermissionBroker((approvals) => {
    setState({ approvals })
    if (!approvals.length) return
    windows.openPanel('chat')
    notify(`${settings.assistantName} needs your OK`, approvals.at(-1)!.title)
  })
  const mcp = new McpManager(
    () => settings.mcp,
    () => setState({ integrations: integrationsState(), tools: toolsState() })
  )
  // Claude Code: hooks tell Lumi when it finishes or needs the user; tasks run with the user's own CLI.
  const testMode = !app.isPackaged
  const claudeSettingsFile = (testMode && process.env['DESKTOP_ASSISTANT_CLAUDE_SETTINGS']) || join(homedir(), '.claude', 'settings.json')
  const fakeClaude = testMode ? process.env['DESKTOP_ASSISTANT_FAKE_CLAUDE'] : undefined
  const hookEvents: AppState['claude']['events'] = []
  let hookServerUp = false
  const claudeState = (): AppState['claude'] => ({
    path: fakeClaude ? 'fake-claude (tests)' : findClaude(settings.claude.path),
    hooksInstalled: hooksInstalled(claudeSettingsFile),
    hookServer: hookServerUp,
    tasks: claudeTasks.list(),
    events: hookEvents.slice(0, 10)
  })
  const claudeTasks = new ClaudeTasks({
    command: () => findClaude(settings.claude.path),
    onChange: () => setState({ claude: claudeState() }),
    onFinished: (task) => {
      fire('notify')
      const what = task.status === 'done' ? 'finished' : task.status === 'canceled' ? 'was canceled' : 'failed'
      notify(`Claude Code ${what}: ${basename(task.project)}`, task.result ?? '')
    },
    ...(fakeClaude
      ? { spawnOverride: (args: string[], cwd: string) => spawn(process.env['DESKTOP_ASSISTANT_NODE'] ?? 'node', [fakeClaude, ...args], { cwd, windowsHide: true }) }
      : {})
  })
  const onHookEvent = (e: HookEvent): void => {
    const where = e.cwd ? basename(e.cwd) : 'a project'
    const text =
      e.hook_event_name === 'Stop'
        ? `Claude Code finished in ${where}`
        : e.hook_event_name === 'Notification'
          ? `Claude Code needs you in ${where}${e.message ? `: ${e.message}` : ''}`
          : `Claude Code: ${e.hook_event_name} in ${where}`
    hookEvents.unshift({ at: Date.now(), text: text.slice(0, 300) })
    hookEvents.splice(20)
    fire('notify')
    notify(settings.assistantName, text)
    setState({ claude: claudeState() })
  }
  const approvedProject = (project: string): string | undefined =>
    settings.tools.folders.find((f) => f.toLowerCase() === project.toLowerCase() || basename(f).toLowerCase() === project.toLowerCase())
  const claudePlugin: Plugin = {
    id: 'core.claude-code',
    name: 'Claude Code',
    version: '1.0.0',
    description: 'Hand coding tasks to your Claude Code, in an approved folder. Asks you first, every time.',
    permissions: ['claude-code'],
    tools: [
      tool({
        name: 'claude_task',
        get description() {
          return `Start a Claude Code task in one of the user's approved project folders: ${settings.tools.folders.map((f) => basename(f)).join(', ') || '(none approved)'}. It runs in the background; the user is notified when it ends.`
        },
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'What Claude Code should do, in detail' },
            project: { type: 'string', description: 'Folder name or path of an approved folder' },
            mode: { type: 'string', enum: ['plan', 'manual', 'acceptEdits'], description: 'plan = read-only (default); acceptEdits = may edit files' }
          },
          required: ['task', 'project']
        },
        input: z.object({ task: z.string().trim().min(1).max(8000), project: z.string().trim().min(1).max(1000), mode: z.enum(['plan', 'manual', 'acceptEdits']).default('plan') }),
        risk: 'act',
        describe: ({ task, project, mode }) => `Ask Claude Code (${mode} mode) in ${basename(approvedProject(project) ?? project)}: “${task.slice(0, 90)}”`,
        check: ({ project }) =>
          approvedProject(project) ? null : `“${project}” is not an approved folder. Approved: ${settings.tools.folders.map((f) => basename(f)).join(', ') || 'none'}.`,
        async run({ task, project, mode }) {
          const started = claudeTasks.start(task, approvedProject(project)!, mode)
          return started.status === 'failed' ? `Could not start: ${started.result}` : 'Started. The user will be notified when Claude Code finishes; progress is in the chat window’s Tasks.'
        }
      })
    ]
  }

  const builtins = [
    claudePlugin,
    filesPlugin(() => settings.tools.folders),
    appsPlugin(() => settings.tools.apps),
    notifyPlugin(() => settings.tools.notifications),
    webPlugin(),
    githubPlugin(() => getSecret(GITHUB_TOKEN))
  ]
  const registry = createRegistry(() => [...builtins, ...mcp.plugins()], () => settings.tools.disabled)
  const integrationsState = (): AppState['integrations'] => ({ githubToken: hasSecret(GITHUB_TOKEN), mcp: mcp.info() })
  const saveMcp = async (servers: typeof settings.mcp): Promise<AppState> => {
    settings.mcp = servers
    saveSettings(store, settings)
    await mcp.sync()
    return setState({ integrations: integrationsState(), tools: toolsState() })
  }
  const toolsState = (): AppState['tools'] => ({
    plugins: registry.info(),
    folders: settings.tools.folders,
    apps: settings.tools.apps,
    notifications: settings.tools.notifications
  })
  const saveTools = (patch: Partial<typeof settings.tools>): AppState => {
    settings.tools = { ...settings.tools, ...patch }
    saveSettings(store, settings)
    return setState({ tools: toolsState() })
  }
  function notify(title: string, body: string): void {
    if (!settings.tools.notifications || !Notification.isSupported()) return
    const n = new Notification({ title, body: body.slice(0, 200) })
    n.on('click', () => windows.openPanel('chat'))
    n.show()
  }

  // Ollama stops when its window is closed. If the local AI is unreachable, start it (fixed known path only) and retry once.
  const OLLAMA_APP = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'Ollama', 'ollama app.exe')
  let ollamaStarting: Promise<boolean> | undefined
  async function startOllama(): Promise<boolean> {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):11434\b/.test(settings.ai.baseUrl) || !existsSync(OLLAMA_APP)) return false
    ollamaStarting ??= (async () => {
      await shell.openPath(OLLAMA_APP)
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (await fetch('http://127.0.0.1:11434/api/version').then((r) => r.ok, () => false)) return true
      }
      return false
    })().finally(() => (ollamaStarting = undefined))
    return ollamaStarting
  }
  async function* chatStream(messages: Parameters<typeof streamChat>[1], signal: AbortSignal): AsyncGenerator<StreamEvent> {
    const run = async function* (): AsyncGenerator<StreamEvent> {
      yield* streamChat({ ...settings.ai, apiKey: await getSecret(API_KEY) }, messages, { signal, tools: registry.specs() })
    }
    try {
      yield* run()
    } catch (error) {
      if (!(error instanceof ProviderError && error.kind === 'unreachable') || !(await startOllama())) throw error
      yield* run()
    }
  }

  const notifyData = (): void => {
    for (const win of windows.allWindows()) win.webContents.send(Events.dataChanged)
  }
  // The row for the chat on screen is created on its first saved message; "New chat" starts another.
  let conversationId: number | undefined
  const conversation = new Conversation({
    stream: chatStream,
    runTool: (call, signal) => runToolCall(registry, broker, call, signal),
    toolNames: () => registry.specs().map((t) => t.function.name),
    onSnapshot: (snapshot) => broadcastChat({ type: 'snapshot', snapshot }),
    onDelta: (id, text) => broadcastChat({ type: 'delta', id, text }),
    // With voice on, the character window says when speaking is over (the audio outlasts the text stream).
    onCharacter: (event) => (event === 'done' && settings.voice.output !== 'off' ? undefined : fire(event)),
    name: () => settings.assistantName,
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
    broker.reset()
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
  handle(Invoke.setAssistantName, ({ name }) => {
    settings.assistantName = name
    saveSettings(store, settings)
    return setState({ assistantName: name })
  })
  handle(Invoke.setCharacterVisible, ({ value }) => setState({ characterVisible: value }))
  handle(Invoke.openWindow, ({ name }) => windows.openPanel(name))
  handle(Invoke.windowControl, ({ action }, e) => {
    if (!windows.isPanel(e.sender, 'chat') && !windows.isPanel(e.sender, 'settings')) throw new Error('Rejected window:control')
    const win = BrowserWindow.fromWebContents(e.sender)!
    if (action === 'minimize') win.minimize()
    else win.close() // hides: panels keep their state
  })
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
  handle(Invoke.approvalRespond, ({ id, decision }) => broker.respond(id, decision))
  handle(Invoke.toolsAddFolder, async (_p, e) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const options: Electron.OpenDialogOptions = { title: 'Choose a folder Lumi may search (read-only)', properties: ['openDirectory'] }
    const picked = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    const folder = picked.filePaths[0]
    if (picked.canceled || !folder || settings.tools.folders.includes(folder)) return state
    return saveTools({ folders: [...settings.tools.folders, folder] })
  })
  handle(Invoke.toolsRemoveFolder, ({ path }) => saveTools({ folders: settings.tools.folders.filter((f) => f !== path) }))
  handle(Invoke.toolsAddApp, async ({ kind }, e) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const options: Electron.OpenDialogOptions =
      kind === 'folder'
        ? { title: 'Choose a folder Lumi may open', properties: ['openDirectory'] }
        : { title: 'Choose an app Lumi may open', properties: ['openFile'], filters: [{ name: 'Apps and shortcuts', extensions: ['exe', 'lnk', 'url', 'appref-ms'] }] }
    const picked = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    const path = picked.filePaths[0]
    if (picked.canceled || !path || settings.tools.apps.some((a) => a.path === path)) return state
    const name = basename(path, extname(path)).replace(/[-_]+/g, ' ').trim().slice(0, 120) || path
    return saveTools({ apps: [...settings.tools.apps, { name, path }] })
  })
  handle(Invoke.toolsRemoveApp, ({ path }) => saveTools({ apps: settings.tools.apps.filter((a) => a.path !== path) }))
  handle(Invoke.toolsSetPlugin, ({ id, enabled }) =>
    saveTools({ disabled: enabled ? settings.tools.disabled.filter((d) => d !== id) : [...new Set([...settings.tools.disabled, id])] })
  )
  handle(Invoke.toolsSetNotifications, ({ value }) => saveTools({ notifications: value }))
  handle(Invoke.claudeStart, ({ prompt, project, mode }) => {
    const folder = approvedProject(project)
    if (!folder) throw new Error('Rejected claude:start: not an approved folder')
    claudeTasks.start(prompt, folder, mode)
    return setState({ claude: claudeState() })
  })
  handle(Invoke.claudeCancel, ({ id }) => {
    claudeTasks.cancel(id)
    return setState({ claude: claudeState() })
  })
  handle(Invoke.claudeChoosePath, async (_p, e) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const options: Electron.OpenDialogOptions = { title: 'Choose the claude executable', properties: ['openFile'], filters: [{ name: 'Programs', extensions: ['exe', 'cmd'] }] }
    const picked = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (!picked.canceled && picked.filePaths[0]) {
      settings.claude.path = picked.filePaths[0]
      saveSettings(store, settings)
    }
    return setState({ claude: claudeState() })
  })
  handle(Invoke.claudeInstallHooks, () => {
    try {
      const backup = installHooks(claudeSettingsFile, settings.claude.hookToken)
      setState({ claude: claudeState() })
      return { ok: true as const, backup }
    } catch (error) {
      return { ok: false as const, message: `Could not update ${claudeSettingsFile}: ${error instanceof Error ? error.message : error}` }
    }
  })
  handle(Invoke.claudeUninstallHooks, () => {
    uninstallHooks(claudeSettingsFile)
    return setState({ claude: claudeState() })
  })
  handle(Invoke.githubSetToken, async ({ token }) => {
    await setSecret(GITHUB_TOKEN, token)
    return setState({ integrations: integrationsState() })
  })
  handle(Invoke.mcpAdd, async ({ name, target }) => {
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'server'}-${Date.now().toString(36).slice(-4)}`
    const remote = /^https?:\/\//i.test(target)
    const { command, args } = remote ? { command: '', args: [] } : parseCommandLine(target)
    if (!remote && !command) throw new Error('Rejected mcp:add: empty command')
    // New servers start untrusted: every tool call asks first.
    return saveMcp([...settings.mcp, { id, name, command, args, ...(remote ? { url: target } : {}), trusted: false, enabled: true }])
  })
  handle(Invoke.mcpRemove, ({ id }) => saveMcp(settings.mcp.filter((m) => m.id !== id)))
  handle(Invoke.mcpUpdate, ({ id, patch }) => saveMcp(settings.mcp.map((m) => (m.id === id ? { ...m, ...patch } : m))))
  handle(Invoke.mcpRestart, async ({ id }) => {
    await mcp.restart(id)
    return setState({ integrations: integrationsState(), tools: toolsState() })
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

  setState({ tools: toolsState() })
  void mcp.sync()
  const hookPort = (testMode && Number(process.env['DESKTOP_ASSISTANT_HOOK_PORT'])) || HOOK_PORT
  void startHookServer(() => settings.claude.hookToken, onHookEvent, hookPort).then((server) => {
    hookServerUp = !!server
    if (!server) console.warn(`Claude Code hook port ${hookPort} is in use; hook notifications are off`)
    setState({ claude: claudeState() })
  })

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
    claudeTasks.cancelAll()
    void mcp.closeAll()
    globalShortcut.unregisterAll()
    store.close()
  })
}
