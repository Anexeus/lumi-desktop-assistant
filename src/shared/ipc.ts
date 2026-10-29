// IPC contract shared by main, preload and renderers. Types and channel names only:
// the preload imports this file, so it must stay free of runtime dependencies.
import type { CharacterEvent, CharacterState } from './character'

export type WindowName = 'chat' | 'settings'

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
}

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
  resetModel: 'model:reset'
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
  cursor: 'character:cursor'
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
