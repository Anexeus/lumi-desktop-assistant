// Lumi's own local AI, no Ollama needed: bundled llama.cpp (chat) and whisper.cpp (speech-to-text) servers on
// 127.0.0.1 with random ports, plus model files downloaded on first use. Only Lumi starts or stops these processes.
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import type { LocalModel } from '@shared/localModels'
import type { LocalServerStatus } from '@shared/ipc'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Words whisper should expect: names, apps and coding terms it otherwise mishears. */
const VOCABULARY = 'Lumi, VS Code, Visual Studio Code, npm, Node.js, TypeScript, JavaScript, React, Electron, GitHub, PowerShell, YouTube, Notepad, Chrome, terminal, localhost.'

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

/**
 * Downloads a model into `dir`, resuming a previous partial download, trying each mirror, retrying network errors,
 * and accepting the file only if its size and SHA-256 match. Returns the final path. Cancel with `signal`.
 */
export async function downloadModel(
  m: LocalModel,
  dir: string,
  onProgress: (received: number) => void,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  await mkdir(dir, { recursive: true })
  const file = join(dir, m.file)
  const part = `${file}.part`
  if (existsSync(file)) return file
  const finish = async (): Promise<string> => {
    if ((await sha256File(part)) !== m.sha256) {
      await rm(part, { force: true })
      throw new Error('The downloaded file is damaged (checksum mismatch). Try again.')
    }
    await rename(part, file)
    return file
  }
  let lastError: unknown
  for (const url of m.urls) {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (signal.aborted) throw new Error('Canceled.')
      let have = (await stat(part).catch(() => null))?.size ?? 0
      if (have > m.size) {
        await rm(part, { force: true })
        have = 0
      }
      if (have === m.size) return finish()
      try {
        const res = await fetchImpl(url, { headers: have ? { Range: `bytes=${have}-` } : {}, signal })
        if (have && res.status === 200) await rm(part, { force: true }) // the server ignored the range: start over
        else if (res.status !== 200 && res.status !== 206) throw new Error(`HTTP ${res.status}`)
        let received = res.status === 206 ? have : 0
        const out = createWriteStream(part, { flags: res.status === 206 ? 'a' : 'w' })
        try {
          for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
            received += chunk.byteLength
            if (!out.write(chunk)) await once(out, 'drain')
            onProgress(received)
          }
        } finally {
          await new Promise<void>((resolve) => out.end(() => resolve()))
        }
        if (received !== m.size) throw new Error('The connection dropped.')
        return await finish()
      } catch (error) {
        if (signal.aborted) throw new Error('Canceled.', { cause: error })
        if (error instanceof Error && error.message.startsWith('The downloaded file is damaged')) throw error
        lastError = error
        await sleep(1500 * (attempt + 1))
      }
    }
  }
  throw new Error(`Could not download ${m.name}: ${lastError instanceof Error ? lastError.message : String(lastError)}. Partial data is kept, so trying again resumes.`)
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })
}

// Integrated GPUs report shared system RAM as their memory, so size alone would pick them over a real GPU.
const INTEGRATED = /Intel\(R\) (UHD|HD|Iris)|Intel\(R\) Graphics|Radeon\(TM\) Graphics|Microsoft Basic/i

