import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { looksSensitive } from '../../src/main/storage/sensitive'
import { openStore } from '../../src/main/storage/store'

let clock = 1_000
const tick = (): number => (clock += 1000)

describe('store', () => {
  it('keeps JSON settings', () => {
    const s = openStore(':memory:', tick)
    expect(s.getJson('missing')).toBeUndefined()
    s.setJson('settings', { a: 1 })
    s.setJson('settings', { a: 2 })
    expect(s.getJson('settings')).toEqual({ a: 2 })
  })

  it('stores conversations, returns the latest, summarises and deletes them', () => {
    const s = openStore(':memory:', tick)
    const a = s.createConversation()
    s.addMessage(a, { role: 'user', text: 'first chat' })
    s.addMessage(a, { role: 'assistant', text: 'hi' })
    const b = s.createConversation()
    s.addMessage(b, { role: 'user', text: 'second chat' })

    expect(s.latestConversation()).toEqual({ id: b, messages: [{ role: 'user', text: 'second chat' }] })
    expect(s.listConversations().map((c) => [c.id, c.title, c.messages])).toEqual([
      [b, 'second chat', 1],
      [a, 'first chat', 2]
    ])

    s.deleteConversation(b)
    expect(s.latestConversation()?.id).toBe(a)
    s.deleteAllConversations()
    expect(s.listConversations()).toEqual([])
    expect(s.latestConversation()).toBeUndefined()
  })

  it('rejects roles the schema does not allow', () => {
    const s = openStore(':memory:', tick)
    const id = s.createConversation()
    expect(() => s.addMessage(id, { role: 'system' as 'user', text: 'x' })).toThrow()
  })

  it('stores memories and notes, newest first', () => {
    const s = openStore(':memory:', tick)
    s.addMemory('memory', 'I prefer short answers')
    const note = s.addMemory('note', 'buy milk')
    expect(s.listMemories().map((m) => [m.kind, m.text])).toEqual([
      ['note', 'buy milk'],
      ['memory', 'I prefer short answers']
    ])
    s.deleteMemory(note)
    expect(s.listMemories()).toHaveLength(1)
    s.deleteAllMemories()
    expect(s.listMemories()).toEqual([])
  })

  it('persists across reopen and sets aside an unreadable file instead of deleting it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'store-test-'))
    const file = join(dir, 'assistant.db')
    const s1 = openStore(file, tick)
    s1.addMemory('memory', 'survives restarts')
    s1.close()
    const s2 = openStore(file, tick)
    expect(s2.listMemories()[0]!.text).toBe('survives restarts')
    s2.close()

    const broken = join(dir, 'broken.db')
    writeFileSync(broken, 'this is not a database'.repeat(100))
    const s3 = openStore(broken, tick)
    s3.setJson('k', 1)
    expect(readdirSync(dir).some((f) => f.startsWith('broken.db.unreadable-'))).toBe(true)
    s3.close()
  })
})

describe('looksSensitive', () => {
  it('flags passwords, keys and card numbers', () => {
    for (const text of [
      'my password is hunter2',
      'PIN: 4821',
      'api key = abcdef123456',
      'sk-proj-ABCDEFGHIJKLMNOPQRSTUV',
      'ghp_abcdefghijklmnopqrstuvwxyz123456',
      'AKIAABCDEFGHIJKLMNOP',
      '-----BEGIN RSA PRIVATE KEY-----',
      'card 4111 1111 1111 1111'
    ]) {
      expect(looksSensitive(text), text).toBe(true)
    }
  })

  it('allows ordinary memories', () => {
    for (const text of [
      'I prefer short answers',
      'My dog is called Biscuit',
      'I work on the Desktop Assistant project in TypeScript',
      'call mom at 5pm on 2026-10-30',
      'my phone order number is 1234 5678 9012 3456' // fails Luhn: not a card
    ]) {
      expect(looksSensitive(text), text).toBe(false)
    }
  })
})
