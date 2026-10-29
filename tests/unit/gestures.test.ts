import { describe, expect, it } from 'vitest'
import { envelope, gestureOffsets, GESTURE_SECONDS, IDLE_GESTURES, talkingOffsets } from '../../src/renderer/character/gestures'

describe('gestures', () => {
  it('start and end at rest, so they never snap', () => {
    for (const g of Object.keys(GESTURE_SECONDS) as (keyof typeof GESTURE_SECONDS)[]) {
      for (const p of [0, 1]) {
        const o = gestureOffsets(g, p)
        for (const v of Object.values(o)) expect(Math.abs(v), `${g} at ${p}`).toBeLessThan(1e-9)
      }
    }
  })

  it('envelope is 0 at the ends and 1 in the middle', () => {
    expect(envelope(0)).toBe(0)
    expect(envelope(1)).toBe(0)
    expect(envelope(0.5)).toBe(1)
    expect(envelope(-1)).toBe(0)
  })

  it('wave raises the right arm and smiles; stretch raises both arms', () => {
    const wave = gestureOffsets('wave', 0.5)
    expect(wave.rUpperZ).toBeLessThan(-1)
    expect(wave.happy).toBeGreaterThan(0.5)
    expect(wave.lUpperZ).toBe(0)
    const stretch = gestureOffsets('stretch', 0.5)
    expect(stretch.rUpperZ).toBeLessThan(-1.5)
    expect(stretch.lUpperZ).toBeGreaterThan(1.5)
  })

  it('talking hands vanish at weight 0', () => {
    for (const v of Object.values(talkingOffsets(12.3, 0))) expect(Math.abs(v)).toBe(0)
    expect(talkingOffsets(12.3, 1).rLowerY).toBeGreaterThan(0)
  })

  it('every idle gesture has a duration', () => {
    for (const g of IDLE_GESTURES) expect(GESTURE_SECONDS[g]).toBeGreaterThan(0)
  })
})
