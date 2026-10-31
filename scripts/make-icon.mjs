// Renders Lumi's icon, the orb from the UI (src/renderer/ui/orb.css, frozen), into build/icon.png and a multi-size
// PNG-embedded build/icon.ico, so the exe, installer, taskbar, tray and UI all show the same mark.
// Run: npx electron scripts/make-icon.mjs
import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const build = join(import.meta.dirname, '..', 'build')
const CSS = 256
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const html = `<!doctype html><body style="margin:0;background:transparent"><style>
.orb{position:absolute;inset:6px;border-radius:50%;overflow:hidden;isolation:isolate;
  background:radial-gradient(circle at 50% 55%,#2a1f4a,#07050c 72%);box-shadow:inset 0 0 0 4px rgb(255 255 255/24%)}
.orb i{position:absolute;inset:-25%;border-radius:50%;mix-blend-mode:screen;filter:blur(22px)}
.orb i:nth-child(1){background:radial-gradient(circle at 32% 36%,#ff3d9a 0 24%,transparent 50%)}
.orb i:nth-child(2){background:radial-gradient(circle at 68% 42%,#3d8bff 0 26%,transparent 52%)}
.orb i:nth-child(3){background:radial-gradient(circle at 50% 72%,#2ef2c8 0 22%,transparent 48%)}
.orb::after{content:'';position:absolute;inset:0;border-radius:50%;mix-blend-mode:screen;
  background:radial-gradient(circle at 34% 28%,rgb(255 255 255/75%),transparent 30%)}
</style><div class="orb"><i></i><i></i><i></i></div></body>`

/** An ICO whose entries are PNGs (Windows Vista and later). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4) // planes
    header.writeUInt16LE(32, e + 6) // bits per pixel
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...pngs.map((p) => p.data)])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: CSS, height: CSS, show: false, frame: false, transparent: true, backgroundColor: '#00000000', useContentSize: true, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 600)) // let the blurs paint
  const shot = await win.webContents.capturePage()
  const pngs = SIZES.map((size) => ({ size, data: shot.resize({ width: size, height: size, quality: 'best' }).toPNG() }))
  writeFileSync(join(build, 'icon.png'), pngs.at(-1).data)
  writeFileSync(join(build, 'icon.ico'), ico(pngs))
  console.log(`icon.png and icon.ico (${SIZES.join(', ')} px) written from a ${shot.getSize().width} px capture`)
  app.quit()
})
