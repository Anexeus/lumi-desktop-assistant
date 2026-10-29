import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Timer,
  Vector2,
  WebGLRenderer
} from 'three'

// Placeholder character for Milestone 1: proves transparency, hit-testing and idle motion.
// Replaced by a VRM model behind the same surface (hitTest/resize/dispose) in Milestone 2.

const FRAME_MS = 1000 / 30 // idle budget: 30 fps is plenty for a bobbing character

export interface CharacterScene {
  hitTest(clientX: number, clientY: number): boolean
  dispose(): void
}

export function createScene(canvas: HTMLCanvasElement): CharacterScene {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(30, 1, 0.1, 20)
  camera.position.set(0, 0.15, 4.2)

  scene.add(new AmbientLight(0xffffff, 1.4))
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(1.5, 2, 3)
  scene.add(key)

  const character = new Group()
  const body = new Mesh(
    new SphereGeometry(0.62, 48, 32),
    new MeshStandardMaterial({ color: 0x7c6cf0, roughness: 0.45, metalness: 0.05 })
  )
  body.scale.set(1, 1.08, 0.92)
  const eyeGeometry = new SphereGeometry(0.075, 24, 16)
  const eyeMaterial = new MeshStandardMaterial({ color: 0x1b1830, roughness: 0.2 })
  const eyes = [-0.2, 0.2].map((x) => {
    const eye = new Mesh(eyeGeometry, eyeMaterial)
    eye.position.set(x, 0.12, 0.54)
    character.add(eye)
    return eye
  })
  character.add(body)
  scene.add(character)

  const resize = (): void => {
    const { clientWidth: w, clientHeight: h } = canvas
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  const timer = new Timer()
  timer.connect(document) // pauses elapsed time while the page is hidden
  let nextBlink = 2 + Math.random() * 3
  let blinkStart = -1
  let last = 0
  let frame = 0

  const tick = (now: number): void => {
    frame = requestAnimationFrame(tick)
    if (now - last < FRAME_MS) return
    last = now
    timer.update(now)
    const t = timer.getElapsed()
    character.position.y = Math.sin(t * 1.6) * 0.04
    character.rotation.z = Math.sin(t * 0.8) * 0.03
    body.scale.y = 1.08 + Math.sin(t * 1.6 + Math.PI / 2) * 0.012 // breathing

    if (blinkStart < 0 && t >= nextBlink) blinkStart = t
    if (blinkStart >= 0) {
      const p = (t - blinkStart) / 0.14
      const open = p >= 1 ? 1 : Math.abs(1 - 2 * p) // 1 → 0 → 1
      for (const eye of eyes) eye.scale.y = Math.max(0.1, open)
      if (p >= 1) {
        blinkStart = -1
        nextBlink = t + 2.5 + Math.random() * 4
      }
    }
    renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(tick)

  const raycaster = new Raycaster()
  const ndc = new Vector2()

  return {
    hitTest(clientX, clientY) {
      ndc.set((clientX / canvas.clientWidth) * 2 - 1, -(clientY / canvas.clientHeight) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return raycaster.intersectObject(character, true).length > 0
    },
    dispose() {
      cancelAnimationFrame(frame)
      timer.dispose()
      window.removeEventListener('resize', resize)
      renderer.dispose()
    }
  }
}
