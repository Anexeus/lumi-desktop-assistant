// OpenAI-compatible chat streaming (Ollama, LM Studio, Groq, Gemini, OpenRouter, OpenAI…).
// Pure apart from `fetch`, which is injectable for tests.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ProviderConfig {
  baseUrl: string // e.g. http://127.0.0.1:11434/v1
  model: string
  apiKey?: string
}

export type ProviderErrorKind = 'unreachable' | 'auth' | 'model' | 'timeout' | 'canceled' | 'http' | 'bad-response'

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string
  ) {
    super(message)
  }
}

export interface StreamOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  /** Until the first token. Generous: a local model may need to load into the GPU first. */
  firstTokenTimeoutMs?: number
  /** Longest silence allowed between chunks once streaming. */
  idleTimeoutMs?: number
}

const headers = (cfg: ProviderConfig): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
})

const endpoint = (cfg: ProviderConfig, path: string): string => `${cfg.baseUrl.replace(/\/+$/, '')}${path}`

/** Removes <think>…</think> spans from streamed text, even when a tag is split across chunks. */
export function createThinkFilter(): (chunk: string) => string {
  let inThink = false
  let pending = ''
  return (chunk) => {
    let text = pending + chunk
    pending = ''
    let out = ''
    while (text) {
      const tag = inThink ? '</think>' : '<think>'
      const at = text.indexOf(tag)
      if (at >= 0) {
        if (!inThink) out += text.slice(0, at)
        text = text.slice(at + tag.length)
        inThink = !inThink
        continue
      }
      // Hold back a possible partial tag at the end until the next chunk.
      let keep = 0
      for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
        if (tag.startsWith(text.slice(-n))) {
          keep = n
          break
        }
      }
      if (!inThink) out += text.slice(0, text.length - keep)
      pending = text.slice(text.length - keep)
      text = ''
    }
    return out
  }
}

async function describeHttpError(res: Response, cfg: ProviderConfig): Promise<ProviderError> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } | string }
    detail = typeof body.error === 'string' ? body.error : (body.error?.message ?? '')
  } catch {
    // body was not JSON
  }
  detail = detail.slice(0, 300)
  if (res.status === 401 || res.status === 403) return new ProviderError('auth', 'The AI service rejected the API key.')
  if (res.status === 404 && /model/i.test(detail)) {
    return new ProviderError('model', `Model "${cfg.model}" is not available. For Ollama, run: ollama pull ${cfg.model}`)
  }
  if (res.status === 429) return new ProviderError('http', 'The AI service is rate limiting requests. Try again in a moment.')
  return new ProviderError('http', `The AI service returned an error (${res.status})${detail ? `: ${detail}` : '.'}`)
}

/** Streams the assistant's reply as text chunks. Throws ProviderError. */
export async function* streamChat(cfg: ProviderConfig, messages: ChatMessage[], opts: StreamOptions = {}): AsyncGenerator<string> {
  const { signal, fetchImpl = fetch, firstTokenTimeoutMs = 120_000, idleTimeoutMs = 60_000 } = opts
  const controller = new AbortController()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = (ms: number): void => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, ms)
  }
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort)
  if (signal?.aborted) controller.abort()

  const fail = (error: unknown): ProviderError => {
    if (error instanceof ProviderError) return error
    if (timedOut) return new ProviderError('timeout', 'The AI took too long to respond.')
    if (signal?.aborted) return new ProviderError('canceled', 'Canceled.')
    return new ProviderError('unreachable', `Can't reach the AI at ${cfg.baseUrl}. If you use Ollama, make sure it is running.`)
  }

  try {
    arm(firstTokenTimeoutMs)
    let res: Response
    try {
      res = await fetchImpl(endpoint(cfg, '/chat/completions'), {
        method: 'POST',
        headers: headers(cfg),
        body: JSON.stringify({ model: cfg.model, messages, stream: true }),
        signal: controller.signal
      })
    } catch (error) {
      throw fail(error)
    }
    if (!res.ok) throw await describeHttpError(res, cfg)
    if (!res.body) throw new ProviderError('bad-response', 'The AI service sent an empty response.')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const filter = createThinkFilter()
    let buffer = ''
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>
      try {
        chunk = await reader.read()
      } catch (error) {
        throw fail(error)
      }
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') return
        let json: { choices?: { delta?: { content?: string | null } }[]; error?: { message?: string } }
        try {
          json = JSON.parse(data)
        } catch {
          continue // tolerate keep-alive or vendor-specific lines
        }
        if (json.error) throw new ProviderError('http', json.error.message?.slice(0, 300) ?? 'The AI service reported an error.')
        // Reasoning fields (delta.reasoning / reasoning_content) are deliberately ignored.
        const text = filter(json.choices?.[0]?.delta?.content ?? '')
        if (!text) continue
        arm(idleTimeoutMs)
        yield text
      }
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    controller.abort()
  }
}

/** Lists model ids the endpoint offers; doubles as a connection test. */
export async function listModels(cfg: ProviderConfig, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  let res: Response
  try {
    res = await fetchImpl(endpoint(cfg, '/models'), { headers: headers(cfg), signal: AbortSignal.timeout(10_000) })
  } catch {
    throw new ProviderError('unreachable', `Can't reach the AI at ${cfg.baseUrl}. If you use Ollama, make sure it is running.`)
  }
  if (!res.ok) throw await describeHttpError(res, cfg)
  const body = (await res.json().catch(() => null)) as { data?: { id?: unknown }[] } | null
  return (body?.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string').sort()
}
