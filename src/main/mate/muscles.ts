// Unity humanoid "muscle" poses (the curves in Mate Engine's .anim files) → rotations of a VRM's normalized bones.
// Pure: no Electron, no three. Unity stores each bone as up to three angles (a twist and two swings) measured from a
// neutral "motorcycle" pose, each scaled to that axis' [min, max] degrees. local = neutral * swing(y, z) * twist(x)
// (Unity's swing-twist form, as described by ShaderMotion, MIT). Unity's own axis tables are internal, so the axes,
// signs and neutral pose below are written from the muscles' names and checked against the clips' own hand and foot
// positions (tests/unit/muscles.test.ts, ADR-075).
//
// Coordinates are three.js / VRM normalized: the model faces +Z, its left is +X, Y is up, every bone is identity in
// the T-pose. Quaternions are [x, y, z, w].

export type Quat = [number, number, number, number]
export type Vec3 = [number, number, number]

export const qmul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
]
export const qinv = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]
/** Rotation by |v| radians about v. */
export function qrot(v: Vec3): Quat {
  const a = Math.hypot(v[0], v[1], v[2])
  if (a < 1e-9) return [0, 0, 0, 1]
  const s = Math.sin(a / 2) / a
  return [v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)]
}
export function qapply(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q
  const ix = w * v[0] + y * v[2] - z * v[1]
  const iy = w * v[1] + z * v[0] - x * v[2]
  const iz = w * v[2] + x * v[1] - y * v[0]
  const iw = -x * v[0] - y * v[1] - z * v[2]
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]
}

const X: Vec3 = [1, 0, 0]
const Y: Vec3 = [0, 1, 0]
const Z: Vec3 = [0, 0, 1]
const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]
const DEG = Math.PI / 180

/** One muscle: which bone it turns, about which axis (signed so a positive value moves the named way), and its range. */
interface Dof {
  bone: string
  axis: Vec3
  twist: boolean
  min: number // degrees, at muscle −1
  max: number // degrees, at muscle +1
  tpose?: number // the muscle value of the T-pose; the neutral pose is the T-pose turned back by it
}

const MUSCLES: Record<string, Dof> = {}
const add = (name: string, bone: string, axis: Vec3, twist: boolean, min: number, max: number, tpose?: number): void =>
  void (MUSCLES[name] = { bone, axis, twist, min, max, ...(tpose === undefined ? {} : { tpose }) })

// Spine, chest, neck, head point up. Front-Back / Nod: + bends back (chin up). Left-Right / Tilt: + towards her right.
// Twist / Turn: + turns to her right.
for (const [prefix, bone, range, nod, tilt, turn] of [
  ['Spine', 'spine', 40, 'Front-Back', 'Left-Right', 'Twist Left-Right'],
  ['Chest', 'chest', 40, 'Front-Back', 'Left-Right', 'Twist Left-Right'],
  ['UpperChest', 'upperChest', 20, 'Front-Back', 'Left-Right', 'Twist Left-Right'],
  ['Neck', 'neck', 40, 'Nod Down-Up', 'Tilt Left-Right', 'Turn Left-Right'],
  ['Head', 'head', 40, 'Nod Down-Up', 'Tilt Left-Right', 'Turn Left-Right']
] as const) {
  add(`${prefix} ${nod}`, bone, neg(X), false, -range, range)
  add(`${prefix} ${tilt}`, bone, Z, false, -range, range)
  add(`${prefix} ${turn}`, bone, neg(Y), true, -range, range)
}

