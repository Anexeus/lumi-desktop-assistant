import { describe, expect, it } from 'vitest'
import { createThinkFilter, listModels, ProviderError, streamChat, type ProviderConfig, type StreamEvent } from '../../src/main/ai/provider'

const cfg: ProviderConfig = { baseUrl: 'http://127.0.0.1:11434/v1/', model: 'qwen3:4b' }

/** A fetch that streams SSE lines (each entry is one network chunk), optionally with delays. */
function sseFetch(chunks: (string | { wait: number })[], init: { status?: number; body?: string } = {}) {
  const calls: { url: string; init: RequestInit }[] = []
  const impl = (async (url: string, req: RequestInit) => {
    calls.push({ url, init: req })
    if (init.status && init.status !== 200) return new Response(init.body ?? '', { status: init.status })
    const enc = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const abort = (): void => controller.error(new DOMException('aborted', 'AbortError'))
        req.signal?.addEventListener('abort', abort)
        for (const c of chunks) {
          if (req.signal?.aborted) return
          if (typeof c === 'string') controller.enqueue(enc.encode(c))
          else await new Promise((r) => setTimeout(r, c.wait))
        }
        if (!req.signal?.aborted) controller.close()
      }
    })
    return new Response(stream, { status: 200 })
  }) as unknown as typeof fetch
  return { impl, calls }
}

const data = (content: string): string => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<string> {
  let out = ''
  for await (const t of gen) if (typeof t === 'string') out += t
  return out
}

async function errorOf(p: Promise<unknown>): Promise<ProviderError> {
  try {
    await p
  } catch (e) {
    return e as ProviderError
  }
  throw new Error('expected a rejection')
}

describe('createThinkFilter', () => {
  it('drops think blocks, including tags split across chunks', () => {
    const f = createThinkFilter()
    const out = ['Hi <thi', 'nk>secret', ' plan</th', 'ink> there', ' <', 'b>ok'].map(f).join('')
    expect(out).toBe('Hi  there <b>ok')
  })

  it('passes text without tags unchanged', () => {
    const f = createThinkFilter()
    expect(['a < b', ' and c'].map(f).join('')).toBe('a < b and c')
  })
})

