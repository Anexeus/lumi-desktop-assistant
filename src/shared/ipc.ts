import type { ProviderId } from './providers'
// IPC contract shared by main, preload and renderers. Types and channel names only:
// the preload imports this file, so it must stay free of runtime dependencies.
import type { CharacterEvent, CharacterState, Perch } from './character'
import type { ShortcutAction } from './shortcuts'

export type WindowName = 'chat' | 'settings'

/** The island's look: a black pill with curved sides, or Windows' blurred glass (which can only round its corners a little). */
export type IslandStyle = 'pill' | 'glass'

/** What the character's and tray's menu can do. */
export const MENU_ACTIONS = ['chat', 'settings', 'character', 'alwaysOnTop', 'stop', 'quit', 'close'] as const
export type MenuAction = (typeof MENU_ACTIONS)[number]

export interface ChatItem {
  id: number
  /** "tool" items are activity lines ("Searched your folders for …"), not messages. */
  role: 'user' | 'assistant' | 'error' | 'tool'
  text: string
  /** Tool items only: whether the action worked, once it has finished. */
  ok?: boolean
}

export type ApprovalDecision = 'once' | 'chat' | 'deny'

/** An action waiting for the user's OK. */
export interface ApprovalRequest {
  id: number
  tool: string
  title: string
  detail: string
}

export interface ApprovedApp {
  name: string
  path: string
}

export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  permissions: string[]
  tools: string[]
  enabled: boolean
}

export interface McpServerConfig {
  id: string
  name: string
  /** For a local (stdio) server. */
  command: string
  args: string[]
  /** For a remote (HTTP) server instead of a command. */
  url?: string
  /** Lets the server's read-only tools run without asking. */
  trusted: boolean
  enabled: boolean
}

export interface McpServerInfo extends McpServerConfig {
  status: 'off' | 'connecting' | 'ready' | 'error'
  error?: string
  tools: string[]
}

export interface IntegrationsState {
  githubToken: boolean
  mcp: McpServerInfo[]
}

/** plan = read-only planning; manual = anything needing approval is denied and reported; acceptEdits = may edit files. */
export type ClaudeMode = 'plan' | 'manual' | 'acceptEdits'

export interface ClaudeTask {
  id: string
  prompt: string
  project: string
  mode: ClaudeMode
  status: 'running' | 'done' | 'failed' | 'canceled'
  progress: string[]
  result?: string
  cost?: number
  /** Actions Claude Code wanted but was not allowed in this mode. */
  denials?: number
  startedAt: number
  endedAt?: number
}

export interface ClaudeState {
  /** The CLI Lumi will run, or null if none was found. */
  path: string | null
  hooksInstalled: boolean
  /** False if the hook port was taken. */
  hookServer: boolean
  tasks: ClaudeTask[]
  /** Recent events from Claude Code hooks (newest first). */
  events: { at: number; text: string }[]
}

export interface ToolsState {
  plugins: PluginInfo[]
  folders: string[]
  apps: ApprovedApp[]
  notifications: boolean
  /** The user allows sending a screenshot to a cloud vision model when Lumi can't read a window otherwise. */
  screenshots: boolean
  /** Act-risk tools run without an approval card (the user's choice; the emergency stop still works). */
  autoApprove: boolean
}

export interface ChatSnapshot {
  items: ChatItem[]
  status: 'idle' | 'thinking' | 'streaming'
}

/** Snapshots on structural changes; deltas append streamed text to one item. */
export type ChatEvent = { type: 'snapshot'; snapshot: ChatSnapshot } | { type: 'delta'; id: number; text: string }

export type MemoryKind = 'memory' | 'note'

/** "memory" items are given to the AI with every message; "note" items are only kept for the user. */
export interface MemoryItem {
  id: number
  kind: MemoryKind
  text: string
  createdAt: number
}

export interface ConversationSummary {
  id: number
  title: string
  startedAt: number
  updatedAt: number
  messages: number
}

export type SaveResult = { ok: true } | { ok: false; message: string }

export interface VoiceSettings {
  /** How replies are spoken: Ollama's speech model, the built-in Windows voice, or not at all. */
  output: 'local' | 'system' | 'off'
  /** Push-to-talk microphone buttons. The mic is only ever open while recording. */
  input: boolean
  /** Speech-to-text engine: Lumi's built-in whisper, or the AI server's /audio/transcriptions with `model`. */
  stt: 'builtin' | 'server'
  /** Hands-free voice mode only responds when the assistant's name is said. */
  wake: boolean
  /** Speech model on the AI server (both directions), e.g. lfm3-audio. */
  model: string
  /** Voice name: for the Ollama model, or a Windows voice name. Empty = default. */
  voice: string
  speed: number
  /** Microphone deviceId; empty = system default. */
  micId: string
}