/** The best GPU from `llama-server --list-devices`: a dedicated one first, then the most memory. */
export function pickDevice(listing: string): { id: string; name: string } | null {
  let best: { id: string; name: string; score: number } | null = null
  for (const m of listing.matchAll(/^\s*(\w+\d+):\s*(.+?)\s*\((\d+) MiB/gm)) {
    const score = Number(m[3]) + (INTEGRATED.test(m[2]!) ? 0 : 1_000_000)
    if (!best || score > best.score) best = { id: m[1]!, name: m[2]!, score }
  }
  return best && { id: best.id, name: best.name }
}

const listDevices = (exe: string): Promise<string> =>
  new Promise((resolve) => execFile(exe, ['--list-devices'], { windowsHide: true, timeout: 20_000 }, (_e, out, err) => resolve(`${out}\n${err}`)))

/** One bundled server process (chat or speech-to-text), started on demand and reused while the model is the same. */
export class LocalServer {
  status: LocalServerStatus = { state: 'stopped', device: null, message: '' }
  private proc: ChildProcess | undefined
  private url: string | undefined
  private model: string | undefined
  private starting: Promise<string> | undefined
  /** Required by the chat server on every request, so other programs on this PC can't use it. */
  readonly key = randomBytes(16).toString('hex')

  constructor(
    private readonly kind: 'llm' | 'stt',
    private readonly exe: () => string,
    private readonly onStatus: () => void
  ) {}

  /** Starts (or reuses) the server for this model file and resolves to its OpenAI-style base URL (…/v1). */
  ensure(modelPath: string): Promise<string> {
    if (this.url && this.model === modelPath && this.proc?.exitCode === null) return Promise.resolve(this.url)
    if (this.starting && this.model === modelPath) return this.starting
    this.stop()
    this.model = modelPath
    this.starting = this.start(modelPath).finally(() => (this.starting = undefined))
    return this.starting
  }

  stop(): void {
    const proc = this.proc
    this.proc = undefined
    this.url = undefined
    proc?.kill()
    if (this.status.state !== 'error') this.set({ state: 'stopped', device: null, message: '' })
  }

  private set(status: LocalServerStatus): void {
    this.status = status
    this.onStatus()
  }

  private fail(message: string): Error {
    this.set({ state: 'error', device: this.status.device, message })
    return new Error(message)
  }

  private async start(modelPath: string): Promise<string> {
    const exe = this.exe()
    if (!existsSync(exe)) throw this.fail('Lumi’s local AI engine is missing from this install. Reinstall Lumi (in development: npm run runtimes).')
    if (!existsSync(modelPath)) throw this.fail('The model is not downloaded yet. Download it in Settings → AI.')
    const device = this.kind === 'llm' ? pickDevice(await listDevices(exe)) : null
    try {
      return await this.launch(exe, modelPath, device)
    } catch (error) {
      if (!device) throw error
      // The GPU path failed (driver, memory): the CPU is slower but works everywhere.
      return this.launch(exe, modelPath, null)
    }
  }

  private async launch(exe: string, modelPath: string, device: { id: string; name: string } | null): Promise<string> {
    const port = await freePort()
    const common = ['-m', modelPath, '--host', '127.0.0.1', '--port', String(port)]
    const args =
      this.kind === 'llm'
        ? // Thinking off (Qwen3's template switch): multi-step desktop tasks were ~5× slower with reasoning, for little gain.
          [...common, '-c', '8192', '--chat-template-kwargs', '{"enable_thinking":false}', ...(device ? ['--device', device.id] : ['--device', 'none'])]
        : [...common, '--inference-path', '/v1/audio/transcriptions', '-l', 'en', '-t', String(Math.min(8, availableParallelism())), '--prompt', VOCABULARY]
    this.set({ state: 'starting', device: device?.name ?? 'CPU', message: 'Loading the model…' })
    const proc = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LLAMA_API_KEY: this.key } })
    this.proc = proc
    let log = ''
    const collect = (d: Buffer): void => void (log = (log + d.toString()).slice(-4000))
    proc.stdout?.on('data', collect)
    proc.stderr?.on('data', collect)
    proc.on('error', () => {}) // reported through the exit check below
    proc.on('exit', (code) => {
      if (this.proc !== proc) return
      this.proc = undefined
      this.url = undefined
      this.set(code ? { state: 'error', device: this.status.device, message: `The local AI stopped unexpectedly (code ${code}).` } : { state: 'stopped', device: null, message: '' })
    })
    const base = `http://127.0.0.1:${port}`
    const deadline = Date.now() + 240_000
    while (Date.now() < deadline) {
      if (proc.exitCode !== null || proc.killed) {
        const reason = log.trim().split(/\r?\n/).filter((l) => /error|fail|unable|cannot/i.test(l)).at(-1) ?? 'it exited'
        throw this.fail(`The local AI could not start: ${reason.slice(0, 200)}`)
      }
      if (await this.ready(base)) {
        this.url = `${base}/v1`
        this.set({ state: 'ready', device: device?.name ?? 'CPU', message: '' })
        return this.url
      }
      await sleep(400)
    }
    proc.kill()
    throw this.fail('The local AI took too long to load.')
  }

  private async ready(base: string): Promise<boolean> {
    try {
      // llama-server answers /health with 200 once the model is loaded (503 while loading); whisper-server loads first.
      const res = await fetch(this.kind === 'llm' ? `${base}/health` : base, { signal: AbortSignal.timeout(1500) })
      return this.kind === 'llm' ? res.ok : true
    } catch {
      return false
    }
  }
}
