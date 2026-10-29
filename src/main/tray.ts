import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron'
import type { AppState } from '@shared/ipc'

export interface TrayActions {
  toggleCharacter(): void
  setAlwaysOnTop(value: boolean): void
  openChat(): void
  openSettings(): void
  quit(): void
}

/** 32×32 BGRA bitmap: a violet disc with two eyes, drawn in code so no asset is needed yet. */
function icon(): Electron.NativeImage {
  const size = 32
  const buf = Buffer.alloc(size * size * 4)
  const inside = (x: number, y: number, cx: number, cy: number, r: number): boolean =>
    (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const px = x + 0.5
      const py = y + 0.5
      if (inside(px, py, 11.5, 14, 2.6) || inside(px, py, 20.5, 14, 2.6)) buf.set([255, 255, 255, 255], i)
      else if (inside(px, py, 16, 16, 14.5)) buf.set([240, 108, 124, 255], i) // B, G, R, A = #7C6CF0
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2 })
}

export function menuTemplate(state: AppState, actions: TrayActions): MenuItemConstructorOptions[] {
  return [
    { label: state.characterVisible ? 'Hide character' : 'Show character', click: actions.toggleCharacter },
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: state.alwaysOnTop,
      click: (item) => actions.setAlwaysOnTop(item.checked)
    },
    { type: 'separator' },
    { label: 'Open chat', click: actions.openChat },
    { label: 'Settings…', click: actions.openSettings },
    { type: 'separator' },
    { label: `Quit ${state.assistantName}`, click: actions.quit }
  ]
}

export function createTray(actions: TrayActions): { update(state: AppState): void } {
  const tray = new Tray(icon())
  tray.on('click', actions.toggleCharacter)
  return {
    update(state) {
      const hint = state.shortcut.registered ? ` (${state.shortcut.accelerator} to show/hide)` : ''
      tray.setToolTip(`${state.assistantName}${hint}`)
      tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(state, actions)))
    }
  }
}
