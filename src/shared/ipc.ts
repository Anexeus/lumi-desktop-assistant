// IPC contract shared by main, preload and renderers. Types and channel names only:
// the preload imports this file, so it must stay free of runtime dependencies.
import type { CharacterEvent, CharacterState } from './character'

export type WindowName = 'chat' | 'settings'

export interface ChatItem {
  id: number
  role: 'user' | 'assistant' | 'error'
  text: string
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
  baseUrl: string
  model: string
}

export interface AiStatus extends AiSettings {
  hasApiKey: boolean
  /** True when the endpoint is on this computer (messages never leave it). */
  local: boolean
}

export interface ModelInfo {
  name: string
  authors: string[]
  licenseUrl: string | null
  /** True when the user loaded their own .vrm; false for the bundled default. */
  custom: boolean
  /** Bumped on every model change so the character window knows to reload. */
  revision: number
}

export interface AppState {
  characterVisible: boolean
  alwaysOnTop: boolean
  shortcut: { accelerator: string; registered: boolean }
  character: CharacterState
  model: ModelInfo
  islandVisible: boolean
  islandExpanded: boolean
  islandShortcut: { accelerator: string; registered: boolean }
  ai: AiStatus
  /** Save chats so they survive restarts. Turning it off keeps what is saved until deleted. */
  historyEnabled: boolean
  voice: VoiceSettings
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
  resetModel: 'model:reset',
  setIslandVisible: 'island:set-visible',
  setIslandExpanded: 'island:set-expanded',
  chatGet: 'chat:get',
  chatSend: 'chat:send',
  chatCancel: 'chat:cancel',
  chatClear: 'chat:clear',
  aiSetSettings: 'ai:set-settings',
  aiSetApiKey: 'ai:set-api-key',
  aiListModels: 'ai:list-models',
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
  voiceSynthesize: 'voice:synthesize'
} as const

/** Renderer → main, fire-and-forget (ipcRenderer.send). Character window only. */
export const Send = {
  setIgnoreMouse: 'character:set-ignore-mouse',
  dragStart: 'character:drag-start',
  dragMove: 'character:drag-move',
  dragEnd: 'character:drag-end',
  resize: 'character:resize',
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
  setCharacterVisible(value: boolean): Promise<AppState>
  openWindow(name: WindowName): Promise<void>
  /** Feeds the character state machine. Events that don't apply in the current state are ignored. */
  characterEvent(event: CharacterEvent): Promise<AppState>
  /** Returns state updates. Call the returned function to unsubscribe. */
  onState(listener: (state: AppState) => void): () => void
  setIslandVisible(value: boolean): Promise<AppState>
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
  /** Deletes all saved chats, memories and notes (not settings or the API key). */
  deleteAllData(): Promise<void>
  onDataChanged(listener: () => void): () => void
  model: {
    /** The user's model bytes, or null to use the bundled default. Character window only. */
    get(): Promise<Uint8Array | null>
    choose(): Promise<ChooseModelResult>
    reset(): Promise<AppState>
  }
  character: {
    setIgnoreMouse(ignore: boolean): void
    dragStart(screenX: number, screenY: number): void
    dragMove(screenX: number, screenY: number): void
    dragEnd(): void
    resize(width: number, height: number): void
    resizeEnd(): void
    showMenu(): void
    onCursor(listener: (x: number, y: number) => void): () => void
  }
}
