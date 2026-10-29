import { app } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { windowStateSchema, type WindowStateFile } from '@shared/schemas'

// Small JSON file in userData until SQLite arrives in Milestone 5.
const file = (): string => join(app.getPath('userData'), 'window-state.json')

export function loadWindowState(): WindowStateFile {
  try {
    const parsed = windowStateSchema.safeParse(JSON.parse(readFileSync(file(), 'utf8')))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

export function saveWindowState(state: WindowStateFile): void {
  const tmp = `${file()}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(state, null, 2))
    renameSync(tmp, file())
  } catch (error) {
    console.error('Could not save window state', error)
  }
}
