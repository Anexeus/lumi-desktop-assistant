import { useState, type FormEvent } from 'react'
import type { AppState, ClaudeMode } from '@shared/ipc'

const MODES: { value: ClaudeMode; label: string }[] = [
  { value: 'plan', label: 'Plan only (read-only)' },
  { value: 'manual', label: 'Ask (blocked actions are reported)' },
  { value: 'acceptEdits', label: 'May edit files' }
]
const STATUS = { running: 'Running…', done: 'Done', failed: 'Failed', canceled: 'Canceled' }
const name = (p: string): string => p.split(/[\\/]/).filter(Boolean).at(-1) ?? p

export function TasksPanel({ state }: { state: AppState }): React.JSX.Element {
  const folders = state.tools.folders
  const [prompt, setPrompt] = useState('')
  const [project, setProject] = useState(folders[0] ?? '')
  const [mode, setMode] = useState<ClaudeMode>('plan')
  const { claude } = state

  function start(event: FormEvent): void {
    event.preventDefault()
    if (!prompt.trim() || !project) return
    void window.assistant.claude.start(prompt.trim(), project, mode)
    setPrompt('')
  }

  return (
    <section className="tasks" aria-label="Claude Code tasks">
      {!claude.path && <p className="cloud-note">Claude Code was not found. Install it, or choose it in Settings → Claude Code.</p>}
      {folders.length ? (
        <form className="task-form" onSubmit={start}>
          <label className="visually-hidden" htmlFor="task-prompt">
            Task for Claude Code
          </label>
          <textarea id="task-prompt" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask Claude Code to…" maxLength={8000} />
          <div className="task-options">
            <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project folder">
              {folders.map((f) => (
                <option key={f} value={f}>
                  {name(f)}
                </option>
              ))}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value as ClaudeMode)} aria-label="Permission mode">
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button type="submit" disabled={!prompt.trim() || !claude.path}>
              Start
            </button>
          </div>
        </form>
      ) : (
        <p className="cloud-note">Add a project folder in Settings → Tools first. Claude Code only runs in folders you approve.</p>
      )}

      <ul className="task-list">
        {claude.tasks.map((t) => (
          <li key={t.id} className={`task ${t.status}`}>
            <div className="task-head">
              <strong>{name(t.project)}</strong>
              <span className="badge">{STATUS[t.status]}</span>
              {t.status === 'running' && (
                <button type="button" className="secondary small" onClick={() => void window.assistant.claude.cancel(t.id)}>
                  Cancel
                </button>
              )}
            </div>
            <p className="task-prompt">{t.prompt}</p>
            {t.progress.length > 0 && (
              <ol className="task-progress" aria-label="Progress">
                {t.progress.slice(-4).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            )}
            {t.result && <p className="task-result selectable">{t.result}</p>}
            {(t.cost !== undefined || t.denials) && (
              <p className="task-meta">
                {t.cost !== undefined && `≈ $${t.cost.toFixed(4)} of usage`}
                {t.denials ? ` · ${t.denials} action${t.denials === 1 ? '' : 's'} blocked by the ${t.mode} mode` : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
      {claude.events.length > 0 && (
        <ul className="task-events" aria-label="From Claude Code">
          {claude.events.slice(0, 5).map((e) => (
            <li key={e.at}>
              {new Date(e.at).toLocaleTimeString()} · {e.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