export type TranscribeResult = { ok: true; text: string } | { ok: false; message: string }
export type SpeechResult = { ok: true; audio: Uint8Array } | { ok: false; message: string }

export interface AiSettings {
  /** See PROVIDERS in providers.ts. "builtin" is Lumi's own engine (baseUrl unused). */
  provider: ProviderId
  baseUrl: string
  model: string
}

export interface LocalServerStatus {
  state: 'stopped' | 'starting' | 'ready' | 'error'
  /** GPU name, "CPU", or null when stopped. */
  device: string | null
  message: string
}

/** Lumi's built-in engines (llama.cpp chat, whisper.cpp speech-to-text). */
export interface LocalState {
  /** False if the engines are missing from this install. */
  runtime: boolean
  llm: string
  stt: string
  installed: string[]
  download: { id: string; received: number; total: number } | null
  downloadError: string | null
  servers: { llm: LocalServerStatus; stt: LocalServerStatus }
}

export interface AiStatus extends AiSettings {
  hasApiKey: boolean
  /** True when the endpoint is on this computer (messages never leave it). */
  local: boolean
}

/** Character render quality: resolution and frame rate. */
export type Graphics = 'low' | 'balanced' | 'high'

export interface ModelInfo {
  /** A bundled character's id, or 'custom' for the user's own .vrm. */
  id: string
  name: string
  authors: string[]
  licenseUrl: string | null
  /** True when the user loaded their own .vrm; false for a bundled character. */
  custom: boolean
  /** The bundled .vrm file to load (null for a custom model, whose bytes come from model.get()). */
  file: string | null
  license: string | null
  /** Bumped on every model change so the character window knows to reload. */
  revision: number
}

export interface AppState {
  /** True when the OS draws frosted glass (Windows 11 22H2+ Acrylic) behind the panels. */
  glass: boolean
  /** What the assistant is called (default "Lumi"). */
  assistantName: string
  characterVisible: boolean
  alwaysOnTop: boolean
  /** Global shortcuts; `registered` is false when another app already owns the combination. */
  shortcuts: Record<ShortcutAction, { accelerator: string; registered: boolean }>
  character: CharacterState
  model: ModelInfo
  islandVisible: boolean
  islandExpanded: boolean
  islandStyle: IslandStyle
  ai: AiStatus
  /** Save chats so they survive restarts. Turning it off keeps what is saved until deleted. */
  historyEnabled: boolean
  voice: VoiceSettings
  tools: ToolsState
  approvals: ApprovalRequest[]
  integrations: IntegrationsState
  claude: ClaudeState
  graphics: Graphics
  local: LocalState
  /** True while Lumi is operating the desktop (shown on the island, with the emergency stop). */
  controlling: boolean
  /** What the chat window shows: the conversation or Settings (Settings has no window of its own). */
  panelView: 'chat' | 'settings'
  /** Peeking in from a screen edge, sitting on a window, falling off one, or just standing. */
  perch: Perch
}

export type ListModelsResult = { ok: true; models: string[] } | { ok: false; message: string }

export type ChooseModelResult = { ok: true; state: AppState } | { ok: false; canceled: boolean; message?: string }