describe('streamChat', () => {
  it('streams content deltas and sends the right request', async () => {
    const { impl, calls } = sseFetch([data('Hel'), data('lo'), 'data: {"choices":[{"delta":{}}]}\n\n', data('!'), 'data: [DONE]\n\n'])
    const text = await collect(streamChat({ ...cfg, apiKey: 'k-123' }, [{ role: 'user', content: 'hi' }], { fetchImpl: impl }))
    expect(text).toBe('Hello!')
    expect(calls[0]!.url).toBe('http://127.0.0.1:11434/v1/chat/completions')
    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer k-123')
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ model: 'qwen3:4b', stream: true })
  })

  it('handles SSE lines split across network chunks', async () => {
    const line = data('split works')
    const { impl } = sseFetch([line.slice(0, 7), line.slice(7, 20), line.slice(20), 'data: [DONE]\n'])
    expect(await collect(streamChat(cfg, [], { fetchImpl: impl }))).toBe('split works')
  })

  it('strips thinking from the reply', async () => {
    const { impl } = sseFetch([data('<think>'), data('hmm'), data('</think>'), data('Answer'), 'data: [DONE]\n'])
    expect(await collect(streamChat(cfg, [], { fetchImpl: impl }))).toBe('Answer')
  })

  it('maps HTTP errors to readable messages', async () => {
    const missing = sseFetch([], { status: 404, body: JSON.stringify({ error: { message: 'model "qwen3:4b" not found, try pulling it first' } }) })
    const e1 = await errorOf(collect(streamChat(cfg, [], { fetchImpl: missing.impl })))
    expect(e1.kind).toBe('model')
    expect(e1.message).toContain('ollama pull qwen3:4b')

    const auth = sseFetch([], { status: 401 })
    expect((await errorOf(collect(streamChat(cfg, [], { fetchImpl: auth.impl })))).kind).toBe('auth')
  })

  it('reports an unreachable server', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const e = await errorOf(collect(streamChat(cfg, [], { fetchImpl: down })))
    expect(e.kind).toBe('unreachable')
    expect(e.message).toContain('Ollama')
  })

  it('can be canceled mid-stream', async () => {
    const { impl } = sseFetch([data('one '), { wait: 200 }, data('two')])
    const controller = new AbortController()
    let got = ''
    const e = await errorOf(
      (async () => {
        for await (const t of streamChat(cfg, [], { fetchImpl: impl, signal: controller.signal })) {
          got += t
          controller.abort()
        }
      })()
    )
    expect(got).toBe('one ')
    expect(e.kind).toBe('canceled')
  })

  it('times out when the first token never comes, or the stream stalls', async () => {
    const silent = sseFetch([{ wait: 300 }, data('late')])
    expect((await errorOf(collect(streamChat(cfg, [], { fetchImpl: silent.impl, firstTokenTimeoutMs: 50 })))).kind).toBe('timeout')

    const stall = sseFetch([data('a'), { wait: 300 }, data('b')])
    expect((await errorOf(collect(streamChat(cfg, [], { fetchImpl: stall.impl, idleTimeoutMs: 50 })))).kind).toBe('timeout')
  })

  it('assembles tool calls sent in fragments and reports them at the end', async () => {
    const part = (delta: unknown): string => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`
    const { impl, calls } = sseFetch([
      part({ content: 'Checking. ' }),
      part({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'files_', arguments: '' } }] }),
      part({ tool_calls: [{ index: 0, function: { name: 'search', arguments: '{"que' } }] }),
      part({ tool_calls: [{ index: 0, function: { arguments: 'ry":"cv"}' } }] }),
      part({ tool_calls: [{ index: 1, id: 'call_2', function: { name: 'notify_user', arguments: '{}' } }] }),
      'data: [DONE]\n\n'
    ])
    const events: StreamEvent[] = []
    const tools = [{ type: 'function' as const, function: { name: 'files_search', description: 'd', parameters: {} } }]
    for await (const e of streamChat(cfg, [], { fetchImpl: impl, tools })) events.push(e)
    expect(events).toEqual([
      'Checking. ',
      {
        type: 'tool_calls',
        calls: [
          { id: 'call_1', name: 'files_search', arguments: '{"query":"cv"}' },
          { id: 'call_2', name: 'notify_user', arguments: '{}' }
        ]
      }
    ])
    expect(JSON.parse(calls[0]!.init.body as string).tools).toEqual(tools)
  })

  it('surfaces an error event inside the stream', async () => {
    const { impl } = sseFetch([data('partial'), 'data: {"error":{"message":"out of memory"}}\n\n'])
    const e = await errorOf(collect(streamChat(cfg, [], { fetchImpl: impl })))
    expect(e.message).toBe('out of memory')
  })
})

describe('listModels', () => {
  it('returns sorted model ids', async () => {
    const impl = (async () => Response.json({ data: [{ id: 'b' }, { id: 'a' }, { nope: 1 }] })) as unknown as typeof fetch
    expect(await listModels(cfg, impl)).toEqual(['a', 'b'])
  })
})

describe('wellFormedJson', () => {
  it('replaces lone surrogates (text cut mid-emoji) and keeps whole emoji', async () => {
    const { wellFormedJson } = await import('../../src/main/ai/provider')
    const cut = '🎵 lofi 🎧'.slice(0, 1) // half of an emoji
    expect(JSON.parse(wellFormedJson({ t: `a${cut}b` })).t).toBe('a�b')
    expect(JSON.parse(wellFormedJson({ t: '🎵 ok' })).t).toBe('🎵 ok')
    expect(wellFormedJson({ t: `x${cut}` })).not.toMatch(/\ud83c/i)
  })
})
