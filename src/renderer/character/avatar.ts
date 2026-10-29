import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'
import { Box3, Object3D, Vector3, type Camera } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CharacterState } from '@shared/character'
import { addOffsets, gestureOffsets, GESTURE_SECONDS, IDLE_GESTURES, talkingOffsets, ZERO, type Gesture } from './gestures'

// Procedural animation for a VRM: one blended pose per state, plus additive blink, breathing,
// gaze and mouth layers. Every state writes the same parameters, so states crossfade instead
// of fighting over bones.

interface Pose {
  headPitch: number // + looks down
  headRoll: number
  lean: number // + leans toward the viewer
  hop: number
  happy: number
  sad: number
  surprised: number
  relaxed: number
}

const POSES: Record<CharacterState, Pose> = {
  // Amplitudes are large enough to read at full-body size, where the face is only ~40 px tall.
  IDLE: { headPitch: 0, headRoll: 0, lean: 0, hop: 0, happy: 0, sad: 0, surprised: 0, relaxed: 0.25 },
  LISTENING: { headPitch: 0.06, headRoll: 0.22, lean: 0.08, hop: 0, happy: 0.1, sad: 0, surprised: 0, relaxed: 0.5 },
  THINKING: { headPitch: -0.28, headRoll: -0.24, lean: -0.03, hop: 0, happy: 0, sad: 0, surprised: 0, relaxed: 0 },
  SPEAKING: { headPitch: 0, headRoll: 0.06, lean: 0.04, hop: 0, happy: 0.5, sad: 0, surprised: 0, relaxed: 0 },
  WORKING: { headPitch: 0.32, headRoll: 0, lean: 0.08, hop: 0, happy: 0, sad: 0, surprised: 0, relaxed: 0 },
  NOTIFICATION: { headPitch: -0.1, headRoll: 0.05, lean: -0.04, hop: 1, happy: 0.3, sad: 0, surprised: 1, relaxed: 0 },
  ERROR: { headPitch: 0.42, headRoll: 0.12, lean: 0.1, hop: 0, happy: 0, sad: 1, surprised: 0, relaxed: 0 }
}

const VISEMES = ['aa', 'oh', 'ee', 'ih', 'ou'] as const
const BLEND_RATE = 6 // per second; ~0.4 s to settle into a new state

export interface Avatar {
  readonly vrm: VRM
  /** World-space box used to frame the camera. */
  readonly bounds: Box3
  setState(state: CharacterState): void
  /** Plays a gesture now, replacing any gesture already running. */
  play(gesture: Gesture): void
  /** Mouth openness 0..1 from real speech audio; null falls back to placeholder mouth movement. */
  setMouth(level: number | null): void
  /** Point the eyes at a world-space position; null returns to looking at the viewer. */
  lookAt(world: Vector3 | null): void
  update(dt: number, elapsed: number): void
  dispose(): void
}

