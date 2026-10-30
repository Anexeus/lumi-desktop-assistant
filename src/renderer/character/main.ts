import type { Perch } from '@shared/character'
import type { AppState } from '@shared/ipc'
import { createScene } from './scene'
import { createSpeaker } from './speaker'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const api = window.assistant.character
const scene = createScene(canvas)
const speaker = createSpeaker((level) => scene.setMouth(level))

const CLICK_SLOP = 4 // px of movement before a press becomes a drag
const KEY_RESIZE_STEP = 0.1
// Cute lines for little moments. Windows voices say "Hee hee" more clearly than "Hehe".
const TAP_LINES = ['Hi hi!', 'Yay!', 'Hee hee!']
const PERCH_LINES: Partial<Record<Perch, string>> = { sit: 'Hee hee!', left: 'Peekaboo!', right: 'Peekaboo!', fall: 'Whoa!' }
const pick = (lines: string[]): string => lines[Math.floor(Math.random() * lines.length)]!

let interactive = false
let mode: 'idle' | 'pressing' | 'dragging' = 'idle'
let droppedAt = -Infinity // when she was last put down, so "Peekaboo!" follows a drop, not a restart
let wheelUntil = 0 // while scrolling, she stays clickable even when the cursor ends up past her shrinking outline
let pressX = 0
let pressY = 0
let lastX = 0
let lastY = 0

function setInteractive(next: boolean): void {
  if (next === interactive) return
  interactive = next
  document.body.classList.toggle('hover', next)
  api.setIgnoreMouse(!next)
}

/** Ends a press or drag. Also runs when the release was never delivered, so the window can't stay click-blocking. */
function endPress(): void {
  if (mode === 'dragging') {
    api.dragEnd()
    scene.setHeld(false)
    droppedAt = performance.now()
  }
  mode = 'idle'
}

// Mouse moves are forwarded even while the window ignores clicks, so hover can be hit-tested.
window.addEventListener('mousemove', (e) => {
  if (mode !== 'idle' && e.buttons === 0) endPress() // the button was released somewhere we didn't hear about
  if (mode !== 'idle') return
  setInteractive(scene.hitTest(e.clientX, e.clientY) || performance.now() < wheelUntil)
})
document.addEventListener('mouseleave', () => mode === 'idle' && setInteractive(false))

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !scene.hitTest(e.clientX, e.clientY)) return
  canvas.setPointerCapture(e.pointerId)
  mode = 'pressing'
  pressX = e.screenX
  pressY = e.screenY
})

canvas.addEventListener('pointermove', (e) => {
  if (mode === 'pressing' && Math.hypot(e.screenX - pressX, e.screenY - pressY) > CLICK_SLOP) {
    mode = 'dragging'
    api.dragStart(pressX, pressY)
    lastX = pressX
    lastY = pressY
    scene.setHeld(true)
    speaker.exclaim('Wheee!')
  }
  if (mode === 'dragging') {
    api.dragMove(e.screenX, e.screenY)
    scene.nudge(e.screenX - lastX, e.screenY - lastY)
    lastX = e.screenX
    lastY = e.screenY
  }
})

canvas.addEventListener('pointerup', (e) => {
  if (mode === 'pressing') {
    scene.play('wave')
    speaker.exclaim(pick(TAP_LINES))
    void window.assistant.openWindow('chat')
  }
  endPress() // before releasing capture, which fires lostpointercapture
  canvas.releasePointerCapture(e.pointerId)
})
canvas.addEventListener('lostpointercapture', endPress)
canvas.addEventListener('pointercancel', endPress)
window.addEventListener('blur', () => mode !== 'idle' && endPress())

// Right-clicks only arrive over the body (elsewhere they pass through), and Chromium also
// fires this for Shift+F10 and the Menu key, so no hit test is needed here.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  api.showMenu()
})

