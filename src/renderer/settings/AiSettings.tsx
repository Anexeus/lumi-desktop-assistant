import { useEffect, useState, type FormEvent } from 'react'
import type { AppState } from '@shared/ipc'
import { LOCAL_MODELS } from '@shared/localModels'
import { findProvider, PROVIDERS, type ProviderId } from '@shared/providers'

const gb = (bytes: number): string => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`)
const host = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return 'this address'
  }
}

/** Download, choose and remove the built-in engine's models (chat or speech). */
export function LocalModels({ kind, local }: { kind: 'llm' | 'stt'; local: AppState['local'] }): React.JSX.Element {
  const selected = kind === 'llm' ? local.llm : local.stt
  const server = local.servers[kind]
  const api = window.assistant.local
  return (
    <div className="local-models">
      {!local.runtime && (
        <p className="warn" role="alert">
          Lumi’s engine is missing from this install. Reinstall Lumi (in development: npm run runtimes).
        </p>
      )}
      <ul>
        {LOCAL_MODELS.filter((m) => m.kind === kind).map((m) => {
          const installed = local.installed.includes(m.id)
          const loading = local.download?.id === m.id ? local.download : null
          return (
            <li key={m.id} className={`local-model${m.id === selected && installed ? ' in-use' : ''}`}>
              <div className="local-model-head">
                <strong>{m.name}</strong>
                <span className="badge">{installed ? (m.id === selected ? 'In use' : 'Downloaded') : gb(m.size)}</span>
              </div>
              <small>
                {m.needs} License: {m.license}.
              </small>
              {loading ? (
                <div className="progress-row">
                  <progress value={loading.received} max={loading.total} aria-label={`Downloading ${m.name}`} />
                  <small>
                    {gb(loading.received)} of {gb(loading.total)}
                  </small>
                  <button type="button" className="secondary small" onClick={() => void api.cancel()}>
                    Pause
                  </button>
                </div>
              ) : (
                <div className="model-actions">
                  {!installed && (
                    <button type="button" className="small" disabled={!!local.download} onClick={() => void api.download(m.id)}>
                      Download ({gb(m.size)})
                    </button>
                  )}
                  {installed && m.id !== selected && (
                    <button type="button" className="small" onClick={() => void api.select(kind, m.id)}>
                      Use this
                    </button>
                  )}
                  {installed && (
                    <button type="button" className="secondary small" onClick={() => void api.remove(m.id)}>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {local.downloadError && (
        <p className="warn" role="alert">
          {local.downloadError}
        </p>
      )}
      <p className="model-license" role="status">
        {server.state === 'ready' && `Engine running on ${server.device}.`}
        {server.state === 'starting' && `Starting on ${server.device}… ${server.message}`}
        {server.state === 'error' && server.message}
        {server.state === 'stopped' && 'The engine starts when it is first needed and stops when Lumi quits.'}
      </p>
    </div>
  )
}

export function AiSettings({ ai, local }: { ai: AppState['ai']; local: AppState['local'] }): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(ai.baseUrl)
  const [model, setModel] = useState(ai.model)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [key, setKey] = useState('')
  const [testing, setTesting] = useState(false)
  const provider = findProvider(ai.provider)

  useEffect(() => {
    setBaseUrl(ai.baseUrl)
    setModel(ai.model)
    setModels([])
  }, [ai.provider, ai.baseUrl, ai.model])

  async function choose(id: ProviderId): Promise<void> {
    if (id === ai.provider) return
    const p = findProvider(id)
    setStatus(null)
    await window.assistant.ai.setSettings({ provider: id, baseUrl: p.baseUrl, model: p.model })
  }

  async function test(): Promise<void> {
    setTesting(true)
    setStatus({ kind: 'info', text: ai.provider === 'builtin' ? 'Starting Lumi’s engine…' : 'Connecting…' })
    const result = await window.assistant.ai.listModels(ai.provider === 'builtin' ? undefined : baseUrl.trim())
    setTesting(false)
    if (!result.ok) return setStatus({ kind: 'error', text: result.message })
    setModels(result.models)
    if (ai.provider === 'builtin') return setStatus({ kind: 'ok', text: `Ready: ${result.models[0]}.` })
    if (!result.models.length) return setStatus({ kind: 'error', text: 'Connected, but the service lists no models.' })
    setStatus({ kind: 'ok', text: `Connected. ${result.models.length} model${result.models.length === 1 ? '' : 's'} available.` })
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    try {
      await window.assistant.ai.setSettings({ provider: ai.provider, baseUrl: baseUrl.trim(), model: model.trim() })
      setStatus({ kind: 'ok', text: 'Saved.' })
    } catch {
      setStatus({ kind: 'error', text: 'Use a full http:// or https:// address and a model name.' })
    }
  }

  async function saveKey(value: string | null): Promise<void> {
    try {
      await window.assistant.ai.setApiKey(value)
      setKey('')
      setStatus({ kind: 'ok', text: value ? 'Key saved, encrypted by Windows for your account.' : 'Key removed.' })
    } catch {
      setStatus({ kind: 'error', text: 'Could not save the key. Secure storage may be unavailable.' })
    }
  }

  const changed = baseUrl.trim() !== ai.baseUrl || model.trim() !== ai.model
  const suggestions = [...new Set([...provider.models, ...models])]

  return (
    <section aria-labelledby="ai-heading">
      <h2 id="ai-heading">AI</h2>
      <div className="characters" role="radiogroup" aria-label="AI provider">
        {PROVIDERS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={ai.provider === p.id} className="character-choice" onClick={() => void choose(p.id)}>
            <strong>{p.name}</strong>
            <small>{p.local ? 'On this PC' : p.id === 'custom' ? 'Any address' : 'Cloud'}</small>
          </button>
        ))}
      </div>
      <p className="model-license">{provider.note}</p>

      {ai.provider === 'builtin' ? (
        <>
          <LocalModels kind="llm" local={local} />
          <div className="model-actions">
            <button type="button" className="secondary" onClick={() => void test()} disabled={testing || !local.installed.includes(local.llm)}>
              {testing ? 'Starting…' : 'Test the engine'}
            </button>
          </div>
        </>
      ) : (
        <form className="ai" onSubmit={(e) => void save(e)}>
          {(ai.provider === 'custom' || ai.provider === 'ollama') && (
            <label className="field">
              <span>Address (OpenAI-compatible)</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} placeholder="http://127.0.0.1:1234/v1" />
            </label>
          )}
          <label className="field">
            <span>Model</span>
            <span className="inline">
              <input value={model} onChange={(e) => setModel(e.target.value)} list="ai-models" spellCheck={false} />
              <datalist id="ai-models">
                {suggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <button type="button" className="secondary" onClick={() => void test()} disabled={testing || !baseUrl}>
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            </span>
          </label>
          {ai.local ? (
            <p className="model-license">Runs on this computer. Your messages never leave it.</p>
          ) : (
            <p className="warn">
              Messages (and anything Lumi reads for you, like files or screen text you allow) are sent to {host(baseUrl)}. Free tiers may use them
              to improve their models.
            </p>
          )}
          <div className="model-actions">
            <button type="submit" disabled={!changed}>
              Save
            </button>
          </div>
        </form>
      )}

      {ai.provider !== 'builtin' && !ai.local && (
        <div className="ai">
          <label className="field">
            <span>
              {provider.name} API key {ai.hasApiKey && <small>(a key is saved)</small>}
            </span>
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
          <p className="model-license">
            Each service keeps its own key, encrypted by Windows for your account and never shown again.
            {provider.keyUrl && <> Get one at <span className="selectable">{provider.keyUrl}</span></>}
          </p>
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