/** Renderer → main, request/response (ipcRenderer.invoke). */
export const Invoke = {
  getState: 'app:get-state',
  setAlwaysOnTop: 'app:set-always-on-top',
  setCharacterVisible: 'app:set-character-visible',
  openWindow: 'window:open',
  characterEvent: 'character:event',
  getModel: 'model:get',
  chooseModel: 'model:choose',
  selectCharacter: 'model:select',
  setGraphics: 'graphics:set',
  setShortcut: 'shortcuts:set',
  emergencyStop: 'app:emergency-stop',
  localDownload: 'local:download',
  localCancel: 'local:cancel',
  localRemove: 'local:remove',
  localSelect: 'local:select',
  setIslandVisible: 'island:set-visible',
  setIslandStyle: 'island:set-style',
  menuRun: 'menu:run',
  setIslandExpanded: 'island:set-expanded',
  chatGet: 'chat:get',
  chatSend: 'chat:send',
  chatCancel: 'chat:cancel',
  chatClear: 'chat:clear',
  aiSetSettings: 'ai:set-settings',
  aiSetApiKey: 'ai:set-api-key',
  aiListModels: 'ai:list-models',
  aiOpenKeyPage: 'ai:open-key-page',
  openCharacterSite: 'model:open-site',
  memoryList: 'memory:list',
  memoryAdd: 'memory:add',
  memoryDelete: 'memory:delete',
  historyList: 'history:list',
  historyDelete: 'history:delete',
  historyDeleteAll: 'history:delete-all',
  historySetEnabled: 'history:set-enabled',
  dataDeleteAll: 'data:delete-all',
  voiceSetSettings: 'voice:set-settings',
  voiceTranscribe: 'voice:transcribe',
  voiceSynthesize: 'voice:synthesize',
  setAssistantName: 'app:set-assistant-name',
  windowControl: 'window:control',
  approvalRespond: 'approval:respond',
  toolsAddFolder: 'tools:add-folder',
  toolsRemoveFolder: 'tools:remove-folder',
  toolsAddApp: 'tools:add-app',
  toolsRemoveApp: 'tools:remove-app',
  toolsSetPlugin: 'tools:set-plugin',
  toolsSetNotifications: 'tools:set-notifications',
  toolsSetScreenshots: 'tools:set-screenshots',
  toolsSetAutoApprove: 'tools:set-auto-approve',
  githubSetToken: 'github:set-token',
  mcpAdd: 'mcp:add',
  mcpRemove: 'mcp:remove',
  mcpUpdate: 'mcp:update',
  mcpRestart: 'mcp:restart',
  claudeStart: 'claude:start',
  claudeCancel: 'claude:cancel',
  claudeChoosePath: 'claude:choose-path',
  claudeInstallHooks: 'claude:install-hooks',
  claudeUninstallHooks: 'claude:uninstall-hooks'
} as const

/** Renderer → main, fire-and-forget (ipcRenderer.send). Character window only. */
export const Send = {
  setIgnoreMouse: 'character:set-ignore-mouse',
  dragStart: 'character:drag-start',
  dragMove: 'character:drag-move',
  dragEnd: 'character:drag-end',
  resize: 'character:resize',
  scale: 'character:scale',
  resizeEnd: 'character:resize-end',
  showMenu: 'character:show-menu'
} as const

/** Main → renderer events. */
export const Events = {
  state: 'app:state',
  /** Cursor position relative to the character window's top-left, in DIPs. Character window only. */
  cursor: 'character:cursor',
  chat: 'chat:event',
  /** Saved memories, notes or history changed; listeners re-fetch what they show. */
  dataChanged: 'data:changed'
} as const

