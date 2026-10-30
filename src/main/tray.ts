import { Menu, Tray, type MenuItemConstructorOptions } from 'electron'
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
    { label: `Stop what ${state.assistantName} is doing (${formatAccelerator(state.shortcuts.stop.accelerator, '+')})`, click: actions.stop },
    { type: 'separator' },
    { label: `Quit ${state.assistantName}`, click: actions.quit }
  ]
}

export function createTray(actions: TrayActions): { update(state: AppState): void } {
  const tray = new Tray(appIcon().resize({ width: 32, height: 32, quality: 'best' }))
  tray.on('click', actions.toggleCharacter)
  return {
    update(state) {
      const hint = state.shortcuts.character.registered ? ` (${formatAccelerator(state.shortcuts.character.accelerator, '+')} to show/hide)` : ''
      tray.setToolTip(`${state.assistantName}${hint}`)
      tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(state, actions)))
    }
  }
}
