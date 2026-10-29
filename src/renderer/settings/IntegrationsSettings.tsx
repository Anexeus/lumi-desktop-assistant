import { useState, type FormEvent } from 'react'
import type { IntegrationsState } from '@shared/ipc'

const PRESETS = [
  { name: 'Context7 docs', target: 'npx -y @upstash/context7-mcp', note: 'Up-to-date library documentation.' },
  { name: 'Playwright browser', target: 'npx -y @playwright/mcp@latest', note: 'Lets Lumi drive a real browser (asks before every action).' }
]

const STATUS: Record<string, string> = { ready: 'Connected', connecting: 'Connecting…', error: 'Error', off: 'Off' }

export function IntegrationsSettings({ integrations }: { integrations: IntegrationsState }): React.JSX.Element {
  const i = window.assistant.integrations
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    try {
      await i.addMcp(name.trim(), target.trim())
      setName('')
      setTarget('')
    } catch {
      setError('Enter a name and a command (or an https:// address).')
    }
  }

  return (
    <section aria-labelledby="integrations-heading">
      <h2 id="integrations-heading">Integrations</h2>

      <h3>GitHub</h3>
      <p className="model-license">
        Lumi can look up public repos and issues without a token (60 lookups/hour). For your private repos, create a{' '}
        <strong>read-only fine-grained token</strong> on GitHub and paste it here. It is stored encrypted.
      </p>
      <div className="inline">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={integrations.githubToken ? '•••••••• (a token is saved)' : 'github_pat_…'}
          aria-label="GitHub token"
          autoComplete="off"
        />
        <button type="button" onClick={() => void i.setGithubToken(token.trim()).then(() => setToken(''))} disabled={token.trim().length < 10}>
          Save
        </button>
        {integrations.githubToken && (
          <button type="button" className="secondary" onClick={() => void i.setGithubToken(null)}>
            Remove
          </button>
        )}
      </div>

      <h3>MCP servers</h3>
      <p className="model-license">
        Extra tools from programs you choose. A server runs on your PC with your permissions, so only add ones you trust. Each of its
        actions asks you first unless you mark it Trusted (then only its read-only tools skip the question).
      </p>
      {integrations.mcp.length > 0 && (
        <ul className="data-list">
          {integrations.mcp.map((m) => (
            <li key={m.id}>
              <span>
                {m.name} <small className={m.status === 'error' ? 'warn' : ''}>{STATUS[m.status]}{m.error ? `: ${m.error}` : ''}</small>
                <small className="selectable">{m.url ?? [m.command, ...m.args].join(' ')}</small>
                {m.tools.length > 0 && <small>Tools: {m.tools.join(', ')}</small>}
              </span>
              <span className="mcp-controls">
                <label>
                  <input type="checkbox" checked={m.trusted} onChange={(e) => void i.updateMcp(m.id, { trusted: e.target.checked })} /> Trusted
                </label>
                <label>
                  <input type="checkbox" checked={m.enabled} onChange={(e) => void i.updateMcp(m.id, { enabled: e.target.checked })} /> On
                </label>
                {m.status === 'error' && (
                  <button type="button" className="secondary small" onClick={() => void i.restartMcp(m.id)}>
                    Retry
                  </button>
                )}
                <button type="button" className="secondary small" onClick={() => void i.removeMcp(m.id)} aria-label={`Remove ${m.name}`}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="model-actions">
        {PRESETS.filter((p) => !integrations.mcp.some((m) => m.name === p.name)).map((p) => (
          <button key={p.name} type="button" className="secondary" title={p.note} onClick={() => void i.addMcp(p.name, p.target)}>
            + {p.name}
          </button>
        ))}
      </div>
      <form className="inline add-memory" onSubmit={(e) => void add(e)}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Server name" maxLength={60} />
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Command, e.g. npx -y some-mcp-server" aria-label="Server command or URL" />
        <button type="submit" disabled={!name.trim() || !target.trim()}>
          Add
        </button>
      </form>
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
