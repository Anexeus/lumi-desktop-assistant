// IPC contract shared by main, preload and renderers. Types and channel names only:
// the preload imports this file, so it must stay free of runtime dependencies.

export type WindowName = 'chat' | 'settings'

export interface AppState {
  characterVisible: boolean
  alwaysOnTop: boolean
  shortcut: { accelerator: string; registered: boolean }
}

/** Renderer → main, request/response (ipcRenderer.invoke). */
export const Invoke = {
  getState: 'app:get-state',
  setAlwaysOnTop: 'app:set-always-on-top',
  setCharacterVisible: 'app:set-character-visible',
  openWindow: 'window:open'
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
  state: 'app:state'
} as const

export interface AssistantApi {
  getState(): Promise<AppState>
  setAlwaysOnTop(value: boolean): Promise<AppState>
  setCharacterVisible(value: boolean): Promise<AppState>
  openWindow(name: WindowName): Promise<void>
  /** Returns an unsubscribe function. */
  onState(listener: (state: AppState) => void): () => void
  character: {
    setIgnoreMouse(ignore: boolean): void
    dragStart(screenX: number, screenY: number): void
    dragMove(screenX: number, screenY: number): void
    dragEnd(): void
    resize(width: number, height: number): void
    resizeEnd(): void
    showMenu(): void
  }
}
