import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { Events, Invoke, Send, type AppState, type AssistantApi, type ChatEvent } from '@shared/ipc'

// Sandboxed preload: exposes a narrow, typed API. No Node or Electron objects leak to the page.
const api: AssistantApi = {
  getState: () => ipcRenderer.invoke(Invoke.getState),
  setAlwaysOnTop: (value) => ipcRenderer.invoke(Invoke.setAlwaysOnTop, { value }),
  setAssistantName: (name) => ipcRenderer.invoke(Invoke.setAssistantName, { name }),
  setCharacterVisible: (value) => ipcRenderer.invoke(Invoke.setCharacterVisible, { value }),
  openWindow: (name) => ipcRenderer.invoke(Invoke.openWindow, { name }),
  windowControl: (action) => ipcRenderer.invoke(Invoke.windowControl, { action }),
  characterEvent: (event) => ipcRenderer.invoke(Invoke.characterEvent, { event }),
  onState(listener) {
    const handler = (_event: IpcRendererEvent, state: AppState): void => listener(state)
    ipcRenderer.on(Events.state, handler)
    return () => ipcRenderer.removeListener(Events.state, handler)
  },
  setIslandVisible: (value) => ipcRenderer.invoke(Invoke.setIslandVisible, { value }),
  setIslandStyle: (style) => ipcRenderer.invoke(Invoke.setIslandStyle, { style }),
  setIslandModel: (value) => ipcRenderer.invoke(Invoke.setIslandModel, { value }),
  setShortcut: (action, accelerator) => ipcRenderer.invoke(Invoke.setShortcut, { action, accelerator }),
  menu: {
    run: (action) => ipcRenderer.invoke(Invoke.menuRun, { action })
  },
  island: {
    setExpanded: (expanded) => ipcRenderer.invoke(Invoke.setIslandExpanded, { expanded })
  },
  chat: {
    get: () => ipcRenderer.invoke(Invoke.chatGet),
    send: (text) => ipcRenderer.invoke(Invoke.chatSend, { text }),
    cancel: () => ipcRenderer.invoke(Invoke.chatCancel),
    clear: () => ipcRenderer.invoke(Invoke.chatClear),
    onEvent(listener) {
      const handler = (_event: IpcRendererEvent, chatEvent: ChatEvent): void => listener(chatEvent)
      ipcRenderer.on(Events.chat, handler)
      return () => ipcRenderer.removeListener(Events.chat, handler)
    }
  },
  ai: {
    setSettings: (settings) => ipcRenderer.invoke(Invoke.aiSetSettings, settings),
    setApiKey: (key) => ipcRenderer.invoke(Invoke.aiSetApiKey, { key }),
    listModels: (baseUrl) => ipcRenderer.invoke(Invoke.aiListModels, baseUrl ? { baseUrl } : {}),
    openKeyPage: (provider) => ipcRenderer.invoke(Invoke.aiOpenKeyPage, { provider })
  },
  memory: {
    list: () => ipcRenderer.invoke(Invoke.memoryList),
    add: (kind, text) => ipcRenderer.invoke(Invoke.memoryAdd, { kind, text }),
    delete: (id) => ipcRenderer.invoke(Invoke.memoryDelete, { id })
  },
  history: {
    list: () => ipcRenderer.invoke(Invoke.historyList),
    delete: (id) => ipcRenderer.invoke(Invoke.historyDelete, { id }),
    deleteAll: () => ipcRenderer.invoke(Invoke.historyDeleteAll),
    setEnabled: (value) => ipcRenderer.invoke(Invoke.historySetEnabled, { value })
  },
  voice: {
    setSettings: (settings) => ipcRenderer.invoke(Invoke.voiceSetSettings, settings),
    transcribe: (wav) => ipcRenderer.invoke(Invoke.voiceTranscribe, { wav }),
    synthesize: (text) => ipcRenderer.invoke(Invoke.voiceSynthesize, { text })
  },
  approve: (id, decision) => ipcRenderer.invoke(Invoke.approvalRespond, { id, decision }),
  tools: {
    addFolder: () => ipcRenderer.invoke(Invoke.toolsAddFolder),
    removeFolder: (path) => ipcRenderer.invoke(Invoke.toolsRemoveFolder, { path }),
    addApp: (kind) => ipcRenderer.invoke(Invoke.toolsAddApp, { kind }),
    removeApp: (path) => ipcRenderer.invoke(Invoke.toolsRemoveApp, { path }),
    setPluginEnabled: (id, enabled) => ipcRenderer.invoke(Invoke.toolsSetPlugin, { id, enabled }),
    setNotifications: (value) => ipcRenderer.invoke(Invoke.toolsSetNotifications, { value }),
    setScreenshots: (value) => ipcRenderer.invoke(Invoke.toolsSetScreenshots, { value }),
    setAutoApprove: (value) => ipcRenderer.invoke(Invoke.toolsSetAutoApprove, { value })
  },
  integrations: {
    setGithubToken: (token) => ipcRenderer.invoke(Invoke.githubSetToken, { token }),
    addMcp: (name, target) => ipcRenderer.invoke(Invoke.mcpAdd, { name, target }),
    removeMcp: (id) => ipcRenderer.invoke(Invoke.mcpRemove, { id }),
    updateMcp: (id, patch) => ipcRenderer.invoke(Invoke.mcpUpdate, { id, patch }),
    restartMcp: (id) => ipcRenderer.invoke(Invoke.mcpRestart, { id })
  },
  claude: {
    start: (prompt, project, mode) => ipcRenderer.invoke(Invoke.claudeStart, { prompt, project, mode }),
    cancel: (id) => ipcRenderer.invoke(Invoke.claudeCancel, { id }),
    choosePath: () => ipcRenderer.invoke(Invoke.claudeChoosePath),
    installHooks: () => ipcRenderer.invoke(Invoke.claudeInstallHooks),
    uninstallHooks: () => ipcRenderer.invoke(Invoke.claudeUninstallHooks)
  },
  deleteAllData: () => ipcRenderer.invoke(Invoke.dataDeleteAll),
  onDataChanged(listener) {
    const handler = (): void => listener()
    ipcRenderer.on(Events.dataChanged, handler)
    return () => ipcRenderer.removeListener(Events.dataChanged, handler)
  },
  stop: () => ipcRenderer.invoke(Invoke.emergencyStop),
  local: {
    download: (id) => ipcRenderer.invoke(Invoke.localDownload, { id }),
    cancel: () => ipcRenderer.invoke(Invoke.localCancel),
    remove: (id) => ipcRenderer.invoke(Invoke.localRemove, { id }),
    select: (kind, id) => ipcRenderer.invoke(Invoke.localSelect, { kind, id })
  },
  model: {
    get: () => ipcRenderer.invoke(Invoke.getModel),
    choose: () => ipcRenderer.invoke(Invoke.chooseModel),
    select: (id) => ipcRenderer.invoke(Invoke.selectCharacter, { id }),
    remove: (id) => ipcRenderer.invoke(Invoke.removeModel, { id }),
    setGraphics: (quality) => ipcRenderer.invoke(Invoke.setGraphics, { quality }),
    openSite: (site) => ipcRenderer.invoke(Invoke.openCharacterSite, { site })
  },
  mate: {
    import: () => ipcRenderer.invoke(Invoke.mateImport),
    remove: () => ipcRenderer.invoke(Invoke.mateRemove),
    library: () => ipcRenderer.invoke(Invoke.mateLibrary),
    clip: (id) => ipcRenderer.invoke(Invoke.mateClip, { id }),
    sound: (id) => ipcRenderer.invoke(Invoke.mateSound, { id })
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
    scale: (factor) => ipcRenderer.send(Send.scale, { factor }),
    resizeEnd: () => ipcRenderer.send(Send.resizeEnd),
    showMenu: () => ipcRenderer.send(Send.showMenu)
  }
}

contextBridge.exposeInMainWorld('assistant', api)
