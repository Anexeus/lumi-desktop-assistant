// Downloads the pinned local-AI runtimes that ship inside Lumi (llama.cpp for chat, whisper.cpp for speech-to-text),
// verifies their SHA-256 against the GitHub release digests, and unpacks them into resources/runtimes/.
// Run once before `npm run dev` or packaging: `npm run runtimes`. Models are not bundled; Lumi downloads them on first use.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RUNTIMES = [
  {
    name: 'llama',
    url: 'https://github.com/ggml-org/llama.cpp/releases/download/b11982/llama-b11982-bin-win-vulkan-x64.zip',
    sha256: '455c401e3a599ea08b5b1263bd994bf035880b8b558454d44a6cd0c3af480bfc',
    exe: 'llama-server.exe'
  },
  {
    name: 'whisper',
    url: 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip',
    sha256: '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb',
    exe: 'whisper-server.exe'
  }
]

const root = join(import.meta.dirname, '..', 'resources', 'runtimes')
for (const r of RUNTIMES) {
  const dir = join(root, r.name)
  const stamp = join(dir, '.source')
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === r.url) {
    console.log(`${r.name}: already present`)
    continue
  }
  console.log(`${r.name}: downloading ${r.url}`)
  const res = await fetch(r.url)
  if (!res.ok) throw new Error(`${r.name}: HTTP ${res.status}`)
  const zip = Buffer.from(await res.arrayBuffer())
  const got = createHash('sha256').update(zip).digest('hex')
  if (got !== r.sha256) throw new Error(`${r.name}: checksum mismatch (got ${got})`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'download.zip')
  writeFileSync(file, zip)
  // Windows' own bsdtar reads zip (a GNU tar from Git would misread "C:" as a remote host).
  execFileSync(join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe'), ['-xf', file, '-C', dir])
  rmSync(file)
  // Some archives nest everything in a folder; Lumi expects the exe at the top.
  const found = execFileSync('cmd', ['/c', 'dir', '/s', '/b', join(dir, r.exe)], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
  if (!found) throw new Error(`${r.name}: ${r.exe} not found in the archive`)
  if (found !== join(dir, r.exe)) {
    const nested = join(found, '..')
    try {
      execFileSync('robocopy', [nested, dir, '/E', '/MOVE', '/NFL', '/NDL', '/NJH', '/NJS'], { stdio: 'ignore' })
    } catch (e) {
      if (e.status >= 8) throw e // robocopy: 1-7 mean files were copied/moved
    }
  }
  // Only the server and its DLLs ship; the archives' other tools would just bloat the installer.
  for (const f of readdirSync(dir)) if (f.endsWith('.exe') && f !== r.exe) rmSync(join(dir, f))
  writeFileSync(stamp, r.url)
  console.log(`${r.name}: ok`)
}