export interface AssistantApi {
  getState(): Promise<AppState>
  setAlwaysOnTop(value: boolean): Promise<AppState>
  setAssistantName(name: string): Promise<AppState>
  setCharacterVisible(value: boolean): Promise<AppState>
  openWindow(name: WindowName): Promise<void>
  /** Chat and Settings only (they draw their own glass title bar). */
  windowControl(action: 'minimize' | 'close'): Promise<void>
  /** Feeds the character state machine. Events that don't apply in the current state are ignored. */
  characterEvent(event: CharacterEvent): Promise<AppState>
  /** Returns state updates. Call the returned function to unsubscribe. */
  onState(listener: (state: AppState) => void): () => void
  setIslandVisible(value: boolean): Promise<AppState>
  setIslandStyle(style: IslandStyle): Promise<AppState>
  /** Rebinds a global shortcut (null restores the default). Fails when another app or Lumi action already uses it. */
  setShortcut(action: ShortcutAction, accelerator: string | null): Promise<{ ok: true; state: AppState } | { ok: false; message: string }>
  menu: {
    /** Menu window only: runs the item and closes the menu. */
    run(action: MenuAction): Promise<void>
  }
  island: {
    /** Island window only: grow into the input panel or shrink back to the pill. */
    setExpanded(expanded: boolean): Promise<void>
  }
  chat: {
    get(): Promise<ChatSnapshot>
    send(text: string): Promise<void>
    cancel(): Promise<void>
    clear(): Promise<void>
    onEvent(listener: (event: ChatEvent) => void): () => void
  }
  ai: {
    setSettings(settings: AiSettings): Promise<AppState>
    /** Stored encrypted in main; never readable again from a renderer. null removes it. */
    setApiKey(key: string | null): Promise<AppState>
    /** Lists models at baseUrl (default: the saved one); doubles as a connection test. */
    listModels(baseUrl?: string): Promise<ListModelsResult>
    /** Opens the current provider's own page for creating an API key, in the default browser. */
    openKeyPage(provider: ProviderId): Promise<void>
  }
  /** Emergency stop: cancels the reply, any pending approval and any desktop action in flight. */
  stop(): Promise<void>
  local: {
    /** Downloads a built-in model (resumable, checksum-verified); progress arrives in state.local. */
    download(id: string): Promise<AppState>
    cancel(): Promise<AppState>
    remove(id: string): Promise<AppState>
    select(kind: 'llm' | 'stt', id: string): Promise<AppState>
  }
  memory: {
    list(): Promise<MemoryItem[]>
    /** Refuses empty, over-long or secret-looking text with a readable message. */
    add(kind: MemoryKind, text: string): Promise<SaveResult>
    delete(id: number): Promise<void>
  }
  history: {
    list(): Promise<ConversationSummary[]>
    delete(id: number): Promise<void>
    deleteAll(): Promise<void>
    setEnabled(value: boolean): Promise<AppState>
  }
  voice: {
    setSettings(settings: VoiceSettings): Promise<AppState>
    /** A 16 kHz mono WAV recording → text. */
    transcribe(wav: Uint8Array): Promise<TranscribeResult>
    /** Character and Settings windows only: text → WAV audio. */
    synthesize(text: string): Promise<SpeechResult>
  }
  /** Answer a pending action request (Allow once / Allow for this chat / Deny). */
  approve(id: number, decision: ApprovalDecision): Promise<void>
  tools: {
    /** Opens a folder picker; the chosen folder becomes searchable (read-only). */
    addFolder(): Promise<AppState>
    removeFolder(path: string): Promise<AppState>
    /** Opens a file picker for an app (.exe/.lnk) or a folder kind 'folder'. */
    addApp(kind: 'app' | 'folder'): Promise<AppState>
    removeApp(path: string): Promise<AppState>
    setPluginEnabled(id: string, enabled: boolean): Promise<AppState>
    setNotifications(enabled: boolean): Promise<AppState>
    setScreenshots(enabled: boolean): Promise<AppState>
    setAutoApprove(enabled: boolean): Promise<AppState>
  }
  integrations: {
    /** Stored encrypted; null removes it. Use a read-only fine-grained token. */
    setGithubToken(token: string | null): Promise<AppState>
    /** A command line (local server) or an https URL (remote server). */
    addMcp(name: string, target: string): Promise<AppState>
    removeMcp(id: string): Promise<AppState>
    updateMcp(id: string, patch: { enabled?: boolean; trusted?: boolean }): Promise<AppState>
    restartMcp(id: string): Promise<AppState>
  }
  claude: {
    /** Runs a task with the user's own Claude Code CLI, in an approved folder. Never bypasses permissions. */
    start(prompt: string, project: string, mode: ClaudeMode): Promise<AppState>
    cancel(id: string): Promise<AppState>
    choosePath(): Promise<AppState>
    /** Adds Lumi's hooks to ~/.claude/settings.json (backed up first). */
    installHooks(): Promise<{ ok: true; backup: string | null } | { ok: false; message: string }>
    uninstallHooks(): Promise<AppState>
  }
  /** Deletes all saved chats, memories and notes (not settings or the API key). */
  deleteAllData(): Promise<void>
  onDataChanged(listener: () => void): () => void
  model: {
    /** The user's model bytes, or null to use the bundled default. Character window only. */
    get(): Promise<Uint8Array | null>
    choose(): Promise<ChooseModelResult>
    /** Switches to a bundled character (dropping any custom model) and matches the voice to it. */
    select(id: string): Promise<AppState>
    setGraphics(quality: Graphics): Promise<AppState>
    /** Opens a VRoid Hub search for more characters (Lumi can't bundle Miku or Teto: their licences forbid it). */
    openSite(site: 'miku' | 'teto' | 'browse'): Promise<void>
  }
  character: {
    setIgnoreMouse(ignore: boolean): void
    dragStart(screenX: number, screenY: number): void
    dragMove(screenX: number, screenY: number): void
    dragEnd(): void
    resize(width: number, height: number): void
    /** Proportional resize by `factor` around her feet (mouse wheel, + and −); finish with resizeEnd(). */
    scale(factor: number): void
    resizeEnd(): void
    showMenu(): void
    onCursor(listener: (x: number, y: number) => void): () => void
  }
}
