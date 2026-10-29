import { app } from 'electron'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MAX_MODEL_BYTES, readVrmMeta, type VrmMeta } from './vrm-meta'

// The user's model is copied into userData so the app never reads from (or holds a handle on)
// wherever they picked it from. The original file is never modified.
const dir = (): string => join(app.getPath('userData'), 'models')
const customPath = (): string => join(dir(), 'custom.vrm')

/** Bundled default (src/renderer/public/models). Credit is required by its license. */
export const DEFAULT_MODEL: VrmMeta = {
  name: 'Seed-san',
  authors: ['VirtualCast, Inc.'],
  licenseUrl: 'https://vrm.dev/licenses/1.0/',
  specVersion: '1.0'
}

/** The saved custom model's bytes and metadata, or null if there is none or it is unusable. */
export async function readCustomModel(): Promise<{ bytes: Buffer; meta: VrmMeta } | null> {
  try {
    const bytes = await readFile(customPath())
    return { bytes, meta: readVrmMeta(bytes) }
  } catch {
    return null
  }
}

/** Validates a user-picked file and stores a copy. Throws with a user-facing message. */
export async function importModel(file: string): Promise<VrmMeta> {
  const info = await stat(file)
  if (!info.isFile()) throw new Error('That is not a file.')
  if (info.size > MAX_MODEL_BYTES) throw new Error('The file is larger than 256 MB.')
  const bytes = await readFile(file)
  const meta = readVrmMeta(bytes)
  await mkdir(dir(), { recursive: true })
  const tmp = `${customPath()}.tmp`
  await writeFile(tmp, bytes)
  await rename(tmp, customPath())
  return meta
}

export async function removeCustomModel(): Promise<void> {
  await rm(customPath(), { force: true })
}
