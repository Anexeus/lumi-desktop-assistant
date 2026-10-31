import { appIcon } from './icon'
import { app, BrowserWindow, screen, type BrowserWindowConstructorOptions } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import type { Perch } from '@shared/character'
import type { IslandStyle, WindowName } from '@shared/ipc'
import { devServerUrl } from './env'
import { canSit, clampSize, fitToDisplays, peekPlacement, placeBeside, scaleBounds, seatedBounds, seatPlacement, taskbarSeat, type Frame, type Rect } from './geometry'
import { APP_HOST, APP_SCHEME } from './policy'

type Page = 'character' | 'island' | 'menu' | WindowName

// Electron puts 'floating' to 'status' windows below the Windows taskbar and 'pop-up-menu' and higher above it: she
// sits on the taskbar with her legs in front of it.
const CHARACTER_LEVEL = 'pop-up-menu'
const ISLAND = { collapsed: { width: 300, height: 36 }, expanded: { width: 440, height: 340 }, top: 10 }
// The menu window, and where the menu's corner sits inside it (the rest is room for its shadow; see menu.css).
const MENU = { width: 284, height: 334, cornerX: 10, cornerY: 8 }

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

/** Reads other apps' window positions (desktop helper), so the character can sit on them. */
export interface PerchDeps {
  frames(): Promise<Frame[]>
  /** null when the window is gone, minimised or hidden. */
  frame(handle: number): Promise<Frame | null>
  /** Starts the helper early, so a drop isn't kept waiting for it. */
  warm(): void
  onPerch(perch: Perch): void
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3
const easeIn = (t: number): number => t * t

export class WindowManager {
  readonly character: BrowserWindow
  private islandWin: BrowserWindow
  private menuWin: BrowserWindow | undefined
  private islandExpanded = false
  private readonly panels = new Map<WindowName, BrowserWindow>()
  private drag: { mouseX: number; mouseY: number; bounds: Rect } | undefined
  private quitting = false
  private perch: Perch = 'none'
  private seat: Frame | undefined // the window she sits on
  private seatTimer: NodeJS.Timeout | undefined
  private anim: NodeJS.Timeout | undefined
  private perchToken = 0 // bumped by every drag, so a late window lookup can't seat her after she was picked up

