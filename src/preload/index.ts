import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { Events, Invoke, Send, type AppState, type AssistantApi } from '@shared/ipc'

// Sandboxed preload: exposes a narrow, typed API. No Node or Electron objects leak to the page.
const api: AssistantApi = {
  getState: () => ipcRenderer.invoke(Invoke.getState),
  setAlwaysOnTop: (value) => ipcRenderer.invoke(Invoke.setAlwaysOnTop, { value }),
  setCharacterVisible: (value) => ipcRenderer.invoke(Invoke.setCharacterVisible, { value }),
  openWindow: (name) => ipcRenderer.invoke(Invoke.openWindow, { name }),
  characterEvent: (event) => ipcRenderer.invoke(Invoke.characterEvent, { event }),
  onState(listener) {
    const handler = (_event: IpcRendererEvent, state: AppState): void => listener(state)
    ipcRenderer.on(Events.state, handler)
    return () => ipcRenderer.removeListener(Events.state, handler)
  },
  model: {
    get: () => ipcRenderer.invoke(Invoke.getModel),
    choose: () => ipcRenderer.invoke(Invoke.chooseModel),
    reset: () => ipcRenderer.invoke(Invoke.resetModel)
  },
  character: {
    onCursor(listener) {
      const handler = (_event: IpcRendererEvent, x: number, y: number): void => listener(x, y)
      ipcRenderer.on(Events.cursor, handler)
      return () => ipcRenderer.removeListener(Events.cursor, handler)
    },
    setIgnoreMouse: (ignore) => ipcRenderer.send(Send.setIgnoreMouse, { ignore }),
    dragStart: (screenX, screenY) => ipcRenderer.send(Send.dragStart, { screenX, screenY }),
    dragMove: (screenX, screenY) => ipcRenderer.send(Send.dragMove, { screenX, screenY }),
    dragEnd: () => ipcRenderer.send(Send.dragEnd),
    resize: (width, height) => ipcRenderer.send(Send.resize, { width, height }),
    resizeEnd: () => ipcRenderer.send(Send.resizeEnd),
    showMenu: () => ipcRenderer.send(Send.showMenu)
  }
}

contextBridge.exposeInMainWorld('assistant', api)
