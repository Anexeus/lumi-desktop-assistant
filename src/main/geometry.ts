// Pure window-geometry helpers (no Electron imports) so they can be unit tested.
import { SEAT_LINE } from '@shared/character'

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

const PEEK_ZONE = 0.25 // drop her centre this close to an outer screen edge (× her width) and she peeks in from it
const PEEK_PAST = 0.12 // her centre ends past the edge: only her leaning head and shoulder show
const FEET_LINE = 0.96 // her feet, as a fraction of her window height from the top

/**
 * Peeking in from the left or right edge of `display` (its full bounds) when she was dropped close to it, unless another
 * display continues past that edge (there she would just show up on the next screen).
 */
export function peekPlacement(b: Rect, display: Rect, others: Rect[]): { side: 'left' | 'right'; bounds: Rect } | null {
  const cx = b.x + b.width / 2
  const midY = b.y + b.height / 2
  const continues = (x: number): boolean => others.some((d) => x >= d.x && x < d.x + d.width && midY >= d.y && midY < d.y + d.height)
  if (cx < display.x + b.width * PEEK_ZONE && !continues(display.x - 1)) {
    return { side: 'left', bounds: { ...b, x: Math.round(display.x - b.width * (0.5 + PEEK_PAST)) } }
  }
  const right = display.x + display.width
  if (cx > right - b.width * PEEK_ZONE && !continues(right)) {
    return { side: 'right', bounds: { ...b, x: Math.round(right - b.width * (0.5 - PEEK_PAST)) } }
  }
  return null
}

/** An app window as the desktop helper reports it, converted to DIPs. */
export interface Frame {
  handle: number
  rect: Rect
  maximized: boolean
}

const contains = (r: Rect, x: number, y: number): boolean => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height

/** Her bounds while sitting on `top` (a window's top edge): hips on the edge, legs over the front. */
export function seatedBounds(b: Rect, top: number): Rect {
  return { ...b, y: Math.round(top - b.height * SEAT_LINE) }
}

/** False when sitting there would put her head above the work area (e.g. a maximised window). */
export function canSit(b: Rect, frame: Frame, area: Rect): boolean {
  return !frame.maximized && seatedBounds(b, frame.rect.y).y >= area.y - b.height * 0.1
}

/**
 * The window to sit on after a drop: the topmost one whose top edge lies between her hips and feet under her centre,
 * where that edge isn't hidden by a window above it. `frames` is topmost first.
 */
export function seatPlacement(b: Rect, frames: Frame[], area: Rect): { frame: Frame; bounds: Rect } | null {
  const cx = b.x + b.width / 2
  const hips = b.y + b.height * SEAT_LINE
  const feet = b.y + b.height * FEET_LINE
  for (const [i, frame] of frames.entries()) {
    const r = frame.rect
    if (cx < r.x + 24 || cx > r.x + r.width - 24 || r.y < hips - 24 || r.y > feet + 40) continue
    if (frames.slice(0, i).some((above) => contains(above.rect, cx, r.y + 2))) continue
    if (canSit(b, frame, area)) return { frame, bounds: seatedBounds(b, r.y) }
  }
  return null
}
