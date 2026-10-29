// Diagnostic log for the installed app (it has no console): warnings, errors and crashes go to
// userData/logs/lumi.log, rotated at 1 MB. Anything that looks like a key or token is masked first.
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { format } from 'node:util'

const MAX_BYTES = 1024 * 1024

/** Masks bearer tokens, API keys and similar secrets in a log line. */
export function redact(text: string): string {
  return text
    .replace(/(Bearer\s+)[\w.~+/-]+=*/gi, '$1[redacted]')
    .replace(/\b(sk-[\w-]{8,}|sk-ant-[\w-]{8,}|gh[pousr]_\w{20,}|github_pat_\w{20,}|AIza[\w-]{30,}|gsk_\w{20,})/g, '[redacted]')
    .replace(/("?(api[_-]?key|token|password|secret)"?\s*[:=]\s*"?)[^\s",}]+/gi, '$1[redacted]')
}

export function startLog(dir: string): string {
  const file = join(dir, 'lumi.log')
  mkdirSync(dir, { recursive: true })
  const write = (level: string, args: unknown[]): void => {
    try {
      if ((statSync(file, { throwIfNoEntry: false })?.size ?? 0) > MAX_BYTES) renameSync(file, `${file}.1`)
      appendFileSync(file, `${new Date().toISOString()} ${level} ${redact(format(...args))}\n`)
    } catch {
      // logging must never take the app down
    }
  }
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      write(level.toUpperCase(), args)
      original(...args)
    }
  }
  process.on('uncaughtException', (error) => write('CRASH', [error]))
  process.on('unhandledRejection', (reason) => write('UNHANDLED', [reason]))
  write('INFO', [`Lumi started (pid ${process.pid})`])
  return file
}
