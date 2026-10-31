import type { CharacterState, Perch } from '@shared/character'
import type { AppState } from '@shared/ipc'
import type { MateClip, MateLibrary, MateSound } from '@shared/mate'
import { createScene } from './scene'
import { createSpeaker } from './speaker'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const api = window.assistant.character
const scene = createScene(canvas)
const speaker = createSpeaker((level) => scene.setMouth(level))

const CLICK_SLOP = 4 // px of movement before a press becomes a drag
const DOUBLE_CLICK_MS = 450 // a second click this soon opens Settings (Windows' default double-click time is 500 ms)
const KEY_RESIZE_STEP = 0.1
const SLEEP_AFTER_MS = 3 * 60_000 // no cursor movement, clicks or chat for this long and she naps
// Cute lines for little moments. Windows voices say "Hee hee" more clearly than "Hehe".
const TAP_LINES = ['Hi hi!', 'Yay!', 'Hee hee!']
const PERCH_LINES: Partial<Record<Perch, string>> = { sit: 'Hee hee!', left: 'Peekaboo!', right: 'Peekaboo!', fall: 'Whoa!' }
const pick = (lines: string[]): string => lines[Math.floor(Math.random() * lines.length)]!

let interactive = false
let mode: 'idle' | 'pressing' | 'dragging' = 'idle'
let droppedAt = -Infinity // when she was last put down, so "Peekaboo!" follows a drop, not a restart
let clickedAt = -Infinity
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

// Mate Engine material the user imported: its clips play her body, its sounds her reactions (ADR-075).
let mateKey = ''
let library: MateLibrary | null = null
const clipCache = new Map<string, Promise<MateClip>>()
const soundCache = new Map<string, Promise<Uint8Array>>()
function loadClip(id: string): Promise<MateClip> {
  let clip = clipCache.get(id)
  if (!clip) clipCache.set(id, (clip = window.assistant.mate.clip(id).then((json) => JSON.parse(json) as MateClip)))
  return clip
}
async function applyMate(state: AppState): Promise<void> {
  const male = /^male/.test(state.voice.voice) // a male character's voice picks Mate Engine's male animations
  const key = `${state.mate.revision}|${state.mate.clips}|${male}`
  if (key === mateKey) return
  const reload = !mateKey.startsWith(`${state.mate.revision}|`)
  mateKey = key
  if (reload) {
    clipCache.clear()
    soundCache.clear()
    library = state.mate.clips ? await window.assistant.mate.library().catch(() => null) : null
  }
  scene.setMate(library ? { library, load: loadClip, male, played: (role, id) => (document.body.dataset['mate'] = `${role}:${id}`) } : null)
  if (!library) document.body.dataset['mate'] = ''
}
/** Plays one of Mate Engine's sounds for this moment; false when there is none (she says a line instead). */
function mateSound(kind: MateSound): boolean {
  const ids = library?.sounds[kind]
  if (!ids?.length) return false
  const id = ids[Math.floor(Math.random() * ids.length)]!
  let bytes = soundCache.get(id)
  if (!bytes) soundCache.set(id, (bytes = window.assistant.mate.sound(id)))
  void bytes.then((b) => speaker.sound(b)).catch(() => {})
  return true
}

// Stroking her head with the cursor is a head pat: she leans into it, smiling, for as long as the strokes continue.
let petted = false
let pettedAt = -Infinity
let headSince = -1 // when the cursor started moving over her head; a quick pass on the way elsewhere is not a pat
let petTimer = 0
function setPetted(next: boolean): void {
  if (next === petted) return
  petted = next
  scene.setPetted(next)
  document.body.dataset['petted'] = String(next)
  if (!next) return
  wake()
  if (performance.now() - pettedAt > 10_000 && !mateSound('pat')) speaker.exclaim('Hee hee!')
  pettedAt = performance.now()
}
function strokeHead(): void {
  const now = performance.now()
  if (headSince < 0) headSince = now
  clearTimeout(petTimer)
  petTimer = window.setTimeout(() => {
    headSince = -1
    setPetted(false)
  }, 700)
  if (now - headSince > 300) setPetted(true)
}

// Left alone, she naps; any activity wakes her with a stretch.
let activeAt = performance.now()
let asleep = false
let character: CharacterState = 'IDLE'
function wake(): void {
  activeAt = performance.now()
  if (!asleep) return
  asleep = false
  scene.setAsleep(false)
  document.body.dataset['asleep'] = 'false'
  scene.play(perch === 'none' ? 'stretch' : 'nod') // perched, her arms are busy
}
setInterval(() => {
  if (asleep || character !== 'IDLE' || mode !== 'idle' || performance.now() - activeAt < SLEEP_AFTER_MS) return
  asleep = true
  scene.setAsleep(true)
  document.body.dataset['asleep'] = 'true'
}, 5000)

/** Ends a press or drag. Also runs when the release was never delivered, so the window can't stay click-blocking. */
function endPress(): void {
  if (mode === 'dragging') {
    api.dragEnd()
    scene.setHeld(false)
    mateSound('drop')
    droppedAt = performance.now()
  }
  mode = 'idle'
}

// Mouse moves are forwarded even while the window ignores clicks, so hover can be hit-tested.
window.addEventListener('mousemove', (e) => {
  if (mode !== 'idle' && e.buttons === 0) endPress() // the button was released somewhere we didn't hear about
  if (mode !== 'idle') return
  setInteractive(scene.hitTest(e.clientX, e.clientY) || performance.now() < wheelUntil)
  if (scene.overHead(e.clientX, e.clientY)) strokeHead()
})
document.addEventListener('mouseleave', () => mode === 'idle' && setInteractive(false))

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !scene.hitTest(e.clientX, e.clientY)) return
  wake()
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
    if (!mateSound('grab')) speaker.exclaim('Wheee!')
  }
  if (mode === 'dragging') {
    api.dragMove(e.screenX, e.screenY)
    scene.nudge(e.screenX - lastX, e.screenY - lastY)
    lastX = e.screenX
    lastY = e.screenY
  }
})

canvas.addEventListener('pointerup', (e) => {
  // One click: she waves with a cute line. A double click opens Settings. The menu is on right-click only.
  if (mode === 'pressing') {
    const now = performance.now()
    if (now - clickedAt < DOUBLE_CLICK_MS) {
      clickedAt = -Infinity
      void window.assistant.openWindow('settings')
    } else {
      clickedAt = now
      scene.play('wave')
      if (!mateSound('laugh')) speaker.exclaim(pick(TAP_LINES))
    }
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
    wake()
    wheelUntil = performance.now() + 700
    scaleBy(-(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) * WHEEL_RATE) // some mice report lines, not pixels
  },
  { passive: false }
)

canvas.addEventListener('keydown', (e) => {
  wake()
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
  scene.setPerch(state.perch)
  speaker.onState(state)
  void applyMate(state)
  scene.setDancing(state.dancing)
  document.body.dataset['dancing'] = String(state.dancing)
  document.body.dataset['state'] = state.character
  document.body.dataset['perch'] = state.perch
  character = state.character
  if (character !== 'IDLE') wake() // a question, a reply or a notification
  if (state.perch !== perch) {
    perch = state.perch
    wake()
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
api.onCursor((x, y) => {
  scene.lookAtCursor(x, y)
  wake() // main sends only moves
})

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
