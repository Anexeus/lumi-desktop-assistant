import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'
import { Box3, Object3D, Vector3, type PerspectiveCamera } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SEAT_LINE, type CharacterState, type Perch } from '@shared/character'
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

// Relaxed standing: arms hang close to the body (not the A-pose most models are rigged in), elbows softly bent.
const REST_ARM = 1.36
const REST_ELBOW = 0.22

export interface Avatar {
  readonly vrm: VRM
  /** World-space box used to frame the camera. */
  readonly bounds: Box3
  /** Her hips at rest: the body's centre line (the box can be lopsided, e.g. a prop held to one side). */
  readonly body: Vector3
  setState(state: CharacterState): void
  /** Plays a gesture now, replacing any gesture already running. */
  play(gesture: Gesture): void
  /** Mouth openness 0..1 from real speech audio; null falls back to placeholder mouth movement. */
  setMouth(level: number | null): void
  /** Point the eyes at a world-space position; null returns to looking at the viewer. */
  lookAt(world: Vector3 | null): void
  /** Picked up by the mouse: arms up, legs dangle, a surprised smile. */
  setHeld(held: boolean): void
  /** The window moved by (dx, dy) screen pixels; the body lags and swings back, and hair and clothes follow. */
  nudge(dx: number, dy: number): void
  /** Sits on a window edge (facing +1 right or −1 left), peeks in from a screen edge, falls (arms up), or stands. */
  setPerch(perch: Perch, facing?: number): void
  /** Kicks a squash-and-stretch spring: + stretches up, − squashes down; it wobbles back to normal. */
  bounce(amount: number): void
  update(dt: number, elapsed: number): void
  dispose(): void
}

