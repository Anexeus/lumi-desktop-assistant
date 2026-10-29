import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'
import { Box3, Object3D, Vector3, type Camera } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CharacterState } from '@shared/character'

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
  // Rest pose is a T-pose: drop the arms to the sides with a slight elbow bend.
  bone('leftUpperArm')?.rotation.set(0, 0, -1.2)
  bone('rightUpperArm')?.rotation.set(0, 0, 1.2)
  bone('leftLowerArm')?.rotation.set(0, -0.15, 0)
  bone('rightLowerArm')?.rotation.set(0, 0.15, 0)

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

      const breathe = Math.sin(t * 1.7)
      if (chest) chest.rotation.x = breathe * 0.015 - pose.lean
      if (neck) neck.rotation.set(pose.headPitch * 0.4, 0, pose.headRoll * 0.4)
      const nod = state === 'SPEAKING' ? Math.sin(t * 5) * 0.03 : 0
      const sway = Math.sin(t * 0.7) * 0.02
      if (head) head.rotation.set(pose.headPitch * 0.6 + nod, 0, pose.headRoll * 0.6 + sway)
      if (hips) {
        // A single small hop at the start of a notification, then settle.
        const since = t - stateSince
        const hop = state === 'NOTIFICATION' && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.08 : 0
        hips.position.y = hipsRestY + hop * pose.hop + breathe * 0.002
      }

      expr('happy', pose.happy)
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

      // shortcut: random visemes while SPEAKING, until real audio-driven lip sync in Milestone 4.
      if (state === 'SPEAKING' && t - visemeAt > 0.11) {
        viseme = Math.floor(Math.random() * VISEMES.length)
        visemeAt = t
      }
      VISEMES.forEach((v, i) => {
        const current = vrm.expressionManager?.getValue(v) ?? 0
        const want = state === 'SPEAKING' && i === viseme ? 0.6 : 0
        expr(v, current + (want - current) * Math.min(1, dt * 18))
      })

      vrm.update(dt)
    },
    dispose() {
      VRMUtils.deepDispose(vrm.scene)
    }
  }
}
