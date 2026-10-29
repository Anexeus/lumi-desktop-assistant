import { describe, expect, it } from 'vitest'
import { CHARACTER_EVENTS, initialSnapshot, transition, type CharacterEvent, type CharacterSnapshot } from '../../src/shared/character'

function run(...events: CharacterEvent[]): CharacterSnapshot {
  return events.reduce((s, e) => transition(s, e) ?? s, initialSnapshot)
}

describe('character state machine', () => {
  it('runs a normal conversation turn', () => {
    expect(run('listen').state).toBe('LISTENING')
    expect(run('listen', 'think').state).toBe('THINKING')
    expect(run('listen', 'think', 'speak').state).toBe('SPEAKING')
    expect(run('listen', 'think', 'speak', 'done').state).toBe('IDLE')
  })

  it('lets the user interrupt speech by talking', () => {
    expect(run('think', 'speak', 'listen').state).toBe('LISTENING')
  })

  it('ignores events that do not apply', () => {
    expect(transition(initialSnapshot, 'done')).toBeNull()
    expect(transition(initialSnapshot, 'timeout')).toBeNull()
    expect(transition(run('listen'), 'speak')).toBeNull()
    expect(transition(run('listen'), 'notify')).toBeNull() // a notification never cuts into listening
  })

  it('returns from a notification to where it was', () => {
    expect(run('notify', 'timeout').state).toBe('IDLE')
    expect(run('work', 'notify').state).toBe('NOTIFICATION')
    expect(run('work', 'notify', 'timeout').state).toBe('WORKING')
    expect(run('work', 'notify', 'cancel').state).toBe('WORKING')
  })

  it('recovers from errors', () => {
    expect(run('think', 'error').state).toBe('ERROR')
    expect(run('think', 'error', 'timeout').state).toBe('IDLE')
    expect(run('think', 'error', 'listen').state).toBe('LISTENING')
  })

  it('cancel always lands somewhere stable', () => {
    for (const path of [['listen'], ['think'], ['speak'], ['work'], ['error']] as CharacterEvent[][]) {
      expect(['IDLE', 'WORKING']).toContain(run(...path, 'cancel').state)
    }
  })

  it('never throws or produces an unknown state for any event sequence', () => {
    let s = initialSnapshot
    let seed = 7
    for (let i = 0; i < 5000; i++) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      s = transition(s, CHARACTER_EVENTS[seed % CHARACTER_EVENTS.length]!) ?? s
      expect(['IDLE', 'LISTENING', 'THINKING', 'SPEAKING', 'WORKING', 'NOTIFICATION', 'ERROR']).toContain(s.state)
      expect(['IDLE', 'WORKING']).toContain(s.resume)
    }
  })
})