  constructor(
    saved: Rect | undefined,
    alwaysOnTop: boolean,
    private readonly onCharacterBoundsSettled: (bounds: Rect) => void,
    onCharacterCloseRequested: () => void,
    private readonly onIslandCollapsed: () => void,
    private readonly perchDeps?: PerchDeps,
    private islandStyle: IslandStyle = 'pill'
  ) {
    const { all, primary } = workAreas()
    const initial = fitToDisplays(saved, all, primary)
    this.character = new BrowserWindow({
      icon: appIcon(),
      ...initial,
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
    // At 125 % the window is created a few pixels wider than asked, and that size was saved: she grew a little on every
    // launch. Setting the content bounds again gives the exact size.
    this.character.setContentBounds(initial)
    this.character.setAlwaysOnTop(alwaysOnTop, CHARACTER_LEVEL)
    // Empty space clicks through; the renderer turns this off while the cursor is over the body.
    this.character.setIgnoreMouseEvents(true, { forward: true })
    this.character.on('close', (event) => {
      if (this.quitting) return
      event.preventDefault()
      onCharacterCloseRequested()
    })
    void loadPage(this.character, 'character')

    this.islandWin = this.createIsland()
  }

  get island(): BrowserWindow {
    return this.islandWin
  }

  /**
   * Pill: a transparent window, so CSS draws truly curved sides (no blur behind it). Glass: the OS Acrylic material,
   * blurred like the taskbar, with Windows 11's small rounded corners; Windows ignores a custom shape for Acrylic
   * windows (probed: setShape, SetWindowRgn and accent policies). Older Windows always gets the pill.
   */
  private createIsland(): BrowserWindow {
    const glass = glassSupported && this.islandStyle === 'glass'
    const win = new BrowserWindow({
      icon: appIcon(),
      ...this.islandBounds(false),
      title: 'Lumi — Island',
      show: false,
      frame: false,
      backgroundColor: '#00000000',
      ...(glass ? { backgroundMaterial: 'acrylic' as const, roundedCorners: true } : { transparent: true, hasShadow: false }),
      useContentSize: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: secureWebPreferences
    })
    win.setAlwaysOnTop(true, 'floating')
    win.on('close', (event) => {
      if (!this.quitting) event.preventDefault()
    })
    // Clicking anywhere else folds the island back into its pill.
    win.on('blur', () => this.islandExpanded && this.setIslandExpanded(false))
    void loadPage(win, 'island')
    return win
  }

  setIslandStyle(style: IslandStyle, visible: boolean): void {
    if (style === this.islandStyle) return
    this.islandStyle = style
    const old = this.islandWin
    this.islandExpanded = false
    this.islandWin = this.createIsland()
    if (visible) this.islandWin.once('ready-to-show', () => this.setIslandVisible(true))
    old.destroy()
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

  /** Opens the menu with its corner at `at` (screen DIPs), flipped left or up where it would leave the screen. */
  showMenu(at: { x: number; y: number }): void {
    if (!this.menuWin || this.menuWin.isDestroyed()) this.menuWin = this.createMenu()
    const win = this.menuWin
    const area = screen.getDisplayNearestPoint(at).workArea
    const w = MENU.width - 2 * MENU.cornerX
    const h = MENU.height - MENU.cornerY - 12
    const left = at.x + w > area.x + area.width ? at.x - w : at.x
    const top = at.y + h > area.y + area.height ? at.y - h : at.y
    win.setBounds({
      x: Math.round(Math.max(area.x, left) - MENU.cornerX),
      y: Math.round(Math.max(area.y, top) - MENU.cornerY),
      width: MENU.width,
      height: MENU.height
    })
    const open = (): void => {
      win.show()
      win.focus()
    }
    if (win.webContents.isLoading()) win.once('ready-to-show', open)
    else open()
  }

  hideMenu(): void {
    if (this.menuWin?.isVisible()) this.menuWin.hide()
  }

  isMenu(contents: Electron.WebContents): boolean {
    return !!this.menuWin && !this.menuWin.isDestroyed() && this.menuWin.webContents === contents
  }

  private createMenu(): BrowserWindow {
    const win = new BrowserWindow({
      icon: appIcon(),
      width: MENU.width,
      height: MENU.height,
      title: 'Lumi — Menu',
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: secureWebPreferences
    })
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.on('blur', () => win.hide()) // a click anywhere else closes it, like a native menu
    win.on('close', (event) => {
      if (this.quitting) return
      event.preventDefault()
      win.hide()
    })
    void loadPage(win, 'menu')
    return win
  }

  markQuitting(): void {
    this.quitting = true
  }

  setCharacterVisible(visible: boolean): void {
    if (visible) return this.character.showInactive()
    this.stopPerch()
    this.character.hide()
  }

  setAlwaysOnTop(value: boolean): void {
    this.character.setAlwaysOnTop(value, CHARACTER_LEVEL)
  }

  setIgnoreMouse(ignore: boolean): void {
    this.character.setIgnoreMouseEvents(ignore, { forward: true })
  }

  characterBounds(): Rect {
    return this.character.getContentBounds()
  }

  dragStart(screenX: number, screenY: number): void {
    this.stopPerch()
    this.drag = { mouseX: screenX, mouseY: screenY, bounds: this.characterBounds() }
    this.perchDeps?.warm()
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
    if (this.perch === 'none') void this.trySit()
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

  /**
   * After a drag, resize or display change: keeps her seated (on the same edge at her new size), peeks in from a
   * screen edge she is next to, or pulls her back onto a display if needed. Reports the final bounds.
   */
  settleCharacter(): void {
    this.scaleBase = undefined
    const b = this.characterBounds()
    if (this.seat?.handle === 0) this.seat = taskbarSeat(screen.getDisplayMatching(b).workArea) // the taskbar may have moved
    if (this.seat) return this.place(seatedBounds(b, this.seat.rect.y), 'sit')
    const display = screen.getDisplayMatching(b)
    const others = screen.getAllDisplays().filter((d) => d.id !== display.id).map((d) => d.bounds)
    const peek = peekPlacement(b, display.bounds, others)
    if (peek) return this.place(peek.bounds, peek.side, true)
    const { all, primary } = workAreas()
    this.place(fitToDisplays(b, all, primary), 'none')
  }

  private setPerch(perch: Perch): void {
    if (perch === this.perch) return
    this.perch = perch
    this.perchDeps?.onPerch(perch)
  }

  /** Moves her (eased when `animate`), then reports the perch and the bounds to save. */
  private place(to: Rect, perch: Perch, animate = false): void {
    this.setPerch(perch)
    if (!animate) {
      this.character.setContentBounds(to)
      return this.onCharacterBoundsSettled(to)
    }
    this.animate(to, 260, easeOut, () => this.onCharacterBoundsSettled(to))
  }

  private animate(to: Rect, ms: number, ease: (t: number) => number, done: () => void): void {
    clearInterval(this.anim)
    const from = this.characterBounds()
    const start = Date.now()
    this.anim = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / ms)
      const k = ease(t)
      this.character.setContentBounds({ x: Math.round(from.x + (to.x - from.x) * k), y: Math.round(from.y + (to.y - from.y) * k), width: to.width, height: to.height })
      if (t < 1) return
      clearInterval(this.anim)
      this.anim = undefined
      done()
    }, 16)
  }

  /** Picked up (or hidden): stop sitting, peeking or falling. */
  private stopPerch(): void {
    this.perchToken++
    clearInterval(this.anim)
    this.anim = undefined
    clearTimeout(this.seatTimer)
    this.seat = undefined
    this.setPerch('none')
  }

  /** After a drop: sit on the window whose top edge is under her, then follow it. */
  private async trySit(): Promise<void> {
    if (!this.perchDeps) return
    const token = this.perchToken
    let frames: Frame[] = []
    try {
      frames = await this.perchDeps.frames()
    } catch {
      // no helper: she can still sit on the taskbar
    }
    if (token !== this.perchToken || this.drag) return
    const b = this.characterBounds()
    const seat = seatPlacement(b, frames, screen.getDisplayMatching(b).workArea)
    if (!seat) return
    this.seat = seat.frame
    this.place(seat.bounds, 'sit', true)
    if (seat.frame.handle !== 0) this.followSeat(token)
    else this.keepAboveTaskbar(token) // the taskbar doesn't move, but it comes back on top whenever it is clicked
  }

  /** Polls the seat window: quickly while it moves, slowly while it doesn't. She falls when it goes away. */
  private followSeat(token: number): void {
    const poll = async (): Promise<void> => {
      const seat = this.seat
      if (!seat || token !== this.perchToken) return
      let frame: Frame | null
      try {
        frame = await this.perchDeps!.frame(seat.handle)
      } catch {
        this.seatTimer = setTimeout(() => void poll(), 1000) // the helper restarts on the next request
        return
      }
      if (token !== this.perchToken || this.drag) return
      const b = this.characterBounds()
      if (!frame || !canSit(b, frame, screen.getDisplayMatching(b).workArea)) return this.fall()
      const moved = frame.rect.x !== seat.rect.x || frame.rect.y !== seat.rect.y
      if (moved) this.character.setContentBounds({ ...seatedBounds(b, frame.rect.y), x: b.x + frame.rect.x - seat.rect.x })
      this.seat = frame
      this.seatTimer = setTimeout(() => void poll(), moved ? 30 : 300)
    }
    this.seatTimer = setTimeout(() => void poll(), 300)
  }

  /** Sitting on the taskbar: raises her above it now and again, so her legs show in front of it (Desktop Mate–style). */
  private keepAboveTaskbar(token: number): void {
    if (token !== this.perchToken) return
    // Re-asserting raises her (not over her own open menu).
    if (this.character.isAlwaysOnTop() && !this.menuWin?.isVisible()) this.character.setAlwaysOnTop(true, CHARACTER_LEVEL)
    this.seatTimer = setTimeout(() => this.keepAboveTaskbar(token), 1500)
  }

  /** Her window went away: she drops to the bottom of the screen. */
  private fall(): void {
    this.stopPerch()
    const token = this.perchToken
    const b = this.characterBounds()
    const area = screen.getDisplayMatching(b).workArea
    const floor = { ...b, y: Math.round(area.y + area.height - b.height) }
    if (floor.y <= b.y) return this.settleCharacter()
    this.setPerch('fall')
    this.animate(floor, 420, easeIn, () => {
      if (token !== this.perchToken) return
      this.setPerch('none')
      this.onCharacterBoundsSettled(floor)
    })
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
    return [this.character, this.island, ...(this.menuWin ? [this.menuWin] : []), ...this.panels.values()].filter((w) => !w.isDestroyed())
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
