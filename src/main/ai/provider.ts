// OpenAI-compatible chat streaming (Ollama, LM Studio, Groq, Gemini, OpenRouter, OpenAI…).
// Pure apart from `fetch`, which is injectable for tests.

export interface ToolCall {
  id: string
  name: string
  /** Raw JSON text from the model; parse and validate before use. */
  arguments: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

/** OpenAI "function" tool description sent to the model. */
export interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

/** A streamed reply: text chunks, then (if the model wants tools) one tool_calls event at the end. */
export type StreamEvent = string | { type: 'tool_calls'; calls: ToolCall[] }

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
  tools?: ToolSpec[]
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

/** Streams the assistant's reply as text chunks, then any tool calls. Throws ProviderError. */
/**
 * JSON without lone UTF-16 surrogates. Text cut mid-emoji (e.g. a truncated web page) has them; JavaScript tolerates
 * that but strict parsers (llama.cpp) reject the whole request.
 */
export const wellFormedJson = (value: unknown): string =>
  // JSON.stringify writes a lone surrogate as the escape "\udXXX" (a backslash and 5 characters); swap those for U+FFFD.
  JSON.stringify(value).replace(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f][0-9a-f]{2})|(?<!\\ud[89ab][0-9a-f]{2})\\ud[c-f][0-9a-f]{2}/gi, '\\ufffd')

export async function* streamChat(cfg: ProviderConfig, messages: ChatMessage[], opts: StreamOptions = {}): AsyncGenerator<StreamEvent> {
  const { signal, fetchImpl = fetch, firstTokenTimeoutMs = 120_000, idleTimeoutMs = 60_000, tools } = opts
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
        body: wellFormedJson({ model: cfg.model, messages, stream: true, ...(tools?.length ? { tools } : {}) }),
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
    // Tool calls arrive in fragments keyed by index (name first, arguments in pieces).
    const calls = new Map<number, ToolCall>()
    const finishCalls = (): StreamEvent | undefined =>
      calls.size ? { type: 'tool_calls', calls: [...calls.values()].filter((c) => c.name) } : undefined
    let buffer = ''
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>
      try {
        chunk = await reader.read()
      } catch (error) {
        throw fail(error)
      }
      if (chunk.done) {
        const tail = finishCalls()
        if (tail) yield tail
        return
      }
      buffer += decoder.decode(chunk.value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          const tail = finishCalls()
          if (tail) yield tail
          return
        }
        let json: {
          choices?: {
            delta?: {
              content?: string | null
              tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
            }
          }[]
          error?: { message?: string }
        }
        try {
          json = JSON.parse(data)
        } catch {
          continue // tolerate keep-alive or vendor-specific lines
        }
        if (json.error) throw new ProviderError('http', json.error.message?.slice(0, 300) ?? 'The AI service reported an error.')
        for (const part of json.choices?.[0]?.delta?.tool_calls ?? []) {
          const i = part.index ?? 0
          const call = calls.get(i) ?? { id: '', name: '', arguments: '' }
          if (part.id) call.id = part.id
          if (part.function?.name) call.name += part.function.name
          if (part.function?.arguments) call.arguments += part.function.arguments
          calls.set(i, call)
          arm(idleTimeoutMs)
        }
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
/** Asks a vision-capable model one question about a PNG (non-streaming). */
export async function describeImage(cfg: ProviderConfig, pngBase64: string, question: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let res: Response
  try {
    res = await fetchImpl(endpoint(cfg, '/chat/completions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers(cfg) },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        messages: [{ role: 'user', content: [{ type: 'text', text: question }, { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}` } }] }]
      }),
      signal: AbortSignal.timeout(90_000)
    })
  } catch {
    throw new ProviderError('unreachable', `Can't reach ${new URL(cfg.baseUrl).host}.`)
  }
  if (!res.ok) throw new ProviderError(res.status === 401 || res.status === 403 ? 'auth' : 'http', `The vision request failed (${res.status}).`)
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new ProviderError('bad-response', 'The model did not describe the image.')
  return text.trim()
}

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