export async function loadAvatar(source: ArrayBuffer | string, camera: Camera): Promise<Avatar> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  const gltf = typeof source === 'string' ? await loader.loadAsync(source) : await loader.parseAsync(source, '')
  const vrm = gltf.userData['vrm'] as VRM | undefined
  if (!vrm) throw new Error('The file has no VRM data')

  VRMUtils.removeUnnecessaryVertices(gltf.scene)
  VRMUtils.combineSkeletons(gltf.scene)
  VRMUtils.rotateVRM0(vrm) // VRM 0.x faces -Z; turn it to face the camera like VRM 1.0
  vrm.scene.traverse((o) => (o.frustumCulled = false))

  const bone = (name: VRMHumanBoneName): Object3D | null => vrm.humanoid.getNormalizedBoneNode(name)
  // VRM 0.x bones face -Z; after rotateVRM0 their X and Z rotations are mirrored (as in three-vrm's own examples).
  const m = vrm.meta.metaVersion === '0' ? -1 : 1
  const turn = (b: Object3D | null, x: number, y: number, z: number): void => void b?.rotation.set(x * m, y, z * m)
  // The rest pose is a T-pose: arms go down to the sides with a slight elbow bend (re-applied every frame below).
  const rUpper = bone('rightUpperArm')
  const lUpper = bone('leftUpperArm')
  const rLower = bone('rightLowerArm')
  const lLower = bone('leftLowerArm')
  const rHand = bone('rightHand')
  // Twist about the forearm's own length first, then bend (three's default XYZ order would twist in the upper arm's frame).
  rLower?.rotation.reorder('ZYX')
  const applyArms = (o: typeof ZERO): void => {
    turn(rUpper, 0, 0, 1.2 + o.rUpperZ)
    turn(lUpper, 0, 0, -1.2 + o.lUpperZ)
    // Split the twist between forearm and wrist so the skin doesn't candy-wrap at the wrist.
    turn(rLower, o.rTwist * 0.6, 0.15 + o.rLowerY, o.rLowerZ)
    turn(rHand, o.rTwist * 0.4, 0, 0)
    turn(lLower, 0, -0.15 + o.lLowerY, o.lLowerZ)
  }
  applyArms(ZERO)

  vrm.update(0)
  const bounds = new Box3().setFromObject(vrm.scene)

  const gazeTarget = new Object3D()
  const viewerTarget = camera // default: look at the viewer
  if (vrm.lookAt) vrm.lookAt.target = viewerTarget

  const head = bone('head')
  const neck = bone('neck')
  const chest = bone('chest') ?? bone('spine')
  const hips = bone('hips')
  const hipsRestY = hips?.position.y ?? 0

  let target = POSES.IDLE
  const pose: Pose = { ...POSES.IDLE }
  let state: CharacterState = 'IDLE'
  let stateSince = 0
  let elapsedNow = 0
  let nextBlink = 2 + Math.random() * 3
  let blinkStart = -1
  let viseme = 0
  let visemeAt = 0
  let gesture: { name: Gesture; start: number } | undefined
  let nextIdleGesture = 8 + Math.random() * 8
  let talk = 0 // 0..1, eases the talking hands in and out
  let mouth: number | null = null

  const expr = (name: string, weight: number): void => vrm.expressionManager?.setValue(name, weight)

  return {
    vrm,
    bounds,
    setState(next) {
      if (next === state) return
      state = next
      target = POSES[next]
      stateSince = elapsedNow
    },
    play(name) {
      gesture = { name, start: elapsedNow }
    },
    setMouth(level) {
      mouth = level === null ? null : Math.min(1, Math.max(0, level))
    },
    lookAt(world) {
      if (!vrm.lookAt) return
      if (world) {
        gazeTarget.position.copy(world)
        vrm.lookAt.target = gazeTarget
      } else vrm.lookAt.target = viewerTarget
    },
    update(dt, t) {
      elapsedNow = t
      const k = 1 - Math.exp(-dt * BLEND_RATE)
      for (const key of Object.keys(pose) as (keyof Pose)[]) pose[key] += (target[key] - pose[key]) * k

      // Idle life: every so often, a random small action.
      if (state === 'IDLE' && !gesture && t >= nextIdleGesture) {
        gesture = { name: IDLE_GESTURES[Math.floor(Math.random() * IDLE_GESTURES.length)]!, start: t }
      }
      if (gesture && t - gesture.start >= GESTURE_SECONDS[gesture.name]) {
        gesture = undefined
        nextIdleGesture = t + 12 + Math.random() * 13
      }
      talk += ((state === 'SPEAKING' ? 1 : 0) - talk) * k
      const g = addOffsets(
        talkingOffsets(t, talk),
        gesture ? gestureOffsets(gesture.name, (t - gesture.start) / GESTURE_SECONDS[gesture.name]) : ZERO
      )
      applyArms(g)

      const breathe = Math.sin(t * 1.7)
      turn(chest, breathe * 0.015 - pose.lean - g.chest, 0, 0)
      turn(neck, pose.headPitch * 0.4, g.headYaw * 0.4, pose.headRoll * 0.4)
      const nod = state === 'SPEAKING' ? Math.sin(t * 5) * 0.03 : 0
      const sway = Math.sin(t * 0.7) * 0.02
      turn(head, pose.headPitch * 0.6 + nod + g.headPitch, g.headYaw * 0.6, pose.headRoll * 0.6 + sway + g.headRoll)
      if (hips) {
        // A single small hop at the start of a notification, then settle.
        const since = t - stateSince
        const hop = state === 'NOTIFICATION' && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.08 : 0
        hips.position.y = hipsRestY + hop * pose.hop + breathe * 0.002
      }

      expr('happy', Math.min(1, pose.happy + g.happy))
      expr('sad', pose.sad)
      expr('surprised', pose.surprised)
      expr('relaxed', pose.relaxed)

      // Blink at natural intervals; VRM's own override rules keep it off during strong expressions.
      if (blinkStart < 0 && t >= nextBlink) blinkStart = t
      let blink = 0
      if (blinkStart >= 0) {
        const p = (t - blinkStart) / 0.15
        blink = p >= 1 ? 0 : 1 - Math.abs(1 - 2 * p)
        if (p >= 1) {
          blinkStart = -1
          nextBlink = t + 2.5 + Math.random() * 4
        }
      }
      expr('blink', blink)

      // Mouth: follows real speech audio when there is any; otherwise placeholder movement while SPEAKING.
      if (t - visemeAt > 0.11) {
        viseme = Math.floor(Math.random() * VISEMES.length)
        visemeAt = t
      }
      const open = mouth ?? (state === 'SPEAKING' ? 0.6 : 0)
      VISEMES.forEach((v, i) => {
        const current = vrm.expressionManager?.getValue(v) ?? 0
        // With audio, 'aa' tracks loudness and one other vowel shape flickers for variety.
        const want = mouth !== null ? (v === 'aa' ? open * 0.8 : i === viseme ? open * 0.3 : 0) : i === viseme ? open : 0
        expr(v, current + (want - current) * Math.min(1, dt * 18))
      })

      vrm.update(dt)
    },
    dispose() {
      VRMUtils.deepDispose(vrm.scene)
    }
  }
}
