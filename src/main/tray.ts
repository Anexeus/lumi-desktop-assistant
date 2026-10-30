import { Tray } from 'electron'
import { appIcon } from './icon'
import type { AppState } from '@shared/ipc'
import { formatAccelerator } from '@shared/shortcuts'

export interface TrayActions {
  toggleCharacter(): void
  setAlwaysOnTop(value: boolean): void
  openChat(): void
  openSettings(): void
  stop(): void
  quit(): void
  /** Opens Lumi's own menu at the pointer. */
  showMenu(): void
}

export function createTray(actions: TrayActions): { update(state: AppState): void } {
  const tray = new Tray(appIcon().resize({ width: 32, height: 32, quality: 'best' }))
  tray.on('click', actions.toggleCharacter)
  tray.on('right-click', actions.showMenu)
  return {
    update(state) {
      const hint = state.shortcuts.character.registered ? ` (${formatAccelerator(state.shortcuts.character.accelerator, '+')} to show/hide)` : ''
      tray.setToolTip(`${state.assistantName}${hint}`)
    }
  }
}
