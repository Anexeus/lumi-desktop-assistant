import { app } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { MAX_MODEL_BYTES, readVrmMeta, UNNAMED, type VrmMeta } from './vrm-meta'

// The user's own models are copied into userData/models/mine, named by their content (the same file is kept once), so
// the app never reads from (or holds a handle on) wherever they picked them from. The originals are never modified.
const dir = (): string => join(app.getPath('userData'), 'models', 'mine')
const path = (id: string, ext: 'vrm' | 'name'): string => join(dir(), `${id.slice('mine:'.length)}.${ext}`)

export interface MyModel extends VrmMeta {
  /** 'mine:' and the first 12 hex digits of the file's SHA-256 (MY_MODEL_ID). */
  id: string
}

/** Only the header and the JSON chunk: enough for the metadata (a model can be 40 MB). */
async function readMeta(file: string): Promise<VrmMeta> {
  const handle = await open(file, 'r')
  try {
    const head = Buffer.alloc(20)
    await handle.read(head, 0, 20, 0)
    const start = Buffer.alloc(20 + Math.min(head.readUInt32LE(12), 64 * 1024 * 1024))
    await handle.read(start, 0, start.byteLength, 0)
    return readVrmMeta(start)
  } finally {
    await handle.close()
  }
}

/** The user's models, oldest file name first; files that are no longer usable VRMs are left out. */
export async function listMyModels(): Promise<MyModel[]> {
  const files = (await readdir(dir()).catch(() => [] as string[])).filter((f) => /^[0-9a-f]{12}\.vrm$/.test(f)).sort()
  const models: MyModel[] = []
  for (const f of files) {
    const id = `mine:${f.slice(0, 12)}`
    try {
      const meta = await readMeta(join(dir(), f))
      // A model without a name or author of its own goes by the name of the file it came from (saved at import).
      // A name saved next to the model wins over its title (one without a title gets its file name; a Japanese title
      // can be given an English name).
      const saved = (await readFile(path(id, 'name'), 'utf8').catch(() => '')).trim().slice(0, 80)
      models.push({ ...meta, id, name: saved || meta.name })
    } catch {
      // damaged or replaced: not listed
    }
  }
  return models
}

export const readMyModel = (id: string): Promise<Buffer> => readFile(path(id, 'vrm'))

/** Validates a user-picked file and keeps a copy. Throws with a user-facing message. */
export async function importModel(file: string, fallbackName = basename(file).replace(/\.vrm$/i, '')): Promise<MyModel> {
  const info = await stat(file)
  if (!info.isFile()) throw new Error('That is not a file.')
  if (info.size > MAX_MODEL_BYTES) throw new Error('The file is larger than 256 MB.')
  const bytes = await readFile(file)
  const meta = readVrmMeta(bytes)
  const id = `mine:${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`
  await mkdir(dir(), { recursive: true })
  await writeFile(`${path(id, 'vrm')}.tmp`, bytes)
  await rename(`${path(id, 'vrm')}.tmp`, path(id, 'vrm'))
  const name = meta.name === UNNAMED ? fallbackName.trim().slice(0, 80) : ''
  if (name) await writeFile(path(id, 'name'), name)
  return { ...meta, id, name: name || meta.name }
}

export async function removeMyModel(id: string): Promise<void> {
  await rm(path(id, 'vrm'), { force: true })
  await rm(path(id, 'name'), { force: true })
}

/** Lumi used to keep one model, models/custom.vrm; it joins the list. Returns its id, or null when there was none. */
export async function migrateCustomModel(): Promise<string | null> {
  const legacy = join(app.getPath('userData'), 'models', 'custom.vrm')
  try {
    const { id } = await importModel(legacy, '')
    await rm(legacy, { force: true })
    return id
  } catch {
    return null
  }
}
