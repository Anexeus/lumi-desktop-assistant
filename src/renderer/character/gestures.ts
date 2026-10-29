// Short procedural gestures, layered on top of the state pose. Pure math, so they are unit-testable.

export type Gesture = 'wave' | 'nod' | 'stretch' | 'lookAround' | 'tilt'

/** Offsets added to the rest pose, in radians (arms, head, chest) and blend weights (happy). */
export interface Offsets {
  rUpperZ: number // right upper arm: − raises it
  rLowerZ: number // right forearm: − bends it up
  lUpperZ: number // left upper arm: + raises it
  lLowerZ: number // left forearm: + bends it up
  rLowerY: number // forearm bend toward the viewer
  rTwist: number // right forearm + wrist twist: − turns the palm from facing down to facing the viewer
  lLowerY: number
  headYaw: number
  headPitch: number
  headRoll: number
  chest: number // + leans back
  happy: number
}

export const ZERO: Offsets = {
  rUpperZ: 0,
  rLowerZ: 0,
  lUpperZ: 0,
  lLowerZ: 0,
  rLowerY: 0,
  rTwist: 0,
  lLowerY: 0,
  headYaw: 0,
  headPitch: 0,
  headRoll: 0,
  chest: 0,
  happy: 0
}

export const GESTURE_SECONDS: Record<Gesture, number> = { wave: 2.2, nod: 1.1, stretch: 2.8, lookAround: 3.2, tilt: 1.8 }

/** The idle repertoire, picked at random while nothing else is happening. */
export const IDLE_GESTURES: Gesture[] = ['lookAround', 'tilt', 'stretch', 'nod', 'wave']

/** Fades a gesture in over its first 20% and out over its last 20%. */
export function envelope(p: number): number {
  const edge = Math.min(1, p / 0.2, (1 - p) / 0.2)
  const x = Math.max(0, edge)
  return x * x * (3 - 2 * x) // smoothstep
}

/** The gesture's offsets at progress p (0..1). */
export function gestureOffsets(gesture: Gesture, p: number): Offsets {
  const w = envelope(p)
  const o = { ...ZERO }
  const T = p * GESTURE_SECONDS[gesture] // seconds into the gesture
  switch (gesture) {
    case 'wave':
      o.rUpperZ = -1.45 * w // arm out and up
      o.rLowerZ = (-1.1 + Math.sin(T * 11) * 0.35) * w // forearm up, waggling
      o.rTwist = -Math.PI / 2 * w // palm to the viewer, not edge-on
      o.headRoll = 0.08 * w
      o.happy = 0.6 * w
      break
    case 'nod':
      o.headPitch = Math.sin(p * Math.PI * 4) * 0.18 * w
      o.happy = 0.25 * w
      break
    case 'stretch':
      o.rUpperZ = -1.75 * w // both arms up in a V (higher clips out of the window)
      o.lUpperZ = 1.75 * w
      o.rLowerZ = -0.4 * w
      o.lLowerZ = 0.4 * w
      o.chest = 0.12 * w
      o.headPitch = -0.18 * w
      break
    case 'lookAround':
      o.headYaw = Math.sin(p * Math.PI * 2) * 0.5 * w
      o.headPitch = -0.05 * w
      break
    case 'tilt':
      o.headRoll = 0.28 * w
      o.happy = 0.2 * w
      break
  }
  return o
}

/** Hands that move while talking: small, out-of-phase forearm swings toward the viewer. */
export function talkingOffsets(t: number, weight: number): Offsets {
  return {
    ...ZERO,
    rLowerY: (0.55 + Math.sin(t * 3.1) * 0.25) * weight,
    lLowerY: -(0.55 + Math.sin(t * 2.6 + 1.3) * 0.25) * weight,
    rUpperZ: -0.12 * weight,
    lUpperZ: 0.12 * weight
  }
}

export function addOffsets(a: Offsets, b: Offsets): Offsets {
  const out = { ...a }
  for (const k of Object.keys(out) as (keyof Offsets)[]) out[k] += b[k]
  return out
}
