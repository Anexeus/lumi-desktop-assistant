import { copyFile, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

// Access to folders the user approved (writes only through the approval prompt). Every path is resolved (symlinks and junctions
// included) and must stay inside an approved folder.

const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '__pycache__', '.venv', 'dist', 'out', 'build', '$RECYCLE.BIN'])
const TEXT_EXT = /\.(txt|md|markdown|json|jsonc|ya?ml|toml|ini|cfg|conf|csv|tsv|log|xml|html?|css|scss|less|js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|cs|cpp|cc|c|h|hpp|php|sh|ps1|bat|cmd|sql|env\.example|gitignore|vue|svelte|lua|r|swift|dart)$/i
const MAX_READ_BYTES = 200 * 1024
const MAX_WRITE_BYTES = 1024 * 1024
const MAX_SCAN_FILES = 5000
const MAX_RESULTS = 40
const SCAN_BUDGET_MS = 3000

/** Rejects device and UNC paths outright ("\\\\server\\x", "\\\\?\\C:", "\\\\.\\pipe"). */
const unsafePath = (p: string): boolean => /^\\\\|^\/\//.test(p) || p.includes('\0')

async function within(roots: string[], candidate: string): Promise<string | null> {
  if (unsafePath(candidate)) return null
  for (const root of roots) {
    const target = isAbsolute(candidate) ? candidate : join(root, candidate)
    let real: string
    try {
      real = await realpath(target)
    } catch {
      continue
    }
    const realRoot = await realpath(root).catch(() => resolve(root))
    const rel = relative(realRoot, real)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('..'))) return real
  }
  return null
}

export interface SearchHit {
  path: string
  line?: number
  text?: string
}

export function createScopedFiles(roots: () => string[]) {
  return {
    /** Files whose name or text contains every word of the query, newest-found first. */
    async search(query: string, signal?: AbortSignal): Promise<{ hits: SearchHit[]; scanned: number; truncated: boolean }> {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean)
      if (!words.length) return { hits: [], scanned: 0, truncated: false }
      const hits: SearchHit[] = []
      let scanned = 0
      const deadline = Date.now() + SCAN_BUDGET_MS
      const stopped = (): boolean => !!signal?.aborted || Date.now() > deadline || scanned >= MAX_SCAN_FILES || hits.length >= MAX_RESULTS

      for (const root of roots()) {
        const realRoot = await realpath(root).catch(() => null)
        if (!realRoot) continue
        const queue = [realRoot]
        while (queue.length && !stopped()) {
          const dir = queue.shift()!
          let entries
          try {
            entries = await readdir(dir, { withFileTypes: true })
          } catch {
            continue // unreadable folder: skip
          }
          for (const e of entries) {
            if (stopped()) break
            if (e.name.startsWith('.') && e.name !== '.env.example') continue
            const full = join(dir, e.name)
            if (e.isSymbolicLink()) continue // never follow links out of the approved folder
            if (e.isDirectory()) {
              if (!SKIP_DIRS.has(e.name)) queue.push(full)
              continue
            }
            if (!e.isFile()) continue
            scanned++
            const name = e.name.toLowerCase()
            if (words.every((w) => name.includes(w))) {
              hits.push({ path: full })
              continue
            }
            if (!TEXT_EXT.test(e.name)) continue
            try {
              const info = await stat(full)
              if (info.size > MAX_READ_BYTES) continue
              const text = await readFile(full, 'utf8')
              const lower = text.toLowerCase()
              if (!words.every((w) => lower.includes(w))) continue
              const lines = text.split(/\r?\n/)
              const at = lines.findIndex((l) => l.toLowerCase().includes(words[0]!))
              hits.push({ path: full, line: at + 1, text: lines[at]?.trim().slice(0, 200) })
            } catch {
              // unreadable file: skip
            }
          }
        }
      }
      return { hits, scanned, truncated: stopped() && !signal?.aborted }
    },

    /** A text file's contents, if it is inside an approved folder. */
    async read(path: string): Promise<{ path: string; text: string; truncated: boolean }> {
      const real = await within(roots(), path)
      if (!real) throw new Error('That file is not inside a folder you approved (Settings → Tools).')
      const info = await stat(real)
      if (!info.isFile()) throw new Error('That is a folder, not a file.')
      const bytes = await readFile(real)
      if (bytes.subarray(0, 8000).includes(0)) throw new Error('That looks like a binary file, so I can’t read it as text.')
      const truncated = bytes.byteLength > MAX_READ_BYTES
      return { path: real, text: bytes.subarray(0, MAX_READ_BYTES).toString('utf8'), truncated }
    },

    /**
     * Creates or replaces a text/code file inside an approved folder (its folder must already exist there).
     * A replaced file's old contents are copied to `backupDir` first, so every edit can be undone.
     */
    async write(path: string, text: string, backupDir: string): Promise<{ path: string; created: boolean; backup: string | null }> {
      if (Buffer.byteLength(text) > MAX_WRITE_BYTES) throw new Error('That is more than 1 MB of text.')
      if (unsafePath(path)) throw new Error('That path is not allowed.')
      for (const root of roots()) {
        const target = isAbsolute(path) ? path : join(root, path)
        const parent = await within([root], dirname(target))
        if (!parent) continue
        const file = join(parent, basename(target))
        if (!TEXT_EXT.test(file)) throw new Error('Lumi only writes text and code files.')
        const existing = await stat(file).catch(() => null)
        // An existing file must itself resolve inside the folder (a link could point elsewhere).
        if (existing && (!existing.isFile() || !(await within([root], file)))) throw new Error('That path is not a regular file in your folder.')
        let backup: string | null = null
        if (existing) {
          await mkdir(backupDir, { recursive: true })
          backup = join(backupDir, `${Date.now()}-${basename(file)}`)
          await copyFile(file, backup)
        }
        await writeFile(file, text, 'utf8')
        return { path: file, created: !existing, backup }
      }
      throw new Error('That folder is not inside a folder you approved (Settings → Tools), or it does not exist.')
    },

    within: (path: string) => within(roots(), path)
  }
}
