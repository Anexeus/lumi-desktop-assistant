import type { ToolsState } from '@shared/ipc'

const PERMISSION_LABELS: Record<string, string> = {
  'files.read': 'reads files in approved folders',
  'files.write': 'writes notes and files in approved folders (backed up)',
  'apps.launch': 'opens approved apps (asks first)',
  notify: 'shows notifications',
  'web.browse': 'opens web pages in a visible window (asks first)',
  'github.read': 'reads GitHub (public data, or yours with a token)',
  mcp: 'uses tools from servers you added (asks first)',
  'claude-code': 'runs Claude Code tasks you approve'
}

export function ToolsSettings({ tools }: { tools: ToolsState }): React.JSX.Element {
  const t = window.assistant.tools
  return (
    <section aria-labelledby="tools-heading">
      <h2 id="tools-heading">Tools</h2>
      <p className="model-license">Lumi can only use what you allow here. Anything that changes something asks you first.</p>

      <h3>Folders Lumi may search (read-only)</h3>
      {tools.folders.length ? (
        <ul className="data-list">
          {tools.folders.map((f) => (
            <li key={f}>
              <span className="selectable">{f}</span>
              <button type="button" className="secondary small" onClick={() => void t.removeFolder(f)} aria-label={`Remove folder ${f}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="model-license">None yet. Lumi can’t see any of your files until you add a folder.</p>
      )}
      <div className="model-actions">
        <button type="button" className="secondary" onClick={() => void t.addFolder()}>
          Add folder…
        </button>
      </div>

      <h3>Apps and folders Lumi may open</h3>
      {tools.apps.length ? (
        <ul className="data-list">
          {tools.apps.map((a) => (
            <li key={a.path}>
              <span>
                {a.name}
                <small className="selectable">{a.path}</small>
              </span>
              <button type="button" className="secondary small" onClick={() => void t.removeApp(a.path)} aria-label={`Remove ${a.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="model-license">None yet. Add an app, then ask: “open {'<name>'}”.</p>
      )}
      <div className="model-actions">
        <button type="button" className="secondary" onClick={() => void t.addApp('app')}>
          Add app…
        </button>
        <button type="button" className="secondary" onClick={() => void t.addApp('folder')}>
          Add folder shortcut…
        </button>
      </div>

      <h3>Plugins</h3>
      <ul className="data-list plugins">
        {tools.plugins.map((p) => (
          <li key={p.id}>
            <span>
              {p.name} <small>v{p.version}</small>
              <small>{p.description}</small>
              <small>Can: {p.permissions.map((x) => PERMISSION_LABELS[x] ?? x).join(' · ')}</small>
            </span>
            <input
              type="checkbox"
              checked={p.enabled}
              onChange={(e) => void t.setPluginEnabled(p.id, e.target.checked)}
              aria-label={`${p.enabled ? 'Disable' : 'Enable'} ${p.name}`}
            />
          </li>
        ))}
      </ul>

      <label className="row">
        <span>
          Notifications
          <small>When Lumi needs your OK, and when tasks finish.</small>
        </span>
        <input type="checkbox" checked={tools.notifications} onChange={(e) => void t.setNotifications(e.target.checked)} />
      </label>
    </section>
  )
}
