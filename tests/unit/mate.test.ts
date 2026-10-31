import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { convertClip, parseAnim, sampleCurve } from '../../src/main/mate/anim'
import { centreOfMass, fromUnityPosition, fromUnityRotation, hipsRotation, musclePose, qapply, qinv, skeletonPose, type Vec3 } from '../../src/main/mate/muscles'

// The T-pose in muscle values (all others 0).
const TPOSE: Record<string, number> = {}
for (const s of ['Left', 'Right']) {
  Object.assign(TPOSE, { [`${s} Arm Down-Up`]: 0.43, [`${s} Arm Front-Back`]: 0.28, [`${s} Forearm Stretch`]: 1.1, [`${s} Upper Leg Front-Back`]: 0.55, [`${s} Lower Leg Stretch`]: 1 })
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) for (const i of [1, 2, 3]) TPOSE[`${s}Hand.${f}.${i} Stretched`] = 1
}
const angle = (q: number[]): number => 2 * Math.acos(Math.min(1, Math.abs(q[3]!)))

describe('muscle poses', () => {
  it('turns the T-pose muscle values into no rotation at all', () => {
    for (const [bone, q] of Object.entries(musclePose(TPOSE))) expect(angle(q), bone).toBeLessThan(1e-6)
  })

  it('moves bones the way the muscles are named', () => {
    const with_ = (name: string, delta: number) => musclePose({ ...TPOSE, [name]: (TPOSE[name] ?? 0) + delta })
    // Raising the left arm lifts it (+Y); swinging it back moves it to -Z.
    expect(qapply(with_('Left Arm Down-Up', 0.3)['leftUpperArm']!, [1, 0, 0])[1]).toBeGreaterThan(0.3)
    expect(qapply(with_('Left Arm Front-Back', 0.3)['leftUpperArm']!, [1, 0, 0])[2]).toBeLessThan(-0.3)
    expect(qapply(with_('Right Arm Down-Up', 0.3)['rightUpperArm']!, [-1, 0, 0])[1]).toBeGreaterThan(0.3)
    // A negative Front-Back lifts the thigh forward; bending the knee swings the shin back.
    expect(qapply(with_('Left Upper Leg Front-Back', -0.5)['leftUpperLeg']!, [0, -1, 0])[2]).toBeGreaterThan(0.3)
    expect(qapply(with_('Left Lower Leg Stretch', -0.5)['leftLowerLeg']!, [0, -1, 0])[2]).toBeLessThan(-0.3)
    // Her head turns to her right (-X) and nods up; fingers curl down towards the palm.
    expect(qapply(with_('Head Turn Left-Right', 0.5)['head']!, [0, 0, 1])[0]).toBeLessThan(-0.2)
    expect(qapply(with_('Head Nod Down-Up', 0.5)['head']!, [0, 0, 1])[1]).toBeGreaterThan(0.2)
    expect(qapply(with_('LeftHand.Index.1 Stretched', -1)['leftIndexProximal']!, [1, 0, 0])[1]).toBeLessThan(-0.5)
  })

  it('converts between Unity and three.js axes by mirroring X', () => {
    expect(fromUnityPosition([1, 2, 3])).toEqual([-1, 2, 3])
    const q = fromUnityRotation([0.1, 0.2, 0.3, 0.9])
    expect(q).toEqual([0.1, -0.2, -0.3, 0.9])
  })
})

