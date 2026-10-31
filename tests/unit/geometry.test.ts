import { describe, expect, it } from 'vitest'
import { CHARACTER_MAX, CHARACTER_MIN, clampSize, defaultPlacement, fitToDisplays, hangPlacement, peekPlacement, placeBeside, scaleBounds, seatPlacement, type Frame } from '../../src/main/geometry'
import { HANG_LINE, SEAT_LINE } from '../../src/shared/character'

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

describe('scaleBounds', () => {
  const b = { x: 1000, y: 300, width: 320, height: 420 }
  it('grows and shrinks proportionally around the feet', () => {
    const big = scaleBounds(b, 1.5)
    expect([big.width, big.height]).toEqual([480, 630])
    expect(big.x + big.width / 2).toBe(b.x + b.width / 2)
    expect(big.y + big.height).toBe(b.y + b.height)
    const small = scaleBounds(b, 0.8)
    expect([small.width, small.height]).toEqual([256, 336])
  })
  it('stops at the limits without changing the proportions', () => {
    const max = scaleBounds(b, 100)
    expect(max.width).toBe(900) // width reaches its limit first for this shape
    expect(max.width / max.height).toBeCloseTo(320 / 420, 2)
    const min = scaleBounds(b, 0.01)
    expect(min.width).toBe(160)
    expect(min.width / min.height).toBeCloseTo(320 / 420, 2)
  })
})

describe('peekPlacement', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 }
  const size = { width: 300, height: 400 }

  it('peeks from an outer edge when dropped close to it, centre line on the edge', () => {
    const left = peekPlacement({ x: -100, y: 300, ...size }, display, [])
    expect(left?.side).toBe('left')
    expect(left!.bounds.x + size.width / 2).toBe(0)
    expect(left!.bounds.x + size.width).toBeGreaterThan(64) // still grabbable
    const right = peekPlacement({ x: 1800, y: 300, ...size }, display, [])
    expect(right?.side).toBe('right')
    expect(right!.bounds.x + size.width / 2).toBe(1920)
    expect(right!.bounds.y).toBe(300)
  })

  it('stands normally away from the edges, and never peeks into a neighbouring display', () => {
    expect(peekPlacement({ x: 500, y: 300, ...size }, display, [])).toBeNull()
    expect(peekPlacement({ x: 1800, y: 300, ...size }, display, [secondary])).toBeNull()
    expect(peekPlacement({ x: -100, y: 300, ...size }, display, [secondary])?.side).toBe('left')
  })
})

describe('hangPlacement', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1032 }
  it('hangs her hands on the top edge when she is dropped there', () => {
    const b = { x: 800, y: 10, width: 300, height: 400 }
    expect(hangPlacement(b, area)).toEqual({ ...b, y: Math.round(-400 * HANG_LINE) })
    expect(hangPlacement({ ...b, y: -60 }, area)?.y).toBe(Math.round(-400 * HANG_LINE)) // dragged past the top
  })
  it('leaves her alone lower down or off the display', () => {
    expect(hangPlacement({ x: 800, y: 300, width: 300, height: 400 }, area)).toBeNull()
    expect(hangPlacement({ x: -400, y: 0, width: 300, height: 400 }, area)).toBeNull()
  })
})

describe('seatPlacement', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 }
  const b = { x: 400, y: 100, width: 300, height: 400 } // centre x 550, hips at 348, feet at 484
  const frame = (handle: number, rect: Frame['rect'], maximized = false): Frame => ({ handle, rect, maximized })

  it('sits on the window whose top edge is between her hips and feet, hips on the edge', () => {
    const notepad = frame(1, { x: 300, y: 470, width: 800, height: 500 })
    const seat = seatPlacement(b, [notepad], area)
    expect(seat?.frame.handle).toBe(1)
    expect(seat!.bounds.y + 400 * SEAT_LINE).toBeCloseTo(470, 0)
    expect(seat!.bounds.x).toBe(400)
  })

  it('ignores windows she is not over, maximised windows and edges hidden under another window', () => {
    expect(seatPlacement(b, [frame(1, { x: 900, y: 470, width: 800, height: 500 })], area)).toBeNull()
    expect(seatPlacement(b, [frame(1, { x: 0, y: 470, width: 1920, height: 570 }, true)], area)).toBeNull()
    const cover = frame(2, { x: 0, y: 200, width: 1920, height: 800 })
    expect(seatPlacement(b, [cover, frame(1, { x: 300, y: 470, width: 800, height: 500 })], area)).toBeNull()
  })

  it('sits on the taskbar when dropped onto it, but stands when put down just above it', () => {
    const onTaskbar = seatPlacement({ ...b, y: 700 }, [], area) // feet at 1084, below the work area (1040)
    expect(onTaskbar?.frame.handle).toBe(0)
    expect(onTaskbar!.bounds.y + 400 * SEAT_LINE).toBeCloseTo(1040, 0)
    expect(seatPlacement({ ...b, y: 600 }, [], area)).toBeNull() // feet at 984: standing at the bottom
  })

    it('refuses an edge so high her head would leave the screen', () => {
    expect(seatPlacement({ ...b, y: -320 }, [frame(1, { x: 300, y: 40, width: 800, height: 500 })], area)).toBeNull()
  })
})
