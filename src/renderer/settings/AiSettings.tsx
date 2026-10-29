import { useEffect, useState, type FormEvent } from 'react'
import type { AppState } from '@shared/ipc'

const OLLAMA_URL = 'http://127.0.0.1:11434/v1'

const isLocal = (url: string): boolean => {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  } catch {
    return false
  }
}

export function AiSettings({ ai }: { ai: AppState['ai'] }): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(ai.baseUrl)
  const [model, setModel] = useState(ai.model)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [key, setKey] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setBaseUrl(ai.baseUrl)
    setModel(ai.model)
  }, [ai.baseUrl, ai.model])

  async function test(): Promise<void> {
    setTesting(true)
    setStatus(null)
    const result = await window.assistant.ai.listModels(baseUrl.trim())
    setTesting(false)
    if (!result.ok) {
      const hint = isLocal(baseUrl) ? ' Install Ollama from ollama.com, then run: ollama pull qwen3:4b' : ''
      return setStatus({ kind: 'error', text: result.message + hint })
    }
    setModels(result.models)
    if (!result.models.length) return setStatus({ kind: 'error', text: 'Connected, but no models are installed. For Ollama: ollama pull qwen3:4b' })
    if (!result.models.includes(model)) setModel(result.models[0]!)
    setStatus({ kind: 'ok', text: `Connected. ${result.models.length} model${result.models.length === 1 ? '' : 's'} available.` })
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    try {
      await window.assistant.ai.setSettings({ baseUrl: baseUrl.trim(), model: model.trim() })
      setStatus({ kind: 'ok', text: 'Saved.' })
    } catch {
      setStatus({ kind: 'error', text: 'Use a full http:// or https:// address and a model name.' })
    }
  }

  async function saveKey(value: string | null): Promise<void> {
    try {
      await window.assistant.ai.setApiKey(value)
      setKey('')
      setStatus({ kind: 'ok', text: value ? 'API key saved (encrypted).' : 'API key removed.' })
    } catch {
      setStatus({ kind: 'error', text: 'Could not save the key. Secure storage may be unavailable.' })
    }
  }

  const draftIsLocal = isLocal(baseUrl)
  const changed = baseUrl.trim() !== ai.baseUrl || model.trim() !== ai.model

  return (
    <section aria-labelledby="ai-heading">
      <h2 id="ai-heading">AI</h2>
      <form className="ai" onSubmit={(e) => void save(e)}>
        <div className="presets">
          <button type="button" className="secondary" onClick={() => setBaseUrl(OLLAMA_URL)}>
            Use Ollama on this PC
          </button>
        </div>

        <label className="field">
          <span>Address (OpenAI-compatible)</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} />
        </label>

        <label className="field">
          <span>Model</span>
          <span className="inline">
            <input value={model} onChange={(e) => setModel(e.target.value)} list="ai-models" spellCheck={false} />
            <datalist id="ai-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <button type="button" className="secondary" onClick={() => void test()} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          </span>
        </label>

        {draftIsLocal ? (
          <p className="model-license">Runs on this computer. Your messages never leave it.</p>
        ) : (
          <p className="warn">
            Messages will be sent to {(() => { try { return new URL(baseUrl).host } catch { return 'this address' } })()}. Free tiers may use them to
            improve their models.
          </p>
        )}

        <div className="model-actions">
          <button type="submit" disabled={!changed}>
            Save
          </button>
        </div>
      </form>

      {!ai.local && (
        <div className="ai">
          <label className="field">
            <span>API key {ai.hasApiKey && <small>(a key is saved)</small>}</span>
            <span className="inline">
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={ai.hasApiKey ? '••••••••' : 'Paste your key'} autoComplete="off" />
              <button type="button" onClick={() => void saveKey(key.trim())} disabled={!key.trim()}>
                Save key
              </button>
              {ai.hasApiKey && (
                <button type="button" className="secondary" onClick={() => void saveKey(null)}>
                  Remove
                </button>
              )}
            </span>
          </label>
          <p className="model-license">Stored encrypted by Windows for your user account. It is removed if you change to another service.</p>
        </div>
      )}

      {status && (
        <p className={status.kind === 'error' ? 'warn' : 'model-license'} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
    </section>
  )
}
