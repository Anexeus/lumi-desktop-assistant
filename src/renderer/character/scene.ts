import { DirectionalLight, AmbientLight, PerspectiveCamera, Scene, Timer, Vector3, WebGLRenderer } from 'three'
import type { CharacterState, Perch } from '@shared/character'
import type { Graphics } from '@shared/ipc'
import { loadAvatar, type Avatar, type MateSource } from './avatar'
import type { Gesture } from './gestures'

// Graphics presets: render resolution and frame rate (Balanced is the old default budget).
const QUALITY: Record<Graphics, { pixelRatio: number; fps: number }> = {
  low: { pixelRatio: 0.75, fps: 24 },
  balanced: { pixelRatio: 1.5, fps: 30 },
  high: { pixelRatio: 2, fps: 60 }
}

export interface CharacterScene {
  /** True when the pixel under (clientX, clientY) belongs to the character. */
  hitTest(clientX: number, clientY: number): boolean
  /** True when (clientX, clientY) is over her head. */
  overHead(clientX: number, clientY: number): boolean
  setPetted(petted: boolean): void
  setAsleep(asleep: boolean): void
  /** Mate Engine's clips for the body, or null for Lumi's own poses. */
  setMate(source: MateSource | null): void
  setDancing(dancing: boolean): void
  /** Loads the user's model bytes, or the bundled `file` (also the fallback if the bytes don't load). */
  setModel(bytes: ArrayBuffer | null, file: string | null): Promise<'custom' | 'default'>
  setState(state: CharacterState): void
  play(gesture: Gesture): void
  /** Mouth openness 0..1 from speech audio, or null for placeholder movement. */
  setMouth(level: number | null): void
  /** Cursor position relative to the window's top-left, in CSS pixels (may be outside the window). */
  lookAtCursor(x: number, y: number): void
  setHeld(held: boolean): void
  nudge(dx: number, dy: number): void
  setPerch(perch: Perch): void
  /** A jelly wobble when she is resized: + stretches (growing), − squashes (shrinking). */
  bounce(amount: number): void
  setQuality(quality: Graphics): void
  dispose(): void
}

export function createScene(canvas: HTMLCanvasElement): CharacterScene {
  // preserveDrawingBuffer lets hit tests read the last frame's alpha at any time.
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.balanced.pixelRatio))
  let frameMs = 1000 / QUALITY.balanced.fps

  const scene = new Scene()
  const camera = new PerspectiveCamera(22, 1, 0.1, 20)
  scene.add(new AmbientLight(0xffffff, 1.6))
  const key = new DirectionalLight(0xffffff, 1.8)
  key.position.set(1, 2, 3)
  scene.add(key)

  let avatar: Avatar | null = null
  let state: CharacterState = 'IDLE'
  let perch: Perch = 'none'
  let cursor: { x: number; y: number } | null = null
  let mouth: number | null = null
  let petted = false
  let asleep = false
  let mate: MateSource | null = null
  let dancing = false
  let loadToken = 0

  const frame = (): void => {
    const { clientWidth: w, clientHeight: h } = canvas
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    if (avatar) {
      // Fit the whole body, whichever of height or width is tighter, with room above the head and at the sides
      // for raised arms (wave, cheer, stretch) and accessories. The margins are click-through, so they cost nothing.
      const size = avatar.bounds.getSize(new Vector3())
      const centre = avatar.bounds.getCenter(new Vector3())
      centre.x = avatar.body.x // the body in the middle of the window, so peeking and sitting line up for every model
      centre.y += size.y * 0.1 // most of the extra room goes above the head
      const halfFov = (camera.fov * Math.PI) / 360
      const fitHeight = (size.y * 1.3) / 2 / Math.tan(halfFov)
      const halfWidth = Math.max(avatar.bounds.max.x - centre.x, centre.x - avatar.bounds.min.x, size.y * 0.275) // the wider side
      const fitWidth = (halfWidth * 2 * 1.5) / 2 / Math.tan(halfFov) / camera.aspect
      camera.position.set(centre.x, centre.y, centre.z + Math.max(fitHeight, fitWidth))
      camera.lookAt(centre)
    }
    camera.updateProjectionMatrix()
  }
  frame()
  // Draw at the new size right away: a resize clears the canvas, and a cleared canvas both flickers and fails the hit test.
  const onResize = (): void => {
    frame()
    if (avatar) renderer.render(scene, camera)
  }
  window.addEventListener('resize', onResize)

  const timer = new Timer()
  timer.connect(document) // pauses elapsed time while the page is hidden
  let last = 0
  let raf = 0
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick)
    if (now - last < frameMs) return
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
    avatar.setPerch(perch)
    avatar.setMouth(mouth)
    avatar.setPetted(petted)
    avatar.setAsleep(asleep)
    avatar.setMate(mate)
    avatar.setDancing(dancing)
    scene.add(avatar.vrm.scene)
    frame()
    applyGaze()
    renderer.render(scene, camera) // so the model is on screen before setModel resolves
  }

  const gl = renderer.getContext()
  const pixel = new Uint8Array(4)
  const ndc = new Vector3()
  const edge = new Vector3()
  const toClient = (v: Vector3): { x: number; y: number } => ({ x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight })

  return {
    hitTest(clientX, clientY) {
      const dpr = renderer.getPixelRatio()
      const x = Math.floor(clientX * dpr)
      const y = Math.floor((canvas.clientHeight - clientY) * dpr)
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      return pixel[3]! > 16
    },
    overHead(clientX, clientY) {
      const node = avatar?.vrm.humanoid.getRawBoneNode('head')
      if (!node) return false
      // The skull's centre is about 9 cm above the head bone (at the neck), and the head about 12 cm in radius.
      node.getWorldPosition(ndc).y += 0.09
      edge.copy(ndc).x += 0.12
      const centre = toClient(ndc.project(camera))
      const side = toClient(edge.project(camera))
      return Math.hypot(clientX - centre.x, clientY - centre.y) < Math.abs(side.x - centre.x)
    },
    setPetted(next) {
      petted = next
      avatar?.setPetted(next)
    },
    setAsleep(next) {
      asleep = next
      avatar?.setAsleep(next)
    },
    setMate(source) {
      mate = source
      avatar?.setMate(source)
    },
    setDancing(next) {
      dancing = next
      avatar?.setDancing(next)
    },
    async setModel(bytes, file) {
      if (bytes) {
        try {
          await use(bytes)
          return 'custom'
        } catch (error) {
          console.error('Could not load the custom model, using a bundled one', error)
        }
      }
      await use(`./models/${file ?? 'Seed-san.vrm'}`)
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
    setHeld(held) {
      avatar?.setHeld(held)
    },
    nudge(dx, dy) {
      avatar?.nudge(dx, dy)
    },
    setPerch(next) {
      perch = next
      avatar?.setPerch(next)
    },
    bounce(amount) {
      avatar?.bounce(amount)
    },
    setQuality(quality) {
      const q = QUALITY[quality]
      frameMs = 1000 / q.fps
      if (renderer.getPixelRatio() === Math.min(window.devicePixelRatio, q.pixelRatio)) return
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio))
      frame() // re-size the drawing buffer at the new resolution
    },
    dispose() {
      cancelAnimationFrame(raf)
      timer.dispose()
      window.removeEventListener('resize', onResize)
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
    avatar.lookAt(camera.position.clone().add(dir.multiplyScalar(distance / Math.max(0.2, -dir.z))), true)
  }
}
