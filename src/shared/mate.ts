// Mate Engine material imported from the user's own copy (personal use, credited; never shipped with Lumi).

/** What each converted clip is for. The "Male" sets play for characters with a male voice. */
export const MATE_ROLES = ['idle', 'idleMale', 'drag', 'dragMale', 'sit', 'sleep', 'pat', 'react', 'dance', 'danceMale'] as const
export type MateRole = (typeof MATE_ROLES)[number]
export const MATE_SOUNDS = ['grab', 'drop', 'pat', 'laugh'] as const
export type MateSound = (typeof MATE_SOUNDS)[number]

/** Clip and sound ids per role, as imported. */
export interface MateLibrary {
  clips: Record<MateRole, string[]>
  sounds: Record<MateSound, string[]>
  credit: string
}

/** A converted clip: rotations of a VRM's normalized bones and the hips' motion, sampled at `fps`. */
export interface MateClip {
  name: string
  fps: number
  frames: number
  loop: boolean
  /** VRM humanoid bone name → [x, y, z, w] per frame, the bone's local rotation. */
  bones: Record<string, number[]>
  /**
   * Hips position [x, y, z] per frame, in units where the T-pose hips are at y = MATE_HIPS_HEIGHT (scale by the model's
   * own hips height / MATE_HIPS_HEIGHT). Centred: the clip's mean sideways and forward position is 0, so it plays in place.
   */
  hips: number[]
  /** Hips rotation [x, y, z, w] per frame. */
  hipsRotation: number[]
}

/** The reference skeleton's T-pose hips height, in the clips' units (its T-pose centre of mass is at 1). */
export const MATE_HIPS_HEIGHT = 0.877
