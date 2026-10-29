import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createScopedFiles } from '../../src/main/tools/files'

let root: string
let outside: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'files-root-'))
  outside = mkdtempSync(join(tmpdir(), 'files-outside-'))
  mkdirSync(join(root, 'docs'))
  mkdirSync(join(root, 'node_modules'))
  writeFileSync(join(root, 'docs', 'My Resume 2026.pdf'), 'not text')
  writeFileSync(join(root, 'docs', 'notes.md'), 'Meeting notes\nThe deploy key rotation is on Friday\n')
  writeFileSync(join(root, 'node_modules', 'resume.js'), 'skipped')
  writeFileSync(join(root, 'binary.txt'), Buffer.from([1, 2, 0, 3]))
  writeFileSync(join(outside, 'secret.txt'), 'outside the approved folder')
  try {
    symlinkSync(outside, join(root, 'escape'), 'junction')
  } catch {
    // creating junctions may be unavailable; the traversal tests still run
  }
})

describe('scoped files', () => {
  it('finds files by name and by content, skipping dependency folders', async () => {
    const files = createScopedFiles(() => [root])
    const byName = await files.search('resume')
    expect(byName.hits.map((h) => h.path)).toEqual([join(root, 'docs', 'My Resume 2026.pdf')])
    const byText = await files.search('deploy friday')
    expect(byText.hits[0]).toMatchObject({ path: join(root, 'docs', 'notes.md'), line: 2 })
  })

  it('reads text inside the folder', async () => {
    const files = createScopedFiles(() => [root])
    expect((await files.read(join(root, 'docs', 'notes.md'))).text).toContain('deploy key')
    expect((await files.read('docs/notes.md')).text).toContain('Meeting notes') // relative to the root
  })

  it('refuses paths outside the approved folders, however they are written', async () => {
    const files = createScopedFiles(() => [root])
    for (const p of [join(outside, 'secret.txt'), join(root, '..', 'x'), '../secret.txt', join(root, 'escape', 'secret.txt'), '\\\\server\\share\\x', '\\\\?\\C:\\Windows\\win.ini']) {
      await expect(files.read(p), p).rejects.toThrow()
    }
  })

  it('refuses binary files and returns nothing with no approved folders', async () => {
    await expect(createScopedFiles(() => [root]).read(join(root, 'binary.txt'))).rejects.toThrow(/binary/)
    expect((await createScopedFiles(() => []).search('resume')).hits).toEqual([])
  })
})

describe('scoped write', () => {
  const files = () => createScopedFiles(() => [root])
  const backups = () => join(outside, 'backups')

  it('creates a file, and replaces one after backing up the old version', async () => {
    const created = await files().write('docs/todo.txt', 'buy milk', backups())
    expect(created.created).toBe(true)
    expect(readFileSync(join(root, 'docs', 'todo.txt'), 'utf8')).toBe('buy milk')
    const replaced = await files().write(join(root, 'docs', 'notes.md'), 'new notes', backups())
    expect(replaced.created).toBe(false)
    expect(readFileSync(replaced.backup!, 'utf8')).toContain('Meeting notes')
    expect(readFileSync(join(root, 'docs', 'notes.md'), 'utf8')).toBe('new notes')
  })

  it('refuses anything outside the approved folders, binaries, and missing folders', async () => {
    await expect(files().write(join(outside, 'x.txt'), 'no', backups())).rejects.toThrow(/approved/)
    await expect(files().write('../x.txt', 'no', backups())).rejects.toThrow(/approved/)
    await expect(files().write('docs/app.exe', 'MZ', backups())).rejects.toThrow(/text and code/)
    await expect(files().write('nope/x.txt', 'no', backups())).rejects.toThrow(/approved|exist/)
    await expect(files().write('\\\\server\\share\\x.txt', 'no', backups())).rejects.toThrow(/not allowed/)
    if (existsSync(join(root, 'escape'))) await expect(files().write('escape/secret.txt', 'no', backups())).rejects.toThrow()
    expect(readFileSync(join(outside, 'secret.txt'), 'utf8')).toBe('outside the approved folder')
  })
})
