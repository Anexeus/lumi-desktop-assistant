// OpenAI-compatible audio endpoints (Ollama 0.40+, OpenAI, Groq for transcription…).
import { ProviderError, type ProviderConfig } from './provider'

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // the OpenAI API's own upload limit
export const MAX_SPEECH_CHARS = 1000 // per request; replies are spoken sentence by sentence

const endpoint = (cfg: ProviderConfig, path: string): string => `${cfg.baseUrl.replace(/\/+$/, '')}${path}`
const auth = (cfg: ProviderConfig): Record<string, string> => (cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})

async function failure(res: Response, cfg: ProviderConfig, what: string): Promise<ProviderError> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } | string }
    detail = (typeof body.error === 'string' ? body.error : (body.error?.message ?? '')).slice(0, 200)
  } catch {
    // not JSON
  }
  if (res.status === 404 && /model/i.test(detail)) {
    return new ProviderError('model', `The ${what} model "${cfg.model}" is not installed. For Ollama, run: ollama pull ${cfg.model}`)
  }
  if (res.status === 401 || res.status === 403) return new ProviderError('auth', 'The AI service rejected the API key.')
  return new ProviderError('http', `${what[0]!.toUpperCase()}${what.slice(1)} failed (${res.status})${detail ? `: ${detail}` : '.'}`)
}

const unreachable = (cfg: ProviderConfig): ProviderError =>
  new ProviderError('unreachable', `Can't reach the AI at ${cfg.baseUrl}. If you use Ollama, make sure it is running.`)

/**
 * Drops what speech recognisers write for non-speech ("[BLANK_AUDIO]", "(music)", "[ Silence ]", "*cough*"), so noise
 * is never sent as a message. Returns '' when nothing spoken is left.
 */
export function cleanTranscript(text: string): string {
  const spoken = text
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /\p{L}/u.test(spoken) ? spoken : ''
}

/** Speech to text. `audio` is a WAV file. */
export async function transcribe(cfg: ProviderConfig, audio: Uint8Array, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (audio.byteLength > MAX_AUDIO_BYTES) throw new ProviderError('http', 'The recording is too long.')
  const form = new FormData()
  form.append('model', cfg.model)
  form.append('file', new Blob([audio.slice()], { type: 'audio/wav' }), 'speech.wav')
  let res: Response
  try {
    res = await fetchImpl(endpoint(cfg, '/audio/transcriptions'), {
      method: 'POST',
      headers: auth(cfg),
      body: form,
      signal: AbortSignal.timeout(120_000)
    })
  } catch {
    throw unreachable(cfg)
  }
  if (!res.ok) throw await failure(res, cfg, 'transcription')
  const body = (await res.json().catch(() => null)) as { text?: unknown } | null
  if (typeof body?.text !== 'string') throw new ProviderError('bad-response', 'The transcription service sent an unexpected reply.')
  return cleanTranscript(body.text)
}

/** Text to speech. Returns a WAV file. */
export async function synthesize(
  cfg: ProviderConfig & { voice?: string; speed?: number },
  text: string,
  fetchImpl: typeof fetch = fetch
): Promise<Uint8Array> {
  const input = text.slice(0, MAX_SPEECH_CHARS)
  let res: Response
  try {
    res = await fetchImpl(endpoint(cfg, '/audio/speech'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(cfg) },
      body: JSON.stringify({
        model: cfg.model,
        input,
        response_format: 'wav',
        ...(cfg.voice ? { voice: cfg.voice } : {}),
        ...(cfg.speed && cfg.speed !== 1 ? { speed: cfg.speed } : {})
      }),
      signal: AbortSignal.timeout(60_000)
    })
  } catch {
    throw unreachable(cfg)
  }
  if (!res.ok) throw await failure(res, cfg, 'speech')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength < 44) throw new ProviderError('bad-response', 'The speech service returned no audio.')
  return bytes
}
