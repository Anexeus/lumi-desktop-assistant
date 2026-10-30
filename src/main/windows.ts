import { appIcon } from './icon'
import { app, BrowserWindow, screen, type BrowserWindowConstructorOptions } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import type { WindowName } from '@shared/ipc'
import { devServerUrl } from './env'
import { clampSize, fitToDisplays, placeBeside, scaleBounds, type Rect } from './geometry'
import { APP_HOST, APP_SCHEME } from './policy'

type Page = 'character' | 'island' | WindowName

const ISLAND = { collapsed: { width: 340, height: 44 }, expanded: { width: 480, height: 380 }, top: 10 }

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
  chat: { title: 'Chat', width: 420, height: 620 },
  settings: { title: 'Settings', width: 560, height: 680 }
}

/** Windows 11 22H2 (build 22621) and later can draw Acrylic behind a transparent window. */
export const glassSupported = process.platform === 'win32' && Number(release().split('.')[2] ?? 0) >= 22621

function loadPage(win: BrowserWindow, page: Page): Promise<void> {
  const url = devServerUrl ? `${devServerUrl}/${page}.html` : `${APP_SCHEME}://${APP_HOST}/${page}.html`
  return win.loadURL(url)
}

function workAreas(): { all: Rect[]; primary: Rect } {
  return { all: screen.getAllDisplays().map((d) => d.workArea), primary: screen.getPrimaryDisplay().workArea }
}

export class WindowManager {
  readonly character: BrowserWindow
  readonly island: BrowserWindow
  private islandExpanded = false
  private readonly panels = new Map<WindowName, BrowserWindow>()
  private drag: { mouseX: number; mouseY: number; bounds: Rect } | undefined
  private quitting = false

  constructor(
    saved: Rect | undefined,
    alwaysOnTop: boolean,
    private readonly onCharacterBoundsSettled: (bounds: Rect) => void,
    onCharacterCloseRequested: () => void,
    private readonly onIslandCollapsed: () => void
  ) {
    const { all, primary } = workAreas()
    this.character = new BrowserWindow({
      icon: appIcon(),
      ...fitToDisplays(saved, all, primary),
      title: 'Lumi',
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
      // She speaks replies on her own, without a click first.
      webPreferences: { ...secureWebPreferences, autoplayPolicy: 'no-user-gesture-required' }
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

    this.island = new BrowserWindow({
      icon: appIcon(),
      ...this.islandBounds(false),
      title: 'Lumi — Island',
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      useContentSize: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: secureWebPreferences
    })
    this.island.setAlwaysOnTop(true, 'floating')
    this.island.on('close', (event) => {
      if (!this.quitting) event.preventDefault()
    })
    // Clicking anywhere else folds the island back into its pill.
    this.island.on('blur', () => this.islandExpanded && this.setIslandExpanded(false))
    void loadPage(this.island, 'island')
  }

  /** Top-centre of the primary display's work area. */
  private islandBounds(expanded: boolean): Rect {
    const area = screen.getPrimaryDisplay().workArea
    const size = expanded ? ISLAND.expanded : ISLAND.collapsed
    return { x: Math.round(area.x + (area.width - size.width) / 2), y: area.y + ISLAND.top, ...size }
  }

  setIslandVisible(visible: boolean): void {
    if (!visible) {
      this.islandExpanded = false
      this.island.hide()
      return
    }
    this.island.setContentBounds(this.islandBounds(this.islandExpanded))
    this.island.showInactive()
  }

  setIslandExpanded(expanded: boolean): void {
    if (expanded === this.islandExpanded) return
    this.islandExpanded = expanded
    this.island.setContentBounds(this.islandBounds(expanded))
    if (expanded) {
      this.island.show()
      this.island.focus()
    } else {
      this.island.showInactive()
      this.onIslandCollapsed()
    }
  }

  isIslandExpanded(): boolean {
    return this.islandExpanded
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

  private scaleBase: Rect | undefined

  resizeCharacter(width: number, height: number): void {
    const { x, y } = this.characterBounds()
    this.character.setContentBounds({ x, y, ...clampSize(width, height) })
  }

  /** Mouse-wheel / keyboard resize: proportional, feet stay put. */
  scaleCharacter(factor: number): void {
    // Exact (unrounded) bounds across one wheel gesture, so many small steps don't drift her off her feet.
    this.scaleBase = scaleBounds(this.scaleBase ?? this.characterBounds(), factor)
    const { x, y, width, height } = this.scaleBase
    this.character.setContentBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) })
  }

  /** Pulls the character back onto a display if needed and reports the final bounds. */
  settleCharacter(): void {
    this.scaleBase = undefined
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

  /** True for the given panel's own page (used for per-window permissions). */
  isPanel(contents: Electron.WebContents, name: WindowName): boolean {
    const win = this.panels.get(name)
    return !!win && !win.isDestroyed() && win.webContents === contents
  }

  allWindows(): BrowserWindow[] {
    return [this.character, this.island, ...this.panels.values()].filter((w) => !w.isDestroyed())
  }

  private createPanel(name: WindowName): BrowserWindow {
    const spec = panelSpecs[name]
    // Frosted glass: a frameless window with the OS Acrylic material behind a clear page, which draws its
    // own title bar (native title buttons turn Acrylic off). Not `transparent` and resizable on purpose:
    // that keeps Windows 11's rounded corners and shadow, and a non-resizable frameless window loses Acrylic.
    const win = new BrowserWindow({
      icon: appIcon(),
      title: spec.title,
      width: spec.width,
      height: spec.height,
      minWidth: 360,
      minHeight: 420,
      show: false,
      frame: false,
      backgroundColor: '#00000000',
      ...(glassSupported ? { backgroundMaterial: 'acrylic' as const } : {}),
      roundedCorners: true,
      maximizable: false,
      fullscreenable: false,
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
