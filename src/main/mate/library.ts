// Imports Mate Engine's animations, sounds and avatars from a Mate Engine folder on this PC into the owner's profile.
// Its licence allows personal, non-commercial use with credit to its author (Shiny) and forbids redistribution, so
// nothing of it ships with Lumi: each user imports from their own copy (ADR-075). Clips are converted once, here.
import { app } from 'electron'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MATE_ROLES, MATE_SOUNDS, type MateLibrary, type MateRole, type MateSound } from '@shared/mate'
import { convertClip, parseAnim } from './anim'
import { importModel } from '../model'

const range = (from: number, to: number, f: (i: number) => string): string[] => Array.from({ length: to - from + 1 }, (_, i) => f(from + i))
const pad = (i: number): string => String(i).padStart(2, '0')
// Paths inside "MATE ENGINE - Animations": the clips Mate Engine's own animator uses for each state.
const CLIPS: Record<MateRole, string[]> = {
  idle: ['PET_IDLE/PET_IDLE', ...range(1, 4, (i) => `UPDATE_2/PET_IDLE_UPDATE2_${pad(i)}`), ...range(2, 15, (i) => `PET_IDLE/PET_IDLE_${i}`)],
  idleMale: range(1, 9, (i) => `PET_IDLE/ME_02/HUSBANDO/HUS_IDLE${pad(i)}`),
  drag: ['PET_MISC/PET_DRAGGING'],
  dragMale: ['PET_IDLE/ME_02/HUSBANDO/HUS_DRAG'],
  // Sitting on an edge with the legs hanging down (her other sits lie down or pull the legs up).
  sit: ['PET_SITTING/ME_02/PET_SIT_01', 'PET_SITTING/ME_02/PET_SIT_02'],
  sleep: ['PET_SLEEPING/PET_SLEEPING'],
  pat: ['PET_MISC/PET_LAUGHING'],
  react: ['PET_MISC/PET_HAPPY', 'PET_MISC/PET_SHY_POINT', ...range(1, 4, (i) => `PET_POSE/PET_POSE_${i}`)],
  dance: ['PET_DANCING/PET_DANCING', ...range(3, 13, (i) => `PET_DANCING/PET_DANCING_${i}`)], // _2 is empty
  danceMale: range(1, 4, (i) => `PET_DANCING/ME_02/HUSBANDO/HUS_DANCE_${pad(i)}`)
}
// Paths inside Assets: Mate Engine's reaction sounds and its Miku voice pack.
const SOUNDS: Record<MateSound, string[]> = {
  grab: ['MATE ENGINE - VOICE PACKS/MIKU TEST v1/MIKU_GRAB_ON.mp3', 'MATE ENGINE - Sounds/ME_02/PET/Drag_v2.mp3'],
  drop: ['MATE ENGINE - VOICE PACKS/MIKU TEST v1/MIKU_GRAP_OFF.mp3', 'MATE ENGINE - Sounds/ME_02/PET/Place_v2.mp3'],
  pat: ['', '-1', '-2', '-3', '-4', '-5', '-6'].map((n) => `MATE ENGINE - Sounds/ME_02/TOUCH_HEAD${n}.wav`),
  laugh: ['MATE ENGINE - Sounds/Laugh_1.mp3', 'MATE ENGINE - Sounds/Laugh_2.mp3', 'MATE ENGINE - Sounds/Laugh_3.mp3']
}
const MODELS = ['MATE ENGINE - Avatar/Zome.vrm', 'MATE ENGINE - Avatar/DLCs/aldina.vrm', 'MATE ENGINE - Avatar/DLCs/Lazuli_VRM.vrm']
const MAX_CLIP_BYTES = 64 * 1024 * 1024
const MAX_SOUND_BYTES = 8 * 1024 * 1024
export const MATE_CREDIT = 'Animations, sounds and avatars from Mate Engine by Shiny, imported from your own copy for personal use.'

const dir = (): string => join(app.getPath('userData'), 'mate')
/** A safe file name for a clip or sound id. */
export const mateId = (path: string): string => path.split('/').pop()!.replace(/[^\w.-]/g, '_')

