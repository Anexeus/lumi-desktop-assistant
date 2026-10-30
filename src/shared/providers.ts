// AI providers Lumi can talk to. All speak the OpenAI chat-completions API (Gemini and Anthropic through their
// OpenAI-compatible endpoints), so one adapter serves them; capabilities differ and are listed per provider.

export interface Provider {
  id: string
  name: string
  /** Empty for "builtin" (Lumi starts its own server and fills it in). */
  baseUrl: string
  model: string
  /** Suggestions shown in the model field. */
  models: string[]
  local: boolean
  needsKey: boolean
  /** Where to get a key, shown in Settings. */
  keyUrl?: string
  /** Shown under the provider. Never a promise about price: limits change and are per account. */
  note: string
  /** Speech-to-text model on this provider's /audio/transcriptions, if it has one. */
  stt?: string
  /** Its default models accept images (used to describe a screenshot when the user allows it). */
  vision?: boolean
}

export const PROVIDERS = [
  {
    id: 'builtin',
    name: 'Lumi built-in (Qwen3 on this PC)',
    baseUrl: '',
    model: 'qwen3',
    models: [],
    local: true,
    needsKey: false,
    note: 'Runs on your PC with Lumi’s own engine (llama.cpp). Free and private. Downloads the model once.'
  },
  {
    id: 'ollama',
    name: 'Ollama on this PC',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen3:4b',
    models: ['qwen3:4b', 'qwen3:1.7b', 'qwen3:8b'],
    local: true,
    needsKey: false,
    note: 'Uses a separately installed Ollama. Lumi starts its server hidden when needed.',
    stt: 'lfm3-audio'
  },
  {
    id: 'gemini',
    vision: true,
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    // Google serves the 2.5 models only to projects that used them before; newer -latest aliases can be overloaded.
    model: 'gemini-3.6-flash',
    models: ['gemini-3.6-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'],
    local: false,
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Cloud. Has a free tier; its limits are per project and shown in Google AI Studio.'
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'],
    local: false,
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
    note: 'Cloud, very fast. Has a free tier; its limits are shown in your Groq console.',
    stt: 'whisper-large-v3'
  },
  {
    id: 'openai',
    vision: true,
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
    local: false,
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Cloud, paid per use.',
    stt: 'whisper-1'
  },
  {
    id: 'anthropic',
    vision: true,
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-5-5',
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
    local: false,
    needsKey: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Cloud, paid per use (through Anthropic’s OpenAI-compatible endpoint).'
  },
  {
    id: 'openrouter',
    vision: true,
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/auto',
    models: ['openrouter/auto'],
    local: false,
    needsKey: true,
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Cloud, many models; some are free with tight limits.'
  },
  {
    id: 'custom',
    name: 'Other (OpenAI-compatible)',
    baseUrl: '',
    model: '',
    models: [],
    local: false,
    needsKey: false,
    note: 'Any OpenAI-compatible address, e.g. LM Studio.'
  }
] as const satisfies readonly Provider[]

export type ProviderId = (typeof PROVIDERS)[number]['id']
export const PROVIDER_IDS = PROVIDERS.map((p) => p.id) as [ProviderId, ...ProviderId[]]
export const findProvider = (id: string): Provider => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]

/** Which provider an address belongs to (for settings saved before providers existed). */
export function providerForUrl(url: string): ProviderId {
  try {
    const origin = new URL(url).origin
    return (PROVIDERS.find((p) => p.baseUrl && new URL(p.baseUrl).origin === origin)?.id as ProviderId | undefined) ?? 'custom'
  } catch {
    return 'custom'
  }
}
