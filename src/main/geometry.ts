// Pure window-geometry helpers (no Electron imports) so they can be unit tested.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const CHARACTER_MIN = { width: 160, height: 200 }
export const CHARACTER_MAX = { width: 900, height: 1200 }
export const CHARACTER_DEFAULT = { width: 300, height: 400 }

/** How much of the window must overlap a display for it to count as reachable. */
const MIN_VISIBLE = 64
const MARGIN = 24

export function clampSize(width: number, height: number): { width: number; height: number } {
  const clamp = (v: number, lo: number, hi: number): number => Math.round(Math.min(hi, Math.max(lo, v)))
  return {
    width: clamp(width, CHARACTER_MIN.width, CHARACTER_MAX.width),
    height: clamp(height, CHARACTER_MIN.height, CHARACTER_MAX.height)
  }
}

/**
 * Scales a character window by `factor` without changing its proportions, clamped so both sides stay within the
 * limits, and keeps the bottom centre (her feet) where it was.
 */
export function scaleBounds(b: Rect, factor: number): Rect {
  const lo = Math.max(CHARACTER_MIN.width / b.width, CHARACTER_MIN.height / b.height)
  const hi = Math.min(CHARACTER_MAX.width / b.width, CHARACTER_MAX.height / b.height)
  const f = Math.min(hi, Math.max(lo, factor))
  const width = b.width * f
  const height = b.height * f
  return { x: b.x + (b.width - width) / 2, y: b.y + b.height - height, width, height } // unrounded: callers round once
}

function overlap(a: Rect, b: Rect): { w: number; h: number } {
  return {
    w: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    h: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  }
}

/** Bottom-right corner of the work area, inset by a margin. */
export function defaultPlacement(workArea: Rect, size = CHARACTER_DEFAULT): Rect {
  return {
    x: workArea.x + workArea.width - size.width - MARGIN,
    y: workArea.y + workArea.height - size.height - MARGIN,
    ...size
  }
}

/**
 * Returns bounds that are reachable on the current displays. Saved bounds are kept when
 * enough of the window is still on some display; otherwise (monitor unplugged, resolution
 * changed) the window goes back to the primary display's default spot.
 */
export function fitToDisplays(bounds: Rect | undefined, workAreas: Rect[], primary: Rect): Rect {
  if (!bounds) return defaultPlacement(primary)
  const size = clampSize(bounds.width, bounds.height)
  const candidate = { x: Math.round(bounds.x), y: Math.round(bounds.y), ...size }
  const reachable = workAreas.some((area) => {
    const o = overlap(candidate, area)
    return o.w >= Math.min(MIN_VISIBLE, size.width) && o.h >= Math.min(MIN_VISIBLE, size.height)
  })
  return reachable ? candidate : defaultPlacement(primary, size)
}

/** Places a panel (chat) beside the character: left if it fits, else right, clamped to the area. */
export function placeBeside(anchor: Rect, size: { width: number; height: number }, area: Rect): Rect {
  const gap = 12
  const leftX = anchor.x - size.width - gap
  const rightX = anchor.x + anchor.width + gap
  let x = leftX >= area.x ? leftX : rightX
  x = Math.min(Math.max(x, area.x), area.x + area.width - size.width)
  let y = anchor.y + anchor.height - size.height
  y = Math.min(Math.max(y, area.y), area.y + area.height - size.height)
  return { x: Math.round(x), y: Math.round(y), ...size }
}