/** The Assets folder of a Mate Engine project or install the user picked (they may pick Assets itself). */
async function assetsOf(folder: string): Promise<string> {
  for (const candidate of [join(folder, 'Assets'), folder]) {
    const ok = await stat(join(candidate, 'MATE ENGINE - Animations')).then((s) => s.isDirectory(), () => false)
    if (ok) return candidate
  }
  throw new Error('That folder is not Mate Engine: it has no "Assets/MATE ENGINE - Animations".')
}

export interface ImportResult {
  library: MateLibrary
  clips: number
  sounds: number
  models: { id: string; name: string }[]
  skipped: string[]
}

/** Converts and copies everything into the profile, replacing an earlier import. Reports progress as it goes. */
export async function importMate(folder: string, progress: (done: number, total: number) => void = () => {}): Promise<ImportResult> {
  const assets = await assetsOf(folder)
  const out = `${dir()}.new`
  await rm(out, { recursive: true, force: true })
  await mkdir(join(out, 'clips'), { recursive: true })
  await mkdir(join(out, 'sounds'), { recursive: true })
  const library: MateLibrary = { clips: Object.fromEntries(MATE_ROLES.map((r) => [r, []])) as unknown as MateLibrary['clips'], sounds: Object.fromEntries(MATE_SOUNDS.map((s) => [s, []])) as unknown as MateLibrary['sounds'], credit: MATE_CREDIT }
  const skipped: string[] = []
  const jobs = MATE_ROLES.flatMap((role) => CLIPS[role].map((path) => ({ role, path })))
  const total = jobs.length + MODELS.length
  let done = 0
  for (const { role, path } of jobs) {
    const file = join(assets, 'MATE ENGINE - Animations', `${path}.anim`)
    try {
      if ((await stat(file)).size > MAX_CLIP_BYTES) throw new Error('too large')
      const clip = convertClip(parseAnim(await readFile(file, 'utf8')))
      const id = mateId(path)
      await writeFile(join(out, 'clips', `${id}.json`), JSON.stringify(clip))
      library.clips[role].push(id)
    } catch (error) {
      skipped.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
    progress(++done, total)
    await new Promise((r) => setImmediate(r)) // keep the app responsive between clips
  }
  for (const sound of MATE_SOUNDS) {
    for (const path of SOUNDS[sound]) {
      const file = join(assets, path)
      const ok = await stat(file).then((s) => s.isFile() && s.size <= MAX_SOUND_BYTES, () => false)
      if (!ok) continue
      const id = mateId(path)
      await copyFile(file, join(out, 'sounds', id))
      library.sounds[sound].push(id)
    }
  }
  await writeFile(join(out, 'library.json'), JSON.stringify(library))
  await rm(dir(), { recursive: true, force: true })
  await rename(out, dir())
  // Its avatars join the user's own models (each VRM's own licence allows anyone to use it; none may be redistributed).
  const models: { id: string; name: string }[] = []
  for (const path of MODELS) {
    try {
      const model = await importModel(join(assets, path))
      models.push({ id: model.id, name: model.name })
    } catch (error) {
      skipped.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
    progress(++done, total)
  }
  const clips = Object.values(library.clips).reduce((n, ids) => n + ids.length, 0)
  const sounds = Object.values(library.sounds).reduce((n, ids) => n + ids.length, 0)
  return { library, clips, sounds, models, skipped }
}

export async function readLibrary(): Promise<MateLibrary | null> {
  try {
    return JSON.parse(await readFile(join(dir(), 'library.json'), 'utf8')) as MateLibrary
  } catch {
    return null
  }
}

/** A converted clip as JSON text (MateClip). The id must come from the library. */
export const readClip = (id: string): Promise<string> => readFile(join(dir(), 'clips', `${mateId(id)}.json`), 'utf8')
export const readSound = async (id: string): Promise<Uint8Array> => new Uint8Array(await readFile(join(dir(), 'sounds', mateId(id))))
export const removeMate = (): Promise<void> => rm(dir(), { recursive: true, force: true })

/** Where Mate Engine is likely to be: next to Lumi's project, in Downloads or Documents. For the folder picker. */
export async function guessMateFolder(): Promise<string | undefined> {
  const places = [join(app.getPath('documents'), 'Projects', 'Desktop Assistant'), app.getPath('downloads'), app.getPath('documents')]
  for (const place of places) {
    const names = await readdir(place).catch(() => [] as string[])
    const hit = names.find((n) => /^mate.?engine/i.test(n))
    if (hit) return join(place, hit)
  }
  return undefined
}