export async function loadAvatar(source: ArrayBuffer | string, camera: PerspectiveCamera): Promise<Avatar> {
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
    turn(rUpper, 0, 0, REST_ARM + o.rUpperZ)
    turn(lUpper, 0, 0, -REST_ARM + o.lUpperZ)
    // Split the twist between forearm and wrist so the skin doesn't candy-wrap at the wrist.
    turn(rLower, o.rTwist * 0.6, REST_ELBOW + o.rLowerY, o.rLowerZ)
    turn(rHand, o.rTwist * 0.4, 0, 0)
    turn(lLower, 0, -REST_ELBOW + o.lLowerY, o.lLowerZ)
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
  const spine = chest === bone('spine') ? null : bone('spine') // a second bend point for leaning, when the model has both
  const hips = bone('hips')
  const hipsRestY = hips?.position.y ?? 0
  const hipsWorld = hips ? hips.getWorldPosition(new Vector3()) : bounds.getCenter(new Vector3())
  const lLeg = bone('leftUpperLeg')
  const rLeg = bone('rightUpperLeg')
  const lKnee = bone('leftLowerLeg')
  const rKnee = bone('rightLowerLeg')
  const rootRest = vrm.scene.position.clone()
  const hipsOnScreen = new Vector3()
  let held = false
  let heldWeight = 0
  let perch: Perch = 'none'
  let sit = 0 // 0..1 blend weights, eased like the state poses
  let peek = 0
  let peekSide = 0 // +1: the screen is to her right (left edge), −1: to her left
  let sitFacing = 1 // sitting, she turns side-on: +1 faces the screen's right, −1 its left
  const jelly = { x: 0, v: 0 } // squash (−) and stretch (+) of the whole body, a damped spring
  const inertia = { x: 0, y: 0, vx: 0, vy: 0 } // world-space offset of the body behind the window

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
    body: hipsWorld,
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
    setHeld(next) {
      held = next
    },
    nudge(dx, dy) {
      // A quick flick swings her noticeably; the clamps below keep her in the window.
      inertia.vx -= dx * 0.05
      inertia.vy += dy * 0.05
    },
    setPerch(next, facing = 1) {
      perch = next
      if (next === 'left' || next === 'right') peekSide = next === 'left' ? 1 : -1
      if (next === 'sit') sitFacing = facing
    },
    bounce(amount) {
      jelly.v += amount * 3
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
      heldWeight += ((held || perch === 'fall' ? 1 : 0) - heldWeight) * Math.min(1, dt * 8)
      sit += ((perch === 'sit' ? 1 : 0) - sit) * k
      peek += ((perch === 'left' || perch === 'right' ? 1 : 0) - peek) * k
      const g = addOffsets(
        talkingOffsets(t, talk),
        gesture ? gestureOffsets(gesture.name, (t - gesture.start) / GESTURE_SECONDS[gesture.name]) : ZERO
      )
      const h = heldWeight
      const s = sit
      // Held: both arms up in a cheerful V with bent elbows ("wheee!"). Sitting: hands forward over the lap.
      applyArms({
        ...g,
        rUpperZ: g.rUpperZ - 1.8 * h + 0.06 * s,
        lUpperZ: g.lUpperZ + 1.8 * h - 0.06 * s,
        rLowerZ: g.rLowerZ - 0.7 * h,
        lLowerZ: g.lLowerZ + 0.7 * h,
        rLowerY: g.rLowerY + 0.9 * s,
        lLowerY: g.lLowerY - 0.9 * s
      })
      // Legs dangle and kick while held. Sitting, she is side-on to the viewer (seen from the front, raised thighs lift a
      // skirt and show what they shouldn't): thighs along the edge, lower legs hanging over it, feet swinging.
      const kick = Math.sin(t * 7) * 0.25 * h
      const swing = Math.sin(t * 2.4) * 0.18 * s
      turn(lLeg, kick - 1.45 * s, 0, 0.06 * h)
      turn(rLeg, -kick - 1.45 * s, 0, -0.06 * h)
      turn(lKnee, (1.5 + swing) * s, 0, 0)
      turn(rKnee, (1.5 - swing) * s, 0, 0)

      // Damped spring: the body trails the window's motion, then settles.
      const clampDt = Math.min(dt, 0.05)
      inertia.vx += (-60 * inertia.x - 7 * inertia.vx) * clampDt
      inertia.vy += (-60 * inertia.y - 7 * inertia.vy) * clampDt
      inertia.x = Math.max(-0.14, Math.min(0.14, inertia.x + inertia.vx * clampDt))
      inertia.y = Math.max(-0.1, Math.min(0.1, inertia.y + inertia.vy * clampDt))
      // Seated, the body moves down so her hips are on the window's edge, which main puts at SEAT_LINE of the window.
      let seatShift = 0
      if (s > 0.001) {
        hipsOnScreen.copy(hipsWorld).project(camera)
        const hipsLine = (1 - hipsOnScreen.y) / 2 // 0 at the top of the window, 1 at the bottom
        const visible = 2 * (camera.position.z - hipsWorld.z) * Math.tan((camera.fov * Math.PI) / 360)
        seatShift = (hipsLine - SEAT_LINE) * visible * s
      }
      vrm.scene.position.set(rootRest.x + inertia.x, rootRest.y + inertia.y + seatShift, rootRest.z)
      // Jelly: stretched taller and thinner (or squashed) from the feet, keeping her volume roughly the same.
      jelly.v += (-180 * jelly.x - 12 * jelly.v) * clampDt
      jelly.x = Math.max(-0.08, Math.min(0.08, jelly.x + jelly.v * clampDt))
      vrm.scene.scale.set(1 - jelly.x * 0.5, 1 + jelly.x, 1 - jelly.x * 0.5)

      // Peeking: she bends in from behind the screen edge at the hips, spine and chest (~37° in all), turns to the
      // screen and tilts her head; her legs stay out of sight past the edge.
      const lean = -peekSide * peek
      const breathe = Math.sin(t * 1.7)
      // Sitting side-on, the body turns ~83° and the spine, neck and head turn most of the way back to the viewer.
      const sitYaw = sitFacing * s
      turn(hips, 0, sitYaw * 1.45, lean * 0.2)
      turn(spine, 0, peekSide * 0.15 * peek - sitYaw * 0.25, lean * 0.22)
      turn(chest, breathe * 0.015 - pose.lean - g.chest, peekSide * 0.25 * peek - sitYaw * 0.2, lean * (spine ? 0.22 : 0.44))
      turn(neck, pose.headPitch * 0.4, g.headYaw * 0.4 + peekSide * 0.1 * peek - sitYaw * 0.35, pose.headRoll * 0.4)
      const nod = state === 'SPEAKING' ? Math.sin(t * 5) * 0.03 : 0
      const sway = Math.sin(t * 0.7) * 0.02
      turn(head, pose.headPitch * 0.6 + nod + g.headPitch, g.headYaw * 0.6 + peekSide * 0.15 * peek - sitYaw * 0.45, pose.headRoll * 0.6 + sway + g.headRoll + lean * 0.15)
      if (hips) {
        // A single small hop at the start of a notification, then settle; gestures (the "Yay!" cheer) hop too.
        const since = t - stateSince
        const hop = state === 'NOTIFICATION' && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.08 : 0
        hips.position.y = hipsRestY + hop * pose.hop + g.hop * 0.06 + breathe * 0.002
      }

      expr('happy', Math.min(1, pose.happy + g.happy + 0.35 * peek))
      expr('sad', pose.sad)
      expr('surprised', Math.min(1, pose.surprised + 0.5 * heldWeight))
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
