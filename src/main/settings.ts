import { app, safeStorage } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { settingsFileSchema, type SettingsFile } from '@shared/schemas'
import type { AiSettings } from '@shared/ipc'

// shortcut: JSON files in userData, until Milestone 5 moves settings into SQLite.

export const DEFAULT_AI: AiSettings = { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3:4b' }

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

export interface Settings {
  ai: AiSettings
  islandVisible: boolean
}

export function loadSettings(): Settings {
  const parsed = settingsFileSchema.safeParse(readJson('settings.json'))
  const file: SettingsFile = parsed.success ? parsed.data : {}
  return { ai: file.ai ?? DEFAULT_AI, islandVisible: file.islandVisible ?? true }
}

export function saveSettings(settings: Settings): void {
  writeJson('settings.json', settings)
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

export function setSecret(name: string, value: string | null): void {
  const secrets = readSecrets()
  if (value === null) delete secrets[name]
  else {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is not available on this system.')
    secrets[name] = safeStorage.encryptString(value).toString('base64')
  }
  writeJson(SECRETS, secrets)
}

export function getSecret(name: string): string | undefined {
  const value = readSecrets()[name]
  if (!value) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    return undefined // e.g. copied from another machine or user: unreadable by design
  }
}
