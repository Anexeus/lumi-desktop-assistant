import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Euler,
  LoopOnce,
  LoopRepeat,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
  type AnimationAction,
  type PerspectiveCamera
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SEAT_LINE, type CharacterState, type Perch } from '@shared/character'
import { MATE_HIPS_HEIGHT, type MateClip, type MateLibrary, type MateRole } from '@shared/mate'
import { addOffsets, gestureOffsets, GESTURE_SECONDS, HEAD_GESTURES, IDLE_GESTURES, talkingOffsets, ZERO, type Gesture } from './gestures'

/** Mate Engine clips imported by the user: the library, a loader for one clip, and whether to use the male sets. */
export interface MateSource {
  library: MateLibrary
  load(id: string): Promise<MateClip>
  male: boolean
  /** Told when a clip starts playing (the character window mirrors it in data-mate). */
  played?(role: MateRole, id: string): void
}
// One-off clips end and hand back to idle; the rest loop. Crossfade times per role (seconds).
const MATE_ONCE: MateRole[] = ['react']
const MATE_FADE: Partial<Record<MateRole, number>> = { drag: 0.2, dragMale: 0.2, pat: 0.35, react: 0.35, idle: 1.2, idleMale: 1.2, sleep: 1.5, dance: 0.6, danceMale: 0.6 }
const IDLE_SWITCH_S = 12 // Mate Engine's own idle switch time

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
  /** Point the eyes at a world-space position; null returns to looking at the viewer. With `follow`, the head and upper body turn toward it too. */
  lookAt(world: Vector3 | null, follow?: boolean): void
  /** The cursor is stroking her head: she leans into it with a big smile. */
  setPetted(petted: boolean): void
  /** Dozes off: eyes shut, head drooping, slow deep breaths. */
  setAsleep(asleep: boolean): void
  /** Picked up by the mouse: she dangles, tipped forward, legs kicking, looking up, surprised. */
  setHeld(held: boolean): void
  /** The window moved by (dx, dy) screen pixels; the body lags and swings back, and hair and clothes follow. */
  nudge(dx: number, dy: number): void
  /** Sits on a window edge or the taskbar facing the viewer, peeks in from a screen edge, falls, or stands. */
  setPerch(perch: Perch): void
  /** Kicks a squash-and-stretch spring: + stretches up, − squashes down; it wobbles back to normal. */
  bounce(amount: number): void
  /** Mate Engine's clips play the body (idle, held, sitting, asleep, petted, reactions); null: Lumi's own poses. */
  setMate(source: MateSource | null): void
  /** Dances (Mate Engine's), one after another, while true. */
  setDancing(dancing: boolean): void
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
  const jelly = { x: 0, v: 0 } // squash (−) and stretch (+) of the whole body, a damped spring
  const inertia = { x: 0, y: 0, vx: 0, vy: 0 } // world-space offset of the body behind the window
  // Head tracking: the head, neck and chest turn toward the cursor (the eyes do the rest), limited and smoothed.
  const look = { yaw: 0, pitch: 0 }
  const headPos = new Vector3()
  const height = bounds.getSize(new Vector3()).y // the cursor is treated as on a screen one body-height in front of her
  let following = false
  let track = 0
  let petted = false
  let pet = 0
  let asleep = false
  let sleep = 0

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

  // Mate Engine clips, when imported: the mixer drives the body and Lumi's procedural body poses step aside; the face,
  // blinking, mouth, gaze and head tracking stay Lumi's, added on top.
  const mixer = new AnimationMixer(vrm.scene)
  const actions = new Map<string, AnimationAction>()
  const hipsRest = hips ? hips.position.clone() : new Vector3()
  let mate: MateSource | null = null
  let action: AnimationAction | null = null
  let actionId = ''
  let role: MateRole | null = null
  let loading: MateRole | null = null
  let roleUntil = Infinity // when this idle hands over to the next, or a one-off ends
  let reacting = false
  let dancing = false
  const addQ = new Quaternion()
  const addE = new Euler()

  /** A converted clip as a three.js clip for this model's normalized bones. */
  function toThree(clip: MateClip): AnimationClip {
    const times = Float32Array.from({ length: clip.frames }, (_, i) => i / clip.fps)
    // VRM 0.x normalized bones are turned 180° about Y (rotateVRM0): mirror X and Z, as three-vrm's own examples do.
    const flip = (v: number[], stride: number): Float32Array => Float32Array.from(v, (x, i) => (m === -1 && i % stride !== 1 && i % stride !== 3 ? -x : x))
    const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = []
    for (const [name, values] of Object.entries(clip.bones)) {
      const node = bone(name as VRMHumanBoneName)
      if (node && node !== hips) tracks.push(new QuaternionKeyframeTrack(`${node.name}.quaternion`, times, flip(values, 4)))
    }
    if (hips) {
      const s = hipsRest.y / MATE_HIPS_HEIGHT // the clip's units → this model's size
      const pos = flip(clip.hips, 3).map((v, i) => v * s + (i % 3 === 0 ? hipsRest.x : i % 3 === 2 ? hipsRest.z : 0))
      tracks.push(new VectorKeyframeTrack(`${hips.name}.position`, times, pos))
      tracks.push(new QuaternionKeyframeTrack(`${hips.name}.quaternion`, times, flip(clip.hipsRotation, 4)))
    }
    return new AnimationClip(clip.name, (clip.frames - 1) / clip.fps, tracks)
  }

  /** What she should be doing now, as a Mate Engine role. */
  const wantedRole = (): MateRole =>
    held || perch === 'fall' ? 'drag' : perch === 'sit' ? 'sit' : asleep ? 'sleep' : petted ? 'pat' : reacting ? 'react' : dancing ? 'dance' : 'idle'

  function startRole(want: MateRole): void {
    const source = mate
    if (!source) return
    const male = `${want}Male` as MateRole
    const set = source.male && source.library.clips[male]?.length ? source.library.clips[male] : source.library.clips[want]
    // A role without clips falls back to idle (and a reaction without any simply doesn't happen).
    if (!set?.length) {
      if (want === 'react') reacting = false
      if (want !== 'idle') return startRole('idle')
      return
    }
    const others = set.length > 1 ? set.filter((id) => id !== actionId) : set
    const id = others[Math.floor(Math.random() * others.length)]!
    loading = want
    source
      .load(id)
      .then((clip) => {
        if (mate !== source || loading !== want) return // something else is wanted by now
        loading = null
        let next = actions.get(id)
        if (!next) actions.set(id, (next = mixer.clipAction(toThree(clip))))
        next.reset().setLoop(MATE_ONCE.includes(want) ? LoopOnce : LoopRepeat, Infinity)
        next.clampWhenFinished = true
        next.play()
        // The very first clip starts at full weight: blending from the T-pose would flash it.
        if (action && action !== next) action.crossFadeTo(next, MATE_FADE[want] ?? 0.5, false)
        action = next
        actionId = id
        role = want
        source.played?.(want, id)
        const length = clip.frames / clip.fps
        // Idles switch every ~12 s, dances after each dance, one-offs end; the rest hold.
        roleUntil = want === 'idle' ? elapsedNow + Math.min(length * 2, Math.max(length, IDLE_SWITCH_S)) : want === 'dance' || MATE_ONCE.includes(want) ? elapsedNow + length : Infinity
      })
      .catch((error) => {
        console.warn('Could not load a Mate Engine clip', id, error)
        if (loading === want) loading = null
        if (want === 'react') reacting = false
        roleUntil = elapsedNow + 5 // try another one in a moment
      })
  }

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
      if (action) {
        // With Mate Engine's clips the body is theirs: a wave or cheer becomes one of its reactions instead.
        if ((name === 'wave' || name === 'cheer') && !held && perch === 'none') reacting = true
        return
      }
      if (!held) gesture = { name, start: elapsedNow } // a wave or stretch would fight the dangling arms
    },
    setMouth(level) {
      mouth = level === null ? null : Math.min(1, Math.max(0, level))
    },
    setHeld(next) {
      held = next
      if (held) gesture = undefined
    },
    nudge(dx, dy) {
      // A quick flick swings her noticeably; the clamps below keep her in the window.
      inertia.vx -= dx * 0.05
      inertia.vy += dy * 0.05
    },
    setPerch(next) {
      perch = next
      if (next === 'left' || next === 'right') peekSide = next === 'left' ? 1 : -1
    },
    bounce(amount) {
      jelly.v += amount * 3
    },
    lookAt(world, follow = false) {
      following = !!world && follow
      if (world) gazeTarget.position.copy(world)
      if (vrm.lookAt) vrm.lookAt.target = world ? gazeTarget : viewerTarget
    },
    setPetted(next) {
      petted = next
    },
    setAsleep(next) {
      asleep = next
      if (asleep) gesture = undefined
    },
    setDancing(next) {
      dancing = next
    },
    setMate(source) {
      const changed = source?.library !== mate?.library
      mate = source
      if (!changed) return // only the male/female choice: it applies from the next clip
      mixer.stopAllAction()
      for (const a of actions.values()) mixer.uncacheClip(a.getClip())
      actions.clear()
      action = null
      actionId = ''
      role = null
      loading = null
      reacting = false
      if (!source) {
        // Back to Lumi's own poses, from the rest pose.
        for (const name of Object.keys(vrm.humanoid.humanBones) as VRMHumanBoneName[]) bone(name)?.quaternion.identity()
        hips?.position.copy(hipsRest)
      }
    },
    update(dt, t) {
      elapsedNow = t
      const k = 1 - Math.exp(-dt * BLEND_RATE)
      for (const key of Object.keys(pose) as (keyof Pose)[]) pose[key] += (target[key] - pose[key]) * k

      // Idle life: every so often, a random small action. None while held or asleep; perched, only head moves (her arms are busy).
      if (state === 'IDLE' && !gesture && !held && !asleep && t >= nextIdleGesture) {
        const choices = perch === 'none' ? IDLE_GESTURES : HEAD_GESTURES
        gesture = { name: choices[Math.floor(Math.random() * choices.length)]!, start: t }
      }
      if (gesture && t - gesture.start >= GESTURE_SECONDS[gesture.name]) {
        gesture = undefined
        nextIdleGesture = t + 12 + Math.random() * 13
      }
      talk += ((state === 'SPEAKING' ? 1 : 0) - talk) * k
      heldWeight += ((held || perch === 'fall' ? 1 : 0) - heldWeight) * Math.min(1, dt * 8)
      sit += ((perch === 'sit' ? 1 : 0) - sit) * k
      peek += ((perch === 'left' || perch === 'right' ? 1 : 0) - peek) * k
      pet += ((petted && !held ? 1 : 0) - pet) * k
      sleep += ((asleep ? 1 : 0) - sleep) * Math.min(1, dt * 1.5) // she nods off slowly
      const calm = state === 'IDLE' || state === 'LISTENING' || state === 'SPEAKING' || state === 'NOTIFICATION'
      const tracking = following && calm && !held && !asleep && !petted && !dancing && (perch === 'none' || perch === 'sit')
      track += ((tracking ? 1 : 0) - track) * k
      let wantYaw = 0
      let wantPitch = 0
      if (following && head) {
        head.getWorldPosition(headPos)
        wantYaw = Math.max(-0.6, Math.min(0.6, Math.atan2(gazeTarget.position.x - headPos.x, height)))
        wantPitch = Math.max(-0.35, Math.min(0.35, Math.atan2(headPos.y - gazeTarget.position.y, height))) // + looks down
      }
      const kl = 1 - Math.exp(-dt * 5)
      look.yaw += (wantYaw * track - look.yaw) * kl
      look.pitch += (wantPitch * track - look.pitch) * kl
      const g = addOffsets(
        talkingOffsets(t, talk),
        gesture ? gestureOffsets(gesture.name, (t - gesture.start) / GESTURE_SECONDS[gesture.name]) : ZERO
      )
      const h = heldWeight
      const s = sit
      // Mate Engine's clips, when imported, play the body; the clip follows what she is doing.
      // Peeking in from a screen edge stays Lumi's own lean (Mate Engine's "hide" clips are a bow): the mixer steps aside.
      const peeking = perch === 'left' || perch === 'right'
      if (peeking && action) {
        action.stop()
        action = null
        role = null
        loading = null
        hips?.position.copy(hipsRest)
      }
      if (mate && !peeking) {
        const want = wantedRole()
        if (want !== loading && (want !== role || t >= roleUntil)) {
          if (role === 'react' && want === 'react') reacting = false // the reaction has played once
          startRole(wantedRole())
        }
        mixer.update(dt)
      }
      const clips = !!action
      if (!clips) {
        // Held: she dangles, leaning forward with arms reaching down and out. Sitting: hands resting on the knees.
        applyArms({
          ...g,
          rUpperZ: g.rUpperZ - 0.18 * h + 0.06 * s,
          lUpperZ: g.lUpperZ + 0.18 * h - 0.06 * s,
          rLowerZ: g.rLowerZ - 0.1 * h,
          lLowerZ: g.lLowerZ + 0.1 * h,
          rLowerY: g.rLowerY + 0.4 * h + 1.05 * s,
          lLowerY: g.lLowerY - 0.4 * h - 1.05 * s
        })
        // Legs dangle and kick while held. Sitting, she faces the viewer on the edge (a window's or the taskbar's):
        // thighs forward over it, lower legs hanging down in front of it, feet swinging.
        const kick = Math.sin(t * 6) * 0.18 * h
        const swing = Math.sin(t * 2.4) * 0.18 * s
        turn(lLeg, kick - 0.1 * h - 1.45 * s, 0, 0.15 * h - 0.04 * s)
        turn(rLeg, -kick - 0.1 * h - 1.45 * s, 0, -0.15 * h + 0.04 * s)
        turn(lKnee, 0.65 * h + (1.5 + swing) * s, 0, 0)
        turn(rKnee, 0.65 * h + (1.5 - swing) * s, 0, 0)
      }

      // Damped spring: the body trails the window's motion, then settles.
      const clampDt = Math.min(dt, 0.05)
      inertia.vx += (-60 * inertia.x - 7 * inertia.vx) * clampDt
      inertia.vy += (-60 * inertia.y - 7 * inertia.vy) * clampDt
      inertia.x = Math.max(-0.14, Math.min(0.14, inertia.x + inertia.vx * clampDt))
      inertia.y = Math.max(-0.1, Math.min(0.1, inertia.y + inertia.vy * clampDt))
      // Seated, the body moves down so her hips are on the window's edge, which main puts at SEAT_LINE of the window.
      let seatShift = 0
      if (s > 0.001) {
        // A clip seats her at its own hip height; Lumi's own sitting pose keeps the hips at their rest height.
        hipsOnScreen.copy(hipsWorld)
        if (clips && hips) hipsOnScreen.y = rootRest.y + hips.position.y
        hipsOnScreen.project(camera)
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
      // Asleep, she breathes slower and deeper, slumps a little and her head droops to one side.
      const breathe = Math.sin(t * (1.7 - 0.7 * sleep)) * (1 + 2 * sleep)
      const nod = state === 'SPEAKING' ? Math.sin(t * 5) * 0.03 : 0
      if (clips) {
        // On top of the clip: her head follows the cursor, tips into a pat, and keeps the state's nod and tilt.
        const add = (b: Object3D | null, x: number, y: number, z: number): void => void b?.quaternion.multiply(addQ.setFromEuler(addE.set(x * m, y, z * m)))
        add(chest, 0, look.yaw * 0.2, 0)
        add(neck, look.pitch * 0.4 + pose.headPitch * 0.3, look.yaw * 0.3, pose.headRoll * 0.3)
        add(head, look.pitch * 0.6 + pose.headPitch * 0.4 + nod + 0.1 * pet, look.yaw * 0.5, pose.headRoll * 0.4 + 0.16 * pet)
      } else {
        turn(hips, -0.45 * heldWeight, 0, lean * 0.2) // held: tipped forward, as if lifted by the back
        turn(spine, 0, peekSide * 0.15 * peek, lean * 0.22)
        turn(chest, breathe * 0.015 - pose.lean - g.chest - 0.12 * sit + 0.08 * sleep, peekSide * 0.25 * peek + look.yaw * 0.2, lean * (spine ? 0.22 : 0.44))
        turn(neck, pose.headPitch * 0.4 + look.pitch * 0.4, g.headYaw * 0.4 + peekSide * 0.1 * peek + look.yaw * 0.3, pose.headRoll * 0.4)
        const sway = Math.sin(t * 0.7) * 0.02
        // Petted, she tips her head into the hand.
        turn(
          head,
          pose.headPitch * 0.6 + nod + g.headPitch - 0.25 * heldWeight + look.pitch * 0.6 + 0.1 * pet + 0.4 * sleep,
          g.headYaw * 0.6 + peekSide * 0.15 * peek + look.yaw * 0.5,
          pose.headRoll * 0.6 + sway + g.headRoll + lean * 0.15 + 0.16 * pet + 0.14 * sleep
        )
        if (hips) {
          // A single small hop at the start of a notification, then settle; gestures (the "Yay!" cheer) hop too.
          const since = t - stateSince
          const hop = state === 'NOTIFICATION' && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.08 : 0
          hips.position.y = hipsRestY + hop * pose.hop + g.hop * 0.06 + breathe * 0.002
        }
      }

      expr('happy', Math.min(1, pose.happy + g.happy + 0.35 * peek + pet))
      expr('sad', pose.sad)
      expr('surprised', Math.min(1, pose.surprised + 0.5 * heldWeight))
      expr('relaxed', Math.min(1, pose.relaxed + 0.6 * sleep))

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
      expr('blink', Math.max(blink, sleep))

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
      mixer.stopAllAction()
      mixer.uncacheRoot(vrm.scene)
      VRMUtils.deepDispose(vrm.scene)
    }
  }
}
