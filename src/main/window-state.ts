import { windowStateSchema, type WindowStateFile } from '@shared/schemas'
import { importLegacyJson } from './settings'
import type { Store } from './storage/store'

const KEY = 'windowState'

export function loadWindowState(store: Store): WindowStateFile {
  importLegacyJson(store, 'window-state.json', KEY)
  const parsed = windowStateSchema.safeParse(store.getJson(KEY))
  return parsed.success ? parsed.data : {}
}

export function saveWindowState(store: Store, state: WindowStateFile): void {
  try {
    store.setJson(KEY, state)
  } catch (error) {
    console.error('Could not save window state', error)
  }
}
