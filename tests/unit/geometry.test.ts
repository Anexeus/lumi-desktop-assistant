import { describe, expect, it } from 'vitest'
import { CHARACTER_MAX, CHARACTER_MIN, clampSize, defaultPlacement, fitToDisplays, placeBeside } from '../../src/main/geometry'

const primary = { x: 0, y: 0, width: 1920, height: 1040 }
const secondary = { x: 1920, y: 0, width: 2560, height: 1400 }

describe('clampSize', () => {
  it('enforces min and max', () => {
    expect(clampSize(10, 10)).toEqual(CHARACTER_MIN)
    expect(clampSize(99_999, 99_999)).toEqual(CHARACTER_MAX)
    expect(clampSize(300.4, 400.6)).toEqual({ width: 300, height: 401 })
  })
})

describe('fitToDisplays', () => {
  it('uses the default spot when nothing was saved', () => {
    expect(fitToDisplays(undefined, [primary], primary)).toEqual(defaultPlacement(primary))
  })

  it('keeps bounds that are on a display', () => {
    const saved = { x: 2000, y: 100, width: 300, height: 400 }
    expect(fitToDisplays(saved, [primary, secondary], primary)).toEqual(saved)
  })

  it('keeps a window that is only partly on screen but still grabbable', () => {
    const saved = { x: 1800, y: 600, width: 300, height: 400 } // 120px visible on the right edge
    expect(fitToDisplays(saved, [primary], primary)).toEqual(saved)
  })

  it('recovers when the saved monitor is gone', () => {
    const saved = { x: 2500, y: 200, width: 300, height: 400 }
    const fitted = fitToDisplays(saved, [primary], primary)
    expect(fitted).toEqual(defaultPlacement(primary, { width: 300, height: 400 }))
  })

  it('clamps a corrupt saved size', () => {
    const fitted = fitToDisplays({ x: 10, y: 10, width: 5, height: 99_999 }, [primary], primary)
    expect(fitted.width).toBe(CHARACTER_MIN.width)
    expect(fitted.height).toBe(CHARACTER_MAX.height)
  })
})

describe('placeBeside', () => {
  const size = { width: 400, height: 560 }

  it('prefers the left side of the character', () => {
    const anchor = { x: 1600, y: 600, width: 300, height: 400 }
    const r = placeBeside(anchor, size, primary)
    expect(r.x + r.width).toBeLessThanOrEqual(anchor.x)
  })

  it('falls back to the right and stays inside the work area', () => {
    const anchor = { x: 20, y: 0, width: 300, height: 400 }
    const r = placeBeside(anchor, size, primary)
    expect(r.x).toBeGreaterThanOrEqual(anchor.x + anchor.width)
    expect(r.y).toBeGreaterThanOrEqual(primary.y)
  })
})