describe('.anim curves', () => {
  const yaml = `%YAML 1.1
--- !u!74 &7400000
AnimationClip:
  m_Name: TEST
  m_FloatCurves:
  - serializedVersion: 2
    curve:
      m_Curve:
      - serializedVersion: 3
        time: 0
        value: 0
        inSlope: 1
        outSlope: 1
      - serializedVersion: 3
        time: 2
        value: 2
        inSlope: 1
        outSlope: 1
    attribute: Left Arm Down-Up
    path:
  - serializedVersion: 2
    curve:
      m_Curve:
      - serializedVersion: 3
        time: 0
        value: 0.5
        inSlope: Infinity
        outSlope: Infinity
      - serializedVersion: 3
        time: 1
        value: 1
        inSlope: 0
        outSlope: 0
    attribute: RootT.y
    path:
  m_PPtrCurves: []
  m_AnimationClipSettings:
    m_StopTime: 2
    m_LoopTime: 1
`

  it('reads the curves, the length and whether it loops', () => {
    const clip = parseAnim(yaml)
    expect(clip).toMatchObject({ name: 'TEST', duration: 2, loop: true })
    expect([...clip.curves.keys()]).toEqual(['Left Arm Down-Up', 'RootT.y'])
    expect(() => parseAnim('not yaml')).toThrow(/Not a Unity animation/)
  })

  it('samples with Hermite tangents and holds stepped keys', () => {
    const clip = parseAnim(yaml)
    expect(sampleCurve(clip.curves.get('Left Arm Down-Up')!, 0.5)).toBeCloseTo(0.5, 6) // matching slopes: a straight line
    expect(sampleCurve(clip.curves.get('RootT.y')!, 0.9)).toBe(0.5) // an infinite tangent steps
    expect(sampleCurve(clip.curves.get('RootT.y')!, 5)).toBe(1)
  })

  it('makes a looping clip end where it starts, so the loop never jumps', () => {
    const curve = (attribute: string, from: number, to: number): string =>
      `  - serializedVersion: 2\n    curve:\n      m_Curve:\n      - serializedVersion: 3\n        time: 0\n        value: ${from}\n        inSlope: 0\n        outSlope: 0\n      - serializedVersion: 3\n        time: 2\n        value: ${to}\n        inSlope: 0\n        outSlope: 0\n    attribute: ${attribute}\n    path: `
    const names = ['Left', 'Right'].flatMap((s) => [`${s} Arm Down-Up`, `${s} Arm Front-Back`, `${s} Forearm Stretch`, `${s} Upper Leg Front-Back`, `${s} Lower Leg Stretch`, `${s} Hand Down-Up`])
    const text = `AnimationClip:\n  m_Name: DRIFT\n  m_FloatCurves:\n${[...names.map((n) => curve(n, 0, 0.4)), curve('RootT.x', 0, 0.2)].join('\n')}\n  m_PPtrCurves: []\n  m_AnimationClipSettings:\n    m_StopTime: 2\n    m_LoopTime: 1\n`
    const clip = convertClip(parseAnim(text))
    const last = clip.frames - 1
    for (const values of [...Object.values(clip.bones), clip.hipsRotation])
      for (let i = 0; i < 4; i++) expect(Math.abs(values[last * 4 + i]!)).toBeCloseTo(Math.abs(values[i]!), 3)
    for (let i = 0; i < 3; i++) expect(clip.hips[last * 3 + i]).toBeCloseTo(clip.hips[i]!, 3)
    // Halfway through it still moves as the clip says.
    expect(Math.abs(clip.hips[Math.floor(last / 2) * 3]! - clip.hips[0]!)).toBeGreaterThan(0.05)
  })

  it('refuses clips that are not humanoid body animations', () => {
    expect(() => convertClip(parseAnim(yaml))).toThrow(/not a humanoid body animation/)
  })
})

// Mate Engine's clips also store where the hands and feet should be (IK goals, relative to the centre of mass, in
// the body's frame). The converted pose must put them there. Runs only where the owner keeps Mate Engine.
const MATE = 'Mate-Engine-Public-Release-X3.3.0/Assets/MATE ENGINE - Animations'
describe.skipIf(!existsSync(MATE))('Mate Engine clips (local)', () => {
  it('puts hands and feet within ~10% of her height of where the clip says', () => {
    const files = ['PET_IDLE/PET_IDLE_2.anim', 'PET_IDLE/PET_IDLE_9.anim', 'PET_SITTING/ME_02/PET_SIT_01.anim', 'PET_SITTING/ME_02/PET_SIT_02.anim', 'PET_MISC/PET_DRAGGING.anim', 'UPDATE_2/PET_IDLE_UPDATE2_01.anim']
    let sum = 0
    let count = 0
    for (const file of files) {
      const clip = parseAnim(readFileSync(join(MATE, file), 'utf8'))
      const value = (name: string, t: number, fallback = 0): number => (clip.curves.has(name) ? sampleCurve(clip.curves.get(name)!, t) : fallback)
      for (let t = 0; t < clip.duration; t += clip.duration / 30) {
        const values = Object.fromEntries([...clip.curves.keys()].map((n) => [n, value(n, t)]))
        const pose = musclePose(values)
        const body = fromUnityRotation([value('RootQ.x', t), value('RootQ.y', t), value('RootQ.z', t), value('RootQ.w', t, 1)])
        const hips = hipsRotation(body, pose)
        const joints = skeletonPose(hips, pose)
        const com = centreOfMass(hips, pose)
        for (const goal of ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot']) {
          const p = joints[goal[0]!.toLowerCase() + goal.slice(1)]!
          const sole = goal.endsWith('Foot') ? 0.08 : 0 // the foot goal is the sole, not the ankle
          const local = qapply(qinv(body), [p[0] - com[0], p[1] - sole - com[1], p[2] - com[2]])
          const want: Vec3 = fromUnityPosition([value(`${goal}T.x`, t), value(`${goal}T.y`, t), value(`${goal}T.z`, t)])
          sum += Math.hypot(local[0] - want[0], local[1] - want[1], local[2] - want[2])
          count++
        }
      }
    }
    expect(sum / count).toBeLessThan(0.1)
  })
})
