// Reads Unity's text .anim files (YAML) far enough to sample their humanoid muscle curves, and converts a clip into
// per-bone quaternion samples for a VRM's normalized bones. Pure: no Electron.
import type { MateClip } from '@shared/mate'
import { centreOfMass, fromUnityPosition, fromUnityRotation, hipsRotation, MUSCLE_NAMES, musclePose, qapply, qmul, qrot, type Quat, type Vec3 } from './muscles'

interface Key {
  t: number
  v: number
  in: number
  out: number
}

export interface UnityClip {
  name: string
  duration: number
  loop: boolean
  curves: Map<string, Key[]>
}

const num = (s: string): number => (s === 'Infinity' ? Infinity : s === '-Infinity' ? -Infinity : Number(s))

/** Throws when the text is not a Unity animation clip. Only `m_FloatCurves` (where humanoid muscles live) is read. */
export function parseAnim(text: string): UnityClip {
  if (!/^AnimationClip:/m.test(text)) throw new Error('Not a Unity animation clip.')
  const name = /^\s+m_Name: (.*)$/m.exec(text)?.[1]?.trim() ?? 'clip'
  const start = text.indexOf('\n  m_FloatCurves:')
  const end = start < 0 ? -1 : text.indexOf('\n  m_', start + 5)
  const block = start < 0 ? '' : text.slice(start, end < 0 ? undefined : end)
  const curves = new Map<string, Key[]>()
  for (const entry of block.split('\n  - serializedVersion: 2\n').slice(1)) {
    const attribute = /\n {4}attribute: (.+)/.exec(entry)?.[1]?.trim()
    if (!attribute) continue
    const keys: Key[] = []
    const re = /time: (\S+)\s+value: (\S+)\s+inSlope: (\S+)\s+outSlope: (\S+)/g
    for (let m = re.exec(entry); m; m = re.exec(entry)) keys.push({ t: num(m[1]!), v: num(m[2]!), in: num(m[3]!), out: num(m[4]!) })
    if (keys.length) curves.set(attribute, keys)
  }
  const stop = Number(/m_StopTime: (\S+)/.exec(text)?.[1] ?? NaN)
  const lastKey = Math.max(0, ...[...curves.values()].map((k) => k.at(-1)!.t))
  return { name, duration: Number.isFinite(stop) && stop > 0 ? stop : lastKey, loop: /m_LoopTime: 1/.test(text), curves }
}

/** Unity's curve evaluation: cubic Hermite between keys with their tangents; an infinite tangent holds the value. */
export function sampleCurve(keys: Key[], t: number, hint = { i: 0 }): number {
  if (t <= keys[0]!.t) return keys[0]!.v
  const last = keys.at(-1)!
  if (t >= last.t) return last.v
  let i = keys[hint.i + 1] && keys[hint.i]!.t <= t ? hint.i : 0
  while (keys[i + 1]!.t <= t) i++
  hint.i = i
  const a = keys[i]!
  const b = keys[i + 1]!
  const dt = b.t - a.t
  if (!Number.isFinite(a.out) || !Number.isFinite(b.in) || dt <= 0) return a.v
  const s = (t - a.t) / dt
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * a.v + (s3 - 2 * s2 + s) * dt * a.out + (-2 * s3 + 3 * s2) * b.v + (s3 - s2) * dt * b.in
}

const round = (v: number): number => Math.round(v * 10000) / 10000

/** Samples a muscle clip into normalized-bone rotations. Throws when the clip has no humanoid muscle curves. */
export function convertClip(clip: UnityClip, fps = 30): MateClip {
  const muscles = MUSCLE_NAMES.filter((n) => clip.curves.has(n))
  if (muscles.length < 10) throw new Error(`"${clip.name}" is not a humanoid body animation.`)
  const frames = Math.max(1, Math.round(clip.duration * fps) + 1)
  const hints = new Map<string, { i: number }>()
  const at = (attribute: string, t: number, fallback: number): number => {
    const keys = clip.curves.get(attribute)
    if (!keys) return fallback
    if (!hints.has(attribute)) hints.set(attribute, { i: 0 })
    return sampleCurve(keys, t, hints.get(attribute))
  }
  const out: MateClip = { name: clip.name, fps, frames, loop: clip.loop, bones: {}, hips: [], hipsRotation: [] }
  const hips: Vec3[] = []
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / fps)
    const values: Record<string, number> = {}
    for (const n of muscles) values[n] = at(n, t, 0)
    const pose = musclePose(values)
    for (const [bone, q] of Object.entries(pose)) (out.bones[bone] ??= []).push(...q.map(round))
    // RootT is where the centre of mass is; the hips sit below it by the pose's own offset.
    const body: Quat = fromUnityRotation([at('RootQ.x', t, 0), at('RootQ.y', t, 0), at('RootQ.z', t, 0), at('RootQ.w', t, 1)])
    const rotation = hipsRotation(body, pose)
    const com = fromUnityPosition([at('RootT.x', t, 0), at('RootT.y', t, 1), at('RootT.z', t, 0)])
    const offset = centreOfMass(rotation, pose)
    hips.push([com[0] - offset[0], com[1] - offset[1], com[2] - offset[2]])
    out.hipsRotation.push(...rotation.map(round))
  }
  // Played in place, facing the viewer: take out the clip's mean position and its mean turn (some of her sits and
  // reactions face 40–90° to the side, which on a desktop just shows her profile).
  const mean = (i: 0 | 2): number => hips.reduce((s, p) => s + p[i], 0) / hips.length
  const [mx, mz] = [mean(0), mean(2)]
  const facing: Vec3 = [0, 0, 0]
  for (let f = 0; f < frames; f++) {
    const forward = qapply(out.hipsRotation.slice(f * 4, f * 4 + 4) as Quat, [0, 0, 1])
    facing[0] += forward[0]
    facing[2] += forward[2]
  }
  const turn = qrot([0, -Math.atan2(facing[0], facing[2]), 0])
  for (let f = 0; f < frames; f++) {
    const q = qmul(turn, out.hipsRotation.slice(f * 4, f * 4 + 4) as Quat)
    for (let i = 0; i < 4; i++) out.hipsRotation[f * 4 + i] = round(q[i]!)
    const p = qapply(turn, [hips[f]![0] - mx, hips[f]![1], hips[f]![2] - mz])
    out.hips.push(round(p[0]), round(p[1]), round(p[2]))
  }
  return out
}
