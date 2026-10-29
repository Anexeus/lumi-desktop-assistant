import { DirectionalLight, AmbientLight, PerspectiveCamera, Scene, Timer, Vector3, WebGLRenderer } from 'three'
import type { CharacterState } from '@shared/character'
import { loadAvatar, type Avatar } from './avatar'
import type { Gesture } from './gestures'

const FRAME_MS = 1000 / 30 // idle budget: 30 fps is plenty for a desktop character
const DEFAULT_MODEL_URL = './models/Seed-san.vrm'

export interface CharacterScene {
  /** True when the pixel under (clientX, clientY) belongs to the character. */
  hitTest(clientX: number, clientY: number): boolean
  /** Loads the user's model bytes, or the bundled default when null. Falls back to the default on failure. */
  setModel(bytes: ArrayBuffer | null): Promise<'custom' | 'default'>
  setState(state: CharacterState): void
  play(gesture: Gesture): void
  /** Mouth openness 0..1 from speech audio, or null for placeholder movement. */
  setMouth(level: number | null): void
  /** Cursor position relative to the window's top-left, in CSS pixels (may be outside the window). */
  lookAtCursor(x: number, y: number): void
  dispose(): void
}

export function createScene(canvas: HTMLCanvasElement): CharacterScene {
  // preserveDrawingBuffer lets hit tests read the last frame's alpha at any time.
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(22, 1, 0.1, 20)
  scene.add(new AmbientLight(0xffffff, 1.6))
  const key = new DirectionalLight(0xffffff, 1.8)
  key.position.set(1, 2, 3)
  scene.add(key)

  let avatar: Avatar | null = null
  let state: CharacterState = 'IDLE'
  let cursor: { x: number; y: number } | null = null
  let mouth: number | null = null
  let loadToken = 0

  const frame = (): void => {
    const { clientWidth: w, clientHeight: h } = canvas
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    if (avatar) {
      // Fit the whole body with a small margin, whichever of height or width is tighter.
      const size = avatar.bounds.getSize(new Vector3())
      const centre = avatar.bounds.getCenter(new Vector3())
      const halfFov = (camera.fov * Math.PI) / 360
      const fitHeight = (size.y * 1.08) / 2 / Math.tan(halfFov)
      const fitWidth = (size.x * 1.15) / 2 / Math.tan(halfFov) / camera.aspect
      camera.position.set(centre.x, centre.y, centre.z + Math.max(fitHeight, fitWidth))
      camera.lookAt(centre)
    }
    camera.updateProjectionMatrix()
  }
  frame()
  window.addEventListener('resize', frame)

  const timer = new Timer()
  timer.connect(document) // pauses elapsed time while the page is hidden
  let last = 0
  let raf = 0
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick)
    if (now - last < FRAME_MS) return
    last = now
    timer.update(now)
    avatar?.update(Math.min(timer.getDelta(), 0.1), timer.getElapsed())
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(tick)

  async function use(source: ArrayBuffer | string): Promise<void> {
    const token = ++loadToken
    const next = await loadAvatar(source, camera)
    // Compile shaders off the main thread where supported, so swapping models does not freeze the window.
    await renderer.compileAsync(next.vrm.scene, camera, scene)
    if (token !== loadToken) return next.dispose() // a newer load won
    if (avatar) {
      scene.remove(avatar.vrm.scene)
      avatar.dispose()
    }
    avatar = next
    avatar.setState(state)
    avatar.setMouth(mouth)
    scene.add(avatar.vrm.scene)
    frame()
    applyGaze()
    renderer.render(scene, camera) // so the model is on screen before setModel resolves
  }

  const gl = renderer.getContext()
  const pixel = new Uint8Array(4)
  const ndc = new Vector3()

  return {
    hitTest(clientX, clientY) {
      const dpr = renderer.getPixelRatio()
      const x = Math.floor(clientX * dpr)
      const y = Math.floor((canvas.clientHeight - clientY) * dpr)
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      return pixel[3]! > 16
    },
    async setModel(bytes) {
      if (bytes) {
        try {
          await use(bytes)
          return 'custom'
        } catch (error) {
          console.error('Could not load the custom model, using the default', error)
        }
      }
      await use(DEFAULT_MODEL_URL)
      return 'default'
    },
    setState(next) {
      state = next
      avatar?.setState(next)
      applyGaze()
    },
    play(gesture) {
      avatar?.play(gesture)
    },
    setMouth(level) {
      mouth = level
      avatar?.setMouth(level)
    },
    lookAtCursor(x, y) {
      cursor = { x, y }
      applyGaze()
    },
    dispose() {
      cancelAnimationFrame(raf)
      timer.dispose()
      window.removeEventListener('resize', frame)
      avatar?.dispose()
      renderer.dispose()
    }
  }

  function applyGaze(): void {
    if (!avatar) return
    const b = avatar.bounds
    if (state === 'THINKING') return avatar.lookAt(new Vector3(b.max.x + 0.4, b.max.y + 0.4, b.max.z + 0.5)) // up, aside
    if (!cursor) return avatar.lookAt(null)
    // Project the cursor onto a plane at the face's depth.
    ndc.set((cursor.x / canvas.clientWidth) * 2 - 1, -(cursor.y / canvas.clientHeight) * 2 + 1, 0.5).unproject(camera)
    const dir = ndc.sub(camera.position).normalize()
    const distance = camera.position.z - b.max.z
    avatar.lookAt(camera.position.clone().add(dir.multiplyScalar(distance / Math.max(0.2, -dir.z))))
  }
}