for (const side of ['Left', 'Right'] as const) {
  const l = side === 'Left'
  const s = side.toLowerCase()
  const m = (v: Vec3): Vec3 => (l ? v : [v[0], -v[1], -v[2]]) // a rotation axis mirrored to her right side
  // Legs point down. Front-Back: + swings the thigh back (the neutral thigh is ~28° forward). In-Out: + outwards.
  // Stretch: + straightens the knee (the neutral knee is bent 80°). Up-Down: + lifts the toes.
  add(`${side} Upper Leg Front-Back`, `${s}UpperLeg`, X, false, -90, 50, 0.55)
  add(`${side} Upper Leg In-Out`, `${s}UpperLeg`, m(Z), false, -60, 60)
  add(`${side} Upper Leg Twist In-Out`, `${s}UpperLeg`, m(Y), true, -60, 60)
  add(`${side} Lower Leg Stretch`, `${s}LowerLeg`, neg(X), false, -80, 80, 1)
  add(`${side} Lower Leg Twist In-Out`, `${s}LowerLeg`, m(Y), true, -90, 90)
  add(`${side} Foot Up-Down`, `${s}Foot`, neg(X), false, -50, 50)
  add(`${side} Foot Twist In-Out`, `${s}Foot`, m(Y), true, -30, 30)
  add(`${side} Toes Up-Down`, `${s}Toes`, neg(X), false, -50, 50)
  // Arms point sideways. Down-Up: + raises. Front-Back: + swings back (the neutral arm is ~43° down, ~28° forward).
  // Stretch: + straightens the elbow (neutral: bent ~88°). Twist In-Out: + rolls outwards (palm up).
  add(`${side} Shoulder Down-Up`, `${s}Shoulder`, m(Z), false, -15, 30)
  add(`${side} Shoulder Front-Back`, `${s}Shoulder`, m(Y), false, -15, 15)
  add(`${side} Arm Down-Up`, `${s}UpperArm`, m(Z), false, -60, 100, 0.43)
  add(`${side} Arm Front-Back`, `${s}UpperArm`, m(Y), false, -100, 100, 0.28)
  add(`${side} Arm Twist In-Out`, `${s}UpperArm`, neg(X), true, -90, 90)
  add(`${side} Forearm Stretch`, `${s}LowerArm`, m(Y), false, -80, 80, 1.1)
  add(`${side} Forearm Twist In-Out`, `${s}LowerArm`, neg(X), true, -90, 90)
  add(`${side} Hand Down-Up`, `${s}Hand`, m(Z), false, -80, 80)
  add(`${side} Hand In-Out`, `${s}Hand`, m(Y), false, -40, 40)
  // Fingers point along the arm, palm down. Stretched: + straightens (neutral: curled by the range). Spread: + apart.
  for (const [finger, spread, open] of [
    ['Thumb', 25, [20, 35, 35]],
    ['Index', 20, [50, 45, 45]],
    ['Middle', 7.5, [50, 45, 45]],
    ['Ring', 7.5, [50, 45, 45]],
    ['Little', 20, [50, 45, 45]]
  ] as const) {
    const bones = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal']
    const bone = (i: number): string => `${s}${finger}${bones[i]}`
    // Fingers bend down towards the palm about the hand's front-back axis; the thumb, which points forward and out
    // at about 45°, about the level axis across it. Spread turns in the palm's plane: index, middle and thumb towards
    // the front, ring and little finger towards the back.
    const curl = finger === 'Thumb' ? m([-Math.SQRT1_2, 0, Math.SQRT1_2]) : m(Z)
    open.forEach((range, i) => add(`${side}Hand.${finger}.${i + 1} Stretched`, bone(i), curl, false, -range, range, 1))
    const apart = finger === 'Ring' || finger === 'Little' ? m(Y) : m(neg(Y))
    add(`${side}Hand.${finger}.Spread`, bone(0), apart, false, -spread, spread)
  }
}

export const MUSCLE_NAMES = Object.keys(MUSCLES)

/** A bone's rotation from its muscles: swing (both swing axes at once, as one rotation) after twist. */
function swingTwist(dofs: { dof: Dof; deg: number }[]): Quat {
  const swing: Vec3 = [0, 0, 0]
  let twist: Quat = [0, 0, 0, 1]
  for (const { dof, deg } of dofs) {
    const r = deg * DEG
    if (dof.twist) twist = qrot([dof.axis[0] * r, dof.axis[1] * r, dof.axis[2] * r])
    else for (let i = 0; i < 3; i++) swing[i]! += dof.axis[i]! * r
  }
  return qmul(qrot(swing), twist)
}

const degrees = (dof: Dof, value: number): number => value * (value >= 0 ? dof.max : -dof.min)

const BY_BONE = new Map<string, Dof[]>()
for (const dof of Object.values(MUSCLES)) BY_BONE.set(dof.bone, [...(BY_BONE.get(dof.bone) ?? []), dof])

/** The neutral ("motorcycle") pose of each bone relative to the T-pose: the T-pose turned back by its muscle values. */
const NEUTRAL = new Map<string, Quat>(
  [...BY_BONE].map(([bone, dofs]) => [bone, qinv(swingTwist(dofs.map((dof) => ({ dof, deg: degrees(dof, dof.tpose ?? 0) }))))])
)

export const MUSCLE_BONES = [...BY_BONE.keys()]

/** Local rotations of the normalized bones for one frame of muscle values (missing muscles count as 0). */
export function musclePose(values: Record<string, number>): Record<string, Quat> {
  const pose: Record<string, Quat> = {}
  for (const [bone, dofs] of BY_BONE) {
    pose[bone] = qmul(NEUTRAL.get(bone)!, swingTwist(dofs.map((dof) => ({ dof, deg: degrees(dof, values[dofName(dof)] ?? 0) }))))
  }
  return pose
}
const NAME_OF = new Map<Dof, string>(Object.entries(MUSCLES).map(([name, dof]) => [dof, name]))
const dofName = (dof: Dof): string => NAME_OF.get(dof)!

/** Unity (left-handed, +X her right) to three.js (right-handed, +X her left): mirror X. */
export const fromUnityPosition = (v: Vec3): Vec3 => [-v[0], v[1], v[2]]
export const fromUnityRotation = (q: Quat): Quat => [q[0], -q[1], -q[2], q[3]]

/** Spherical blend from a to b (the short way round). */
export function qslerp(a: Quat, b: Quat, t: number): Quat {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  const s = dot < 0 ? -1 : 1
  dot *= s
  if (dot > 0.9995) {
    const q = a.map((v, i) => v + (s * b[i]! - v) * t) as Quat
    const n = Math.hypot(...q)
    return q.map((v) => v / n) as Quat
  }
  const th = Math.acos(dot)
  const wa = Math.sin((1 - t) * th) / Math.sin(th)
  const wb = (s * Math.sin(t * th)) / Math.sin(th)
  return a.map((v, i) => v * wa + b[i]! * wb) as Quat
}

