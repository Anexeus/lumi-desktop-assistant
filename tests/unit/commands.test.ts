import { describe, expect, it } from 'vitest'
import { HELP, runCommand, saveMemory } from '../../src/main/ai/commands'

function recorder() {
  const saved: string[] = []
  return { saved, add: (kind: string, text: string) => saved.push(`${kind}:${text}`) }
}

describe('runCommand', () => {
  it('ignores ordinary messages, including ones that merely mention remembering', () => {
    const { saved, add } = recorder()
    for (const text of ['hello', 'remember when we talked?', 'what is /remember for?', '/rememberance']) {
      expect(runCommand(text, add), text).toBeNull()
    }
    expect(saved).toEqual([])
  })

  it('saves memories and notes', () => {
    const { saved, add } = recorder()
    expect(runCommand('/remember I prefer short answers', add)).toBe('Got it. I’ll remember: I prefer short answers')
    expect(runCommand('/NOTE  buy milk ', add)).toBe('Saved to your notes.')
    expect(saved).toEqual(['memory:I prefer short answers', 'note:buy milk'])
  })

  it('asks for content, shows help, and refuses secrets', () => {
    const { saved, add } = recorder()
    expect(runCommand('/remember', add)).toContain('Tell me what to remember')
    expect(runCommand('/help', add)).toBe(HELP)
    expect(runCommand('/remember my password is hunter2', add)).toContain('won’t save it')
    expect(saved).toEqual([])
  })
})

describe('saveMemory', () => {
  it('validates length and emptiness', () => {
    const { add } = recorder()
    expect(saveMemory(add, 'note', '   ')).toEqual({ ok: false, message: 'There is nothing to save.' })
    expect(saveMemory(add, 'note', 'x'.repeat(1001)).ok).toBe(false)
    expect(saveMemory(add, 'note', 'fine')).toEqual({ ok: true })
  })
})
