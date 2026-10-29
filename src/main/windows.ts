import { app, BrowserWindow, nativeTheme, screen, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'
import type { WindowName } from '@shared/ipc'
import { devServerUrl } from './env'
import { clampSize, fitToDisplays, placeBeside, type Rect } from './geometry'
import { APP_HOST, APP_SCHEME } from './policy'

type Page = 'character' | WindowName

const secureWebPreferences: BrowserWindowConstructorOptions['webPreferences'] = {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
  webviewTag: false,
  spellcheck: false,
  devTools: !app.isPackaged
}

const panelSpecs: Record<WindowName, { title: string; width: number; height: number }> = {
  chat: { title: 'Assistant — Chat', width: 400, height: 560 },
  settings: { title: 'Assistant — Settings', width: 520, height: 560 }
}

function loadPage(win: BrowserWindow, page: Page): Promise<void> {
  const url = devServerUrl ? `${devServerUrl}/${page}.html` : `${APP_SCHEME}://${APP_HOST}/${page}.html`
  return win.loadURL(url)
}

function workAreas(): { all: Rect[]; primary: Rect } {
  return { all: screen.getAllDisplays().map((d) => d.workArea), primary: screen.getPrimaryDisplay().workArea }
}

export class WindowManager {
  readonly character: BrowserWindow
  private readonly panels = new Map<WindowName, BrowserWindow>()
  private drag: { mouseX: number; mouseY: number; bounds: Rect } | undefined
  private quitting = false

  constructor(
    saved: Rect | undefined,
    alwaysOnTop: boolean,
    private readonly onCharacterBoundsSettled: (bounds: Rect) => void,
    onCharacterCloseRequested: () => void
  ) {
    const { all, primary } = workAreas()
    this.character = new BrowserWindow({
      ...fitToDisplays(saved, all, primary),
      title: 'Desktop Assistant',
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      // All character geometry is in content bounds: on scaled displays (e.g. 125%) the
      // window bounds round differently and setPosition grows the window by ~1px per call.
      useContentSize: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: secureWebPreferences
    })
    this.character.setAlwaysOnTop(alwaysOnTop, 'floating')
    // Empty space clicks through; the renderer turns this off while the cursor is over the body.
    this.character.setIgnoreMouseEvents(true, { forward: true })
    this.character.on('close', (event) => {
      if (this.quitting) return
      event.preventDefault()
      onCharacterCloseRequested()
    })
    void loadPage(this.character, 'character')
  }

  markQuitting(): void {
    this.quitting = true
  }

  setCharacterVisible(visible: boolean): void {
    if (visible) this.character.showInactive()
    else this.character.hide()
  }

  setAlwaysOnTop(value: boolean): void {
    this.character.setAlwaysOnTop(value, 'floating')
  }

  setIgnoreMouse(ignore: boolean): void {
    this.character.setIgnoreMouseEvents(ignore, { forward: true })
  }

  characterBounds(): Rect {
    return this.character.getContentBounds()
  }

  dragStart(screenX: number, screenY: number): void {
    this.drag = { mouseX: screenX, mouseY: screenY, bounds: this.characterBounds() }
  }

  dragMove(screenX: number, screenY: number): void {
    if (!this.drag) return
    const { mouseX, mouseY, bounds } = this.drag
    this.character.setContentBounds({
      x: Math.round(bounds.x + screenX - mouseX),
      y: Math.round(bounds.y + screenY - mouseY),
      width: bounds.width,
      height: bounds.height
    })
  }

  dragEnd(): void {
    this.drag = undefined
    this.settleCharacter()
  }

  resizeCharacter(width: number, height: number): void {
    const { x, y } = this.characterBounds()
    this.character.setContentBounds({ x, y, ...clampSize(width, height) })
  }

  /** Pulls the character back onto a display if needed and reports the final bounds. */
  settleCharacter(): void {
    const { all, primary } = workAreas()
    const fitted = fitToDisplays(this.characterBounds(), all, primary)
    this.character.setContentBounds(fitted)
    this.onCharacterBoundsSettled(fitted)
  }

  openPanel(name: WindowName): void {
    let win = this.panels.get(name)
    const created = !win || win.isDestroyed()
    if (!win || win.isDestroyed()) {
      win = this.createPanel(name)
      this.panels.set(name, win)
    }
    if (name === 'chat' && this.character.isVisible()) {
      const anchor = this.characterBounds()
      const area = screen.getDisplayMatching(anchor).workArea
      win.setBounds(placeBeside(anchor, win.getBounds(), area))
    }
    const target = win
    if (created) target.once('ready-to-show', () => target.show())
    else {
      target.show()
      target.focus()
    }
  }

  allWindows(): BrowserWindow[] {
    return [this.character, ...this.panels.values()].filter((w) => !w.isDestroyed())
  }

  private createPanel(name: WindowName): BrowserWindow {
    const spec = panelSpecs[name]
    const win = new BrowserWindow({
      title: spec.title,
      width: spec.width,
      height: spec.height,
      minWidth: 320,
      minHeight: 360,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#17161c' : '#f6f5f2',
      webPreferences: secureWebPreferences
    })
    win.on('close', (event) => {
      if (this.quitting) return
      event.preventDefault()
      win.hide()
    })
    if (!app.isPackaged) {
      win.webContents.on('before-input-event', (_event, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
      })
    }
    void loadPage(win, name)
    return win
  }
}
