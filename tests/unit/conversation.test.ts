import { describe, expect, it } from 'vitest'
import type { CharacterEvent } from '../../src/shared/character'
import type { ChatSnapshot } from '../../src/shared/ipc'
import { Conversation } from '../../src/main/ai/conversation'
import { ProviderError, type ChatMessage } from '../../src/main/ai/provider'

type Script = (messages: ChatMessage[], signal: AbortSignal) => AsyncGenerator<string>

function setup(script: Script, memories: string[] = []) {
  const events: CharacterEvent[] = []
  const snapshots: ChatSnapshot[] = []
  const deltas: string[] = []
  const sent: ChatMessage[][] = []
  const saved: string[] = []
  const conv = new Conversation({
    stream: (m, s) => {
      sent.push(m)
      return script(m, s)
    },
    onSnapshot: (s) => snapshots.push(s),
    onDelta: (_id, t) => deltas.push(t),
    onCharacter: (e) => events.push(e),
    memories: () => memories,
    onPersist: (m) => saved.push(`${m.role}:${m.text}`)
  })
  return { conv, events, snapshots, deltas, sent, saved }
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function* fails(error: Error): AsyncGenerator<string> {
  if (error) throw error
  yield ''
}

async function* reply(...parts: string[]): AsyncGenerator<string> {
  for (const p of parts) yield p
}

async function* slow(signal: AbortSignal): AsyncGenerator<string> {
  yield 'first '
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, 1000)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new ProviderError('canceled', 'Canceled.'))
    })
  })
  yield 'never'
}

describe('Conversation', () => {
  it('runs a turn: think, speak, done, with the reply streamed', async () => {
    const { conv, events, deltas } = setup(() => reply('Hel', 'lo'))
    await conv.send('hi')
    expect(events).toEqual(['think', 'speak', 'done'])
    expect(deltas).toEqual(['Hel', 'lo'])
    expect(conv.snapshot()).toEqual({
      status: 'idle',
      items: [
        { id: 1, role: 'user', text: 'hi' },
        { id: 2, role: 'assistant', text: 'Hello' }
      ]
    })
  })

  it('sends the system prompt and prior turns, but not errors', async () => {
    let n = 0
    const { conv, sent } = setup(() => (n++ === 1 ? fails(new ProviderError('http', 'boom')) : reply('ok')))
    await conv.send('one')
    await conv.send('two') // fails
    await conv.send('three')
    const last = sent[2]!
    expect(last[0]!.role).toBe('system')
    expect(last[0]!.content).toContain(String(new Date().getFullYear()))
    expect(last.slice(1).map((m) => m.content)).toEqual(['one', 'ok', 'two', 'three'])
  })

  it('turns provider errors into an error item and an error state', async () => {
    const { conv, events } = setup(() => fails(new ProviderError('unreachable', 'Is Ollama running?')))
    await conv.send('hi')
    expect(events).toEqual(['think', 'error'])
    expect(conv.snapshot().items.at(-1)).toMatchObject({ role: 'error', text: 'Is Ollama running?' })
    expect(conv.snapshot().status).toBe('idle')
  })

  it('cancel stops the reply and keeps what arrived', async () => {
    const { conv, events } = setup((_m, s) => slow(s))
    const p = conv.send('hi')
    await wait(20)
    conv.cancel()
    await p
    expect(events).toEqual(['think', 'speak', 'cancel'])
    expect(conv.snapshot().items.map((i) => i.text)).toEqual(['hi', 'first '])
  })

  it('a new message while streaming replaces the old turn without stale updates', async () => {
    let n = 0
    const { conv, events } = setup((_m, s) => (n++ === 0 ? slow(s) : reply('second answer')))
    const first = conv.send('first')
    await wait(20)
    await conv.send('second')
    await first
    expect(events).toEqual(['think', 'speak', 'think', 'speak', 'done'])
    const s = conv.snapshot()
    expect(s.status).toBe('idle')
    expect(s.items.map((i) => `${i.role}:${i.text}`)).toEqual(['user:first', 'assistant:first ', 'user:second', 'assistant:second answer'])
  })

  it('reports an empty reply as an error', async () => {
    const { conv, events } = setup(() => reply())
    await conv.send('hi')
    expect(events.at(-1)).toBe('error')
    expect(conv.snapshot().items.at(-1)!.role).toBe('error')
  })

  it('clear empties the conversation and calms the character if busy', async () => {
    const { conv, events } = setup((_m, s) => slow(s))
    const p = conv.send('hi')
    await wait(20)
    conv.clear()
    await p
    expect(conv.snapshot()).toEqual({ items: [], status: 'idle' })
    expect(events).toEqual(['think', 'speak', 'cancel'])
  })

  it('saves each finished message once, in order, including interrupted and cancelled replies', async () => {
    let n = 0
    const { conv, saved } = setup((_m, s) => (n++ === 0 ? slow(s) : reply('second answer')))
    const first = conv.send('first')
    await wait(20)
    await conv.send('second')
    await first
    expect(saved).toEqual(['user:first', 'assistant:first ', 'user:second', 'assistant:second answer'])
  })

  it('does not save a reply that was running when the chat was cleared', async () => {
    const { conv, saved } = setup((_m, s) => slow(s))
    const p = conv.send('hi')
    await wait(20)
    conv.clear()
    await p
    expect(saved).toEqual(['user:hi'])
  })

  it('does not save errors', async () => {
    const { conv, saved } = setup(() => fails(new ProviderError('http', 'boom')))
    await conv.send('hi')
    expect(saved).toEqual(['user:hi'])
  })

  it('restores saved messages and continues the same history', async () => {
    const { conv, sent } = setup(() => reply('ok'))
    conv.restore([
      { role: 'user', text: 'earlier question' },
      { role: 'assistant', text: 'earlier answer' }
    ])
    expect(conv.snapshot().items.map((i) => i.text)).toEqual(['earlier question', 'earlier answer'])
    await conv.send('next')
    expect(sent[0]!.slice(1).map((m) => m.content)).toEqual(['earlier question', 'earlier answer', 'next'])
  })

  it('adds local exchanges without calling the AI', async () => {
    const { conv, sent, saved, events } = setup(() => reply('never'))
    conv.addLocal('/remember I like tea', 'Got it.')
    expect(sent).toEqual([])
    expect(events).toEqual([])
    expect(saved).toEqual(['user:/remember I like tea', 'assistant:Got it.'])
  })

  it('puts memories in the system prompt, capped in size', async () => {
    const { conv, sent } = setup(() => reply('ok'), ['I like tea', 'x'.repeat(3000)])
    await conv.send('hi')
    const system = sent[0]![0]!.content
    expect(system).toContain('- I like tea')
    expect(system).not.toContain('x'.repeat(3000))
  })

  it('a command while a reply streams stops that reply and keeps the order', async () => {
    const { conv, events, saved } = setup((_m, s) => slow(s))
    const p = conv.send('long question')
    await wait(20)
    conv.addLocal('/remember tea', 'Got it.')
    await p
    expect(conv.snapshot().status).toBe('idle')
    expect(conv.snapshot().items.map((i) => i.text)).toEqual(['long question', 'first ', '/remember tea', 'Got it.'])
    expect(saved).toEqual(['user:long question', 'assistant:first ', 'user:/remember tea', 'assistant:Got it.'])
    expect(events).toEqual(['think', 'speak', 'cancel'])
  })
})
