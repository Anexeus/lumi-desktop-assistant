import type { AppState } from '@shared/ipc'
import { createScene } from './scene'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const grip = document.getElementById('grip') as HTMLDivElement
const api = window.assistant.character
const scene = createScene(canvas)

const CLICK_SLOP = 4 // px of movement before a press becomes a drag
const KEY_RESIZE_STEP = 0.1

let interactive = false
let mode: 'idle' | 'pressing' | 'dragging' | 'resizing' = 'idle'
let pressX = 0
let pressY = 0
let startSize = { width: 0, height: 0 }

function setInteractive(next: boolean): void {
  if (next === interactive) return
  interactive = next
  document.body.classList.toggle('hover', next)
  api.setIgnoreMouse(!next)
}

// Mouse moves are forwarded even while the window ignores clicks, so hover can be hit-tested.
window.addEventListener('mousemove', (e) => {
  if (mode !== 'idle') return
  const overGrip = (e.target as Element | null)?.closest('[data-interactive]') != null
  setInteractive(overGrip || scene.hitTest(e.clientX, e.clientY))
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
  }
  if (mode === 'dragging') api.dragMove(e.screenX, e.screenY)
})

canvas.addEventListener('pointerup', (e) => {
  canvas.releasePointerCapture(e.pointerId)
  if (mode === 'pressing') void window.assistant.openWindow('chat')
  if (mode === 'dragging') api.dragEnd()
  mode = 'idle'
})

// Right-clicks only arrive over the body (elsewhere they pass through), and Chromium also
// fires this for Shift+F10 and the Menu key, so no hit test is needed here.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  api.showMenu()
})

grip.addEventListener('pointerdown', (e) => {
  grip.setPointerCapture(e.pointerId)
  mode = 'resizing'
  document.body.classList.add('resizing')
  pressX = e.screenX
  pressY = e.screenY
  startSize = { width: window.innerWidth, height: window.innerHeight }
})

grip.addEventListener('pointermove', (e) => {
  if (mode !== 'resizing') return
  api.resize(Math.round(startSize.width + e.screenX - pressX), Math.round(startSize.height + e.screenY - pressY))
})

grip.addEventListener('pointerup', (e) => {
  grip.releasePointerCapture(e.pointerId)
  if (mode === 'resizing') api.resizeEnd()
  document.body.classList.remove('resizing')
  mode = 'idle'
})

canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void window.assistant.openWindow('chat')
  } else if (e.key === '+' || e.key === '=' || e.key === '-') {
    const factor = e.key === '-' ? 1 - KEY_RESIZE_STEP : 1 + KEY_RESIZE_STEP
    api.resize(Math.round(window.innerWidth * factor), Math.round(window.innerHeight * factor))
    api.resizeEnd()
  }
})

// data-model / data-state mirror what is on screen (used by E2E tests and handy in DevTools).
let modelRevision = -1
async function loadModel(): Promise<void> {
  document.body.dataset['model'] = 'loading'
  try {
    const bytes = await window.assistant.model.get()
    const buffer = bytes ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer) : null
    document.body.dataset['model'] = await scene.setModel(buffer)
  } catch (error) {
    console.error('Could not load the character model', error)
    document.body.dataset['model'] = 'error'
    void window.assistant.characterEvent('error')
  }
}

function applyState(state: AppState): void {
  scene.setState(state.character)
  document.body.dataset['state'] = state.character
  if (state.model.revision !== modelRevision) {
    modelRevision = state.model.revision
    void loadModel()
  }
}

void window.assistant.getState().then(applyState)
window.assistant.onState(applyState)
api.onCursor((x, y) => scene.lookAtCursor(x, y))

window.addEventListener('beforeunload', () => scene.dispose())
