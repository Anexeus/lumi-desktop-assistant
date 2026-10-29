import { app, safeStorage } from 'electron'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { settingsFileSchema, type SettingsFile } from '@shared/schemas'
import type { AiSettings, VoiceSettings } from '@shared/ipc'
import type { Store } from './storage/store'

export const DEFAULT_AI: AiSettings = { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3:4b' }
export const DEFAULT_VOICE: VoiceSettings = { output: 'local', input: true, model: 'lfm3-audio', voice: '', speed: 1, micId: '' }

const path = (name: string): string => join(app.getPath('userData'), name)

function readJson(name: string): unknown {
  try {
    return JSON.parse(readFileSync(path(name), 'utf8'))
  } catch {
    return undefined
  }
}

function writeJson(name: string, value: unknown): void {
  const tmp = `${path(name)}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, path(name))
}

/** One-time import of a pre-SQLite JSON file (Milestones 1–3) into the store, then removes the file. */
export function importLegacyJson(store: Store, file: string, key: string): void {
  if (store.getJson(key) !== undefined) return
  const raw = readJson(file)
  if (raw === undefined) return
  store.setJson(key, raw)
  rmSync(path(file), { force: true })
}

export interface Settings {
  ai: AiSettings
  islandVisible: boolean
  historyEnabled: boolean
  voice: VoiceSettings
}

export function loadSettings(store: Store): Settings {
  importLegacyJson(store, 'settings.json', 'settings')
  const parsed = settingsFileSchema.safeParse(store.getJson('settings'))
  const file: SettingsFile = parsed.success ? parsed.data : {}
  return {
    ai: file.ai ?? DEFAULT_AI,
    islandVisible: file.islandVisible ?? true,
    historyEnabled: file.historyEnabled ?? true,
    voice: file.voice ?? DEFAULT_VOICE
  }
}

export function saveSettings(store: Store, settings: Settings): void {
  store.setJson('settings', settings)
}

export function isLocalUrl(url: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
}

// API keys: encrypted with the OS keystore (DPAPI on Windows). Never logged, never sent to a renderer.
const SECRETS = 'secrets.json'

function readSecrets(): Record<string, string> {
  const raw = readJson(SECRETS)
  return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {}
}

export function hasSecret(name: string): boolean {
  return !!readSecrets()[name]
}

export async function setSecret(name: string, value: string | null): Promise<void> {
  const secrets = readSecrets()
  if (value === null) delete secrets[name]
  else {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('Secure storage is not available on this system.')
    secrets[name] = (await safeStorage.encryptStringAsync(value)).toString('base64')
  }
  writeJson(SECRETS, secrets)
}

export async function getSecret(name: string): Promise<string | undefined> {
  const value = readSecrets()[name]
  if (!value) return undefined
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(value, 'base64'))
    if (shouldReEncrypt) await setSecret(name, result) // the OS rotated the key
    return result
  } catch {
    return undefined // e.g. copied from another machine or user: unreadable by design
  }
}
