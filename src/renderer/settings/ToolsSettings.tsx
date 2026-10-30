import type { ToolsState } from '@shared/ipc'

const PERMISSION_LABELS: Record<string, string> = {
  'files.read': 'reads files in approved folders',
  'files.write': 'writes notes and files in approved folders (backed up)',
  'desktop.control': 'sees the active window and operates apps (mouse, keyboard)',
  'projects.run': 'runs package.json scripts in approved project folders',
  'apps.launch': 'opens installed apps and your folders',
  'apps.install': 'installs apps with winget',
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
      <p className="model-license">Lumi can only use what you allow here. Anything that changes something asks you first, unless “Do what I ask without asking first” is on (below).</p>

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
      <label className="row">
        <span>
          Do what I ask without asking first
          <small>
            Lumi opens apps, clicks, types, writes files and downloads as soon as you ask, with no “Allow” card. The island turns red
            while it acts; Ctrl+Alt+Shift+X stops it. Turn off to approve each action.
          </small>
        </span>
        <input type="checkbox" checked={tools.autoApprove} onChange={(e) => void t.setAutoApprove(e.target.checked)} />
      </label>
      <label className="row">
        <span>
          Let cloud AI see screenshots
          <small>
            Off by default. When on, and a cloud model that can see images is chosen, Lumi may send a screenshot of a window it cannot read
            otherwise (asking you first each time). Nothing is sent to Lumi’s built-in AI or stored.
          </small>
        </span>
        <input type="checkbox" checked={tools.screenshots} onChange={(e) => void t.setScreenshots(e.target.checked)} />
      </label>
    </section>
  )
}