// Scroll over her to resize. The wheel only reaches this window while the cursor is over her: everywhere else the
// window is click-through, so scrolling other apps (or the chat) never resizes her. Notches are eased over a few frames.
const WHEEL_RATE = 0.0012 // one 100-unit notch ≈ 13 %
let pendingScale = 0 // log of the scale still to apply
let scaling = 0
function stepScale(): void {
  const step = pendingScale * 0.35
  pendingScale -= step
  api.scale(Math.exp(step))
  if (Math.abs(pendingScale) > 0.002) scaling = requestAnimationFrame(stepScale)
  else {
    pendingScale = 0
    scaling = 0
    api.resizeEnd() // keeps her on screen and saves the size
  }
}
function scaleBy(logFactor: number): void {
  pendingScale = Math.max(-0.7, Math.min(0.7, pendingScale + logFactor))
  scene.bounce(logFactor)
  if (!scaling) scaling = requestAnimationFrame(stepScale)
}
window.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault() // never page zoom (Ctrl+wheel) or scroll
    if (mode !== 'idle') return
    wheelUntil = performance.now() + 700
    scaleBy(-(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) * WHEEL_RATE) // some mice report lines, not pixels
  },
  { passive: false }
)

canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void window.assistant.openWindow('chat')
  } else if (e.key === '+' || e.key === '=' || e.key === '-') {
    scaleBy(e.key === '-' ? -KEY_RESIZE_STEP : KEY_RESIZE_STEP)
  }
})

// data-model / data-state mirror what is on screen (used by E2E tests and handy in DevTools).
let modelRevision = -1
let modelFile: string | null = null

async function loadModel(changed: boolean): Promise<void> {
  document.body.dataset['model'] = 'loading'
  try {
    const bytes = await window.assistant.model.get()
    const buffer = bytes ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer) : null
    document.body.dataset['model'] = await scene.setModel(buffer, modelFile)
    // Hello on first appearance (quietly: Lumi may start with Windows); a newly picked character cheers "Yay!".
    if (!changed) return scene.play('wave')
    scene.play('cheer')
    speaker.exclaim('Yay!')
  } catch (error) {
    console.error('Could not load the character model', error)
    document.body.dataset['model'] = 'error'
    void window.assistant.characterEvent('error')
  }
}

let perch: Perch = 'none'

function applyState(state: AppState): void {
  scene.setState(state.character)
  scene.setQuality(state.graphics)
  // Sitting, she turns toward the middle of the screen.
  scene.setPerch(state.perch, window.screenX + window.innerWidth / 2 < screen.availWidth / 2 ? 1 : -1)
  speaker.onState(state)
  document.body.dataset['state'] = state.character
  document.body.dataset['perch'] = state.perch
  if (state.perch !== perch) {
    perch = state.perch
    const line = PERCH_LINES[perch]
    if (line && (perch === 'fall' || performance.now() - droppedAt < 6000)) speaker.exclaim(line) // sitting can wait ~2 s for the helper
  }
  if (state.model.revision !== modelRevision) {
    const changed = modelRevision !== -1
    modelRevision = state.model.revision
    modelFile = state.model.file
    void loadModel(changed)
  }
}

void window.assistant.getState().then(applyState)
window.assistant.onState(applyState)
api.onCursor((x, y) => scene.lookAtCursor(x, y))

// Wave back when the user greets her.
const GREETING = /^\s*(hi|hii+|hello|hey|heya|yo|hola|namaste|good (morning|afternoon|evening))\b/i
let lastUserId = 0
window.assistant.chat.onEvent((event) => speaker.onChat(event))
window.assistant.chat.onEvent((event) => {
  if (event.type !== 'snapshot') return
  const user = event.snapshot.items.filter((i) => i.role === 'user').at(-1)
  if (!user || user.id <= lastUserId) return
  lastUserId = user.id
  if (GREETING.test(user.text)) scene.play('wave')
})
// "Yay!" with a little cheer once per request, when something she did for you worked.
let cheeredFor = 0
window.assistant.chat.onEvent((event) => {
  if (event.type !== 'snapshot') return
  const items = event.snapshot.items
  const user = items.filter((i) => i.role === 'user').at(-1)
  if (!user || user.id <= cheeredFor) return
  if (!items.some((i) => i.id > user.id && i.role === 'tool' && i.ok)) return
  cheeredFor = user.id
  scene.play('cheer')
  speaker.exclaim('Yay!')
})
void window.assistant.chat.get().then((s) => (lastUserId = cheeredFor = s.items.at(-1)?.id ?? 0))

if (import.meta.env.DEV) {
  // Dev aid: window.__character.play('stretch') from DevTools.
  ;(window as unknown as { __character: unknown }).__character = { play: scene.play, setMouth: scene.setMouth }
}

window.addEventListener('beforeunload', () => scene.dispose())
