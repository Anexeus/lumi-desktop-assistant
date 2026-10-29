import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectsPlugin, resolveProject } from '../../src/main/tools/projects'
import { describeLook } from '../../src/main/tools/desktop'

const root = mkdtempSync(join(tmpdir(), 'approved-'))
const game = join(root, 'my-game')
mkdirSync(game)
writeFileSync(join(game, 'package.json'), JSON.stringify({ scripts: { hello: 'node -e "console.log(\'built ok\')"', broken: 'node -e "process.exit(3)"' } }))
const outside = mkdtempSync(join(tmpdir(), 'outside-'))
writeFileSync(join(outside, 'package.json'), '{}')

const plugin = projectsPlugin(() => [root])
const toolNamed = (name: string) => plugin.tools.find((t) => t.name === name)!

describe('projects', () => {
  it('finds a project inside an approved folder by name, and never outside', () => {
    expect(resolveProject([root], 'my-game').folder).toBe(game)
    expect(Object.keys(resolveProject([root], game).scripts)).toEqual(['hello', 'broken'])
    expect(() => resolveProject([root], outside)).toThrow(/No package.json/)
    expect(() => resolveProject([root], '../outside')).toThrow(/No package.json/)
  })

  it('refuses scripts that package.json does not define', () => {
    const run = toolNamed('project_run')
    expect(run.check!({ project: 'my-game', script: 'rm -rf' })).toMatch(/no “rm -rf” script/)
    expect(run.check!({ project: 'my-game', script: 'hello' })).toBeNull()
  })

  it('runs a script in the project folder and reports exit code and output', async () => {
    const run = toolNamed('project_run')
    const ok = await run.run({ project: 'my-game', script: 'hello' }, new AbortController().signal)
    expect(ok).toContain(`Folder: ${game}`)
    expect(ok).toContain('Exit code: 0 (success)')
    expect(ok).toContain('built ok')
    const bad = await run.run({ project: 'my-game', script: 'broken' }, new AbortController().signal)
    expect(bad).toContain('Exit code: 3 (FAILED)')
  }, 60_000)
})

describe('describeLook', () => {
  it('numbers controls and includes OCR text with positions', () => {
    const text = describeLook({
      window: { handle: 1, title: 'Untitled - Notepad', process: 'Notepad', rect: { x: 0, y: 0, w: 800, h: 600 }, minimized: false },
      elements: [{ n: 1, type: 'Edit', name: 'Text editor', value: 'hello', enabled: true, rect: { x: 0, y: 50, w: 800, h: 500 } }],
      text: [{ text: 'error TS2304', x: 12, y: 300 }]
    })
    expect(text).toContain('Window: “Untitled - Notepad” (Notepad)')
    expect(text).toContain('1. [Edit] Text editor = “hello”')
    expect(text).toContain('- (12,300) error TS2304')
  })
})
