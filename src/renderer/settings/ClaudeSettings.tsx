import { useState } from 'react'
import type { ClaudeState } from '@shared/ipc'

export function ClaudeSettings({ claude }: { claude: ClaudeState }): React.JSX.Element {
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null)

  async function install(): Promise<void> {
    const r = await window.assistant.claude.installHooks()
    setNote(r.ok ? { error: false, text: r.backup ? `Done. Your previous settings were backed up to ${r.backup}` : 'Done.' } : { error: true, text: r.message })
  }

  return (
    <section aria-labelledby="claude-heading">
      <h2 id="claude-heading">Claude Code</h2>
      <p className="field">
        <span>Command-line tool</span>
        <span className="inline">
          <span className="selectable model-license">{claude.path ?? 'Not found'}</span>
          <button type="button" className="secondary small" onClick={() => void window.assistant.claude.choosePath()}>
            Choose…
          </button>
        </span>
      </p>
      <p className="model-license">
        Tasks run with your own signed-in <code>claude</code>, only in folders from Settings → Tools, and never skip its permission checks.
        If it says “not logged in”, open a terminal, run <code>claude</code> and type /login.
      </p>

      <label className="row">
        <span>
          Tell me when Claude Code finishes or needs me
          <small>
            Adds two hooks (Stop, Notification) to your Claude Code settings. Your file is backed up first, and turning this off removes only
            Lumi’s hooks.{!claude.hookServer && ' (The notification port is busy right now, so this is unavailable until restart.)'}
          </small>
        </span>
        <input
          type="checkbox"
          checked={claude.hooksInstalled}
          disabled={!claude.hookServer && !claude.hooksInstalled}
          onChange={(e) => void (e.target.checked ? install() : window.assistant.claude.uninstallHooks().then(() => setNote(null)))}
        />
      </label>
      {note && (
        <p className={note.error ? 'warn' : 'model-license'} role={note.error ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}
    </section>
  )
}
