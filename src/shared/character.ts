// Character state machine. Pure (no DOM, no three) so main, renderers and tests share it.

export type CharacterState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'WORKING' | 'NOTIFICATION' | 'ERROR'

/** Inputs from the app. `done` ends the current activity; `timeout` ends a transient state. */
export const CHARACTER_EVENTS = ['listen', 'think', 'speak', 'work', 'done', 'notify', 'error', 'cancel', 'timeout'] as const
export type CharacterEvent = (typeof CHARACTER_EVENTS)[number]

export interface CharacterSnapshot {
  state: CharacterState
  /** Where NOTIFICATION returns to (IDLE or WORKING). */
  resume: 'IDLE' | 'WORKING'
}

/** Transient states end on their own after this long (the driver sends `timeout`). */
export const TRANSIENT_MS: Partial<Record<CharacterState, number>> = { NOTIFICATION: 4000, ERROR: 3000 }

type Target = CharacterState | 'RESUME'

// Anything not listed is ignored, so a late or duplicate event can never start a conflicting animation.
const table: Record<CharacterState, Partial<Record<CharacterEvent, Target>>> = {
  IDLE: { listen: 'LISTENING', think: 'THINKING', speak: 'SPEAKING', work: 'WORKING', notify: 'NOTIFICATION', error: 'ERROR' },
  LISTENING: { think: 'THINKING', done: 'IDLE', cancel: 'IDLE', error: 'ERROR' },
  THINKING: { speak: 'SPEAKING', work: 'WORKING', listen: 'LISTENING', done: 'IDLE', cancel: 'IDLE', error: 'ERROR' },
  SPEAKING: { listen: 'LISTENING', think: 'THINKING', work: 'WORKING', done: 'IDLE', cancel: 'IDLE', error: 'ERROR' },
  // After a tool runs, the model thinks again before answering.
  WORKING: { speak: 'SPEAKING', think: 'THINKING', notify: 'NOTIFICATION', done: 'IDLE', cancel: 'IDLE', error: 'ERROR' },
  NOTIFICATION: {
    timeout: 'RESUME',
    cancel: 'RESUME',
    listen: 'LISTENING',
    think: 'THINKING',
    speak: 'SPEAKING',
    work: 'WORKING',
    error: 'ERROR'
  },
  ERROR: { timeout: 'IDLE', cancel: 'IDLE', listen: 'LISTENING', think: 'THINKING' }
}

export const initialSnapshot: CharacterSnapshot = { state: 'IDLE', resume: 'IDLE' }

/** How the character is placed: standing, peeking in from the left or right screen edge, sitting on a window or the taskbar, falling. */
export type Perch = 'none' | 'left' | 'right' | 'sit' | 'fall'

/** Where her hips are while she sits on a window's top edge, as a fraction of her window height from the top. */
export const SEAT_LINE = 0.62

/** Returns the next snapshot, or null when the event is not valid in the current state. */
export function transition(current: CharacterSnapshot, event: CharacterEvent): CharacterSnapshot | null {
  const target = table[current.state][event]
  if (!target) return null
  if (target === 'RESUME') return { state: current.resume, resume: 'IDLE' }
  const resume = target === 'NOTIFICATION' ? (current.state === 'WORKING' ? 'WORKING' : 'IDLE') : current.resume
  return { state: target, resume }
}