/** q to the power a: the same axis, a times the angle. */
export function qpow(q: Quat, a: number): Quat {
  const half = Math.acos(Math.max(-1, Math.min(1, q[3])))
  const s = Math.sin(half)
  if (Math.abs(s) < 1e-9) return [0, 0, 0, 1]
  const k = Math.sin(half * a) / s
  return [q[0] * k, q[1] * k, q[2] * k, Math.cos(half * a)]
}

/**
 * Unity's "body" rotation (RootQ) is the torso's, not the hips': it includes about 65% of the spine and chest bend
 * (fitted to the clips' hand and foot goals). The hips' own rotation takes that share back out.
 */
export const hipsRotation = (body: Quat, pose: Record<string, Quat>): Quat =>
  qmul(body, qinv(qpow(qmul(pose['spine']!, qmul(pose['chest']!, pose['upperChest']!)), 0.65)))

// A reference skeleton in T-pose (Seed-san's), relative to the hips, in units of the T-pose centre-of-mass height,
// which is what Unity measures RootT in. Right-side joints mirror the left ones.
const SKELETON: Record<string, [string, Vec3]> = {
  spine: ['hips', [0, 0.151, 0.028]],
  chest: ['spine', [0, 0.287, 0.027]],
  neck: ['chest', [0, 0.544, 0.016]],
  head: ['neck', [0, 0.591, 0.024]],
  leftUpperArm: ['chest', [0.156, 0.482, 0.023]],
  leftLowerArm: ['leftUpperArm', [0.437, 0.484, 0.024]],
  leftHand: ['leftLowerArm', [0.679, 0.486, 0.019]],
  leftUpperLeg: ['hips', [0.098, 0.011, 0.045]],
  leftLowerLeg: ['leftUpperLeg', [0.098, -0.366, 0.051]],
  leftFoot: ['leftLowerLeg', [0.099, -0.793, 0.031]]
}
for (const [bone, [parent, p]] of Object.entries(SKELETON))
  if (bone.startsWith('left')) SKELETON[bone.replace('left', 'right')] = [parent.replace('left', 'right'), [-p[0], p[1], p[2]]]
// Its T-pose hips height is MATE_HIPS_HEIGHT (@shared/mate).

// Body segments by mass (Dempster's table): from joint, to joint, share of the body's mass, centre along the segment.
const SEGMENTS: [string, string, number, number][] = [
  ['hips', 'spine', 0.142, 0.5],
  ['spine', 'chest', 0.139, 0.5],
  ['chest', 'neck', 0.216, 0.5],
  ['head', 'head', 0.081, 0],
  ...(['left', 'right'] as const).flatMap((s): [string, string, number, number][] => [
    [`${s}UpperArm`, `${s}LowerArm`, 0.028, 0.436],
    [`${s}LowerArm`, `${s}Hand`, 0.016, 0.43],
    [`${s}Hand`, `${s}Hand`, 0.006, 0],
    [`${s}UpperLeg`, `${s}LowerLeg`, 0.1, 0.433],
    [`${s}LowerLeg`, `${s}Foot`, 0.0465, 0.433],
    [`${s}Foot`, `${s}Foot`, 0.0145, 0]
  ])
]

/** Joint positions of the reference skeleton, relative to the hips, for a hips rotation and the bones' local rotations. */
export function skeletonPose(hips: Quat, pose: Record<string, Quat>): Record<string, Vec3> {
  const rot: Record<string, Quat> = { hips }
  const pos: Record<string, Vec3> = { hips: [0, 0, 0] }
  const rest: Record<string, Vec3> = { hips: [0, 0, 0] }
  for (const [bone, [parent, p]] of Object.entries(SKELETON)) {
    rest[bone] = p
    // The skeleton has no upper chest or shoulders: fold their rotations into the bone below.
    const local = bone === 'chest' ? qmul(pose['chest']!, pose['upperChest']!) : bone.endsWith('UpperArm') ? qmul(pose[bone.replace('UpperArm', 'Shoulder')]!, pose[bone]!) : (pose[bone] ?? [0, 0, 0, 1])
    rot[bone] = qmul(rot[parent]!, local)
    const off = qapply(rot[parent]!, [p[0] - rest[parent]![0], p[1] - rest[parent]![1], p[2] - rest[parent]![2]])
    pos[bone] = [pos[parent]![0] + off[0], pos[parent]![1] + off[1], pos[parent]![2] + off[2]]
  }
  return pos
}

/** The centre of mass relative to the hips for a pose, on the reference skeleton. */
export function centreOfMass(hips: Quat, pose: Record<string, Quat>): Vec3 {
  const pos = skeletonPose(hips, pose)
  const c: Vec3 = [0, 0, 0]
  for (const [a, b, m, f] of SEGMENTS) for (let i = 0; i < 3; i++) c[i]! += m * (pos[a]![i]! + (pos[b]![i]! - pos[a]![i]!) * f)
  return c
}
