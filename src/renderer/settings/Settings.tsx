import type { AppState, Graphics } from '@shared/ipc'
import { CHARACTERS } from '@shared/characters'
import { DEFAULT_SHORTCUTS, formatAccelerator, SHORTCUT_ACTIONS, toAccelerator, type ShortcutAction } from '@shared/shortcuts'
import { useState, type KeyboardEvent } from 'react'
import { useAppState } from '../ui/useAppState'
import { AiSettings } from './AiSettings'
import { MemorySettings } from './MemorySettings'
import { ClaudeSettings } from './ClaudeSettings'
import { IntegrationsSettings } from './IntegrationsSettings'
import { ToolsSettings } from './ToolsSettings'
import { VoiceSettings } from './VoiceSettings'

const GRAPHICS: { value: Graphics; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Lower resolution, 24 fps. Easiest on battery and older PCs.' },
  { value: 'balanced', label: 'Balanced', hint: 'Sharp on most screens, 30 fps.' },
  { value: 'high', label: 'High', hint: 'Full resolution, smooth 60 fps. Uses more GPU.' }
]

const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  character: 'Show or hide the character',
  island: 'Open the island for a quick question',
  stop: 'Stop everything Lumi is doing'
}

/** One global shortcut: click the keys, press the new combination (Esc cancels), or reset it. */
function ShortcutRow({ action, value }: { action: ShortcutAction; value: AppState['shortcuts'][ShortcutAction] }): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelId = `shortcut-${action}`

  async function save(accelerator: string | null): Promise<void> {
    setRecording(false)
    const result = await window.assistant.setShortcut(action, accelerator)
    setError(result.ok ? null : result.message)
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!recording) return
    e.preventDefault() // Tab, Space and the rest become part of the shortcut, not page actions
    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) return setRecording(false)
    const accelerator = toAccelerator(e)
    if (accelerator) void save(accelerator)
  }

  return (
    <div className="shortcut">
      <span id={labelId}>{SHORTCUT_LABELS[action]}</span>
      <button
        type="button"
        className={`shortcut-keys${recording ? ' recording' : ''}`}
        aria-labelledby={labelId}
        aria-pressed={recording}
        aria-describedby={`${labelId}-hint`}
        onClick={() => {
          setError(null)
          setRecording(!recording)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setRecording(false)}
      >
        {recording ? 'Press the new keys…' : <kbd>{formatAccelerator(value.accelerator)}</kbd>}
      </button>
      <button type="button" className="secondary" disabled={value.accelerator === DEFAULT_SHORTCUTS[action]} onClick={() => void save(null)}>
        Reset
      </button>
      <small id={`${labelId}-hint`} className={error || !value.registered ? 'warn' : undefined} role={error ? 'alert' : undefined}>
        {error ?? (!value.registered ? 'Another app uses these keys, so this shortcut is off. Choose different keys.' : recording ? 'Use Ctrl, Alt or Win with one key. Esc cancels.' : '')}
      </small>
    </div>
  )
}

const TABS = ['General', 'AI', 'Voice', 'Character', 'Tools', 'Integrations', 'Claude Code', 'Memory'] as const
type Tab = (typeof TABS)[number]
const tabId = (t: Tab): string => `settings-tab-${t.toLowerCase().replace(/\s+/g, '-')}`

/** Settings, shown inside the chat window: a tab bar on top, one section group at a time. */
export function Settings(): React.JSX.Element {
  const state = useAppState()
  const [modelError, setModelError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('General')
  if (!state) return <main className="settings" aria-busy="true" />

  async function chooseModel(): Promise<void> {
    setBusy(true)
    setModelError(null)
    const result = await window.assistant.model.choose()
    if (!result.ok && !result.canceled) setModelError(result.message ?? 'Could not load that file.')
    setBusy(false)
  }

  const { model } = state
  const keyboard = (
    <section aria-labelledby="keys-heading">
      <h2 id="keys-heading">Keyboard shortcuts</h2>
      <p className="note">These work everywhere in Windows. Click the keys to change them.</p>
      {SHORTCUT_ACTIONS.map((action) => (
        <ShortcutRow key={action} action={action} value={state.shortcuts[action]} />
      ))}
      <dl className="keys">
        <dt>With the character focused</dt>
        <dd>
          <kbd>Enter</kbd> chat · <kbd>Shift + F10</kbd> menu · <kbd>+</kbd> / <kbd>−</kbd> size
        </dd>
      </dl>
    </section>
  )
  // Arrow keys move between tabs (the WAI-ARIA tabs pattern); Tab moves into the section.
  const onTabKey = (e: KeyboardEvent): void => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length]!
    setTab(next)
    document.getElementById(tabId(next))?.focus()
  }

  return (
    <div className="settings-shell">
      <nav className="tabs" role="tablist" aria-label="Settings sections" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t}
            id={tabId(t)}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls="settings-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="settings" role="tabpanel" id="settings-panel" aria-labelledby={tabId(tab)}>
      {tab === 'General' && (
      <>
      <section aria-labelledby="name-heading">
        <h2 id="name-heading">Assistant</h2>
        <label className="field">
          <span>Name</span>
          <input
            defaultValue={state.assistantName}
            maxLength={40}
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (name && name !== state.assistantName) void window.assistant.setAssistantName(name)
              else e.target.value = state.assistantName
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      </section>

      <section aria-labelledby="character-heading">
        <h2 id="character-heading">Character</h2>
        <label className="row">
          <span>
            Show character
            <small>Hide it without quitting. The tray icon brings it back.</small>
          </span>
          <input
            type="checkbox"
            checked={state.characterVisible}
            onChange={(e) => void window.assistant.setCharacterVisible(e.target.checked)}
          />
        </label>
        <label className="row">
          <span>
            Always on top
            <small>Keep the character above other windows.</small>
          </span>
          <input
            type="checkbox"
            checked={state.alwaysOnTop}
            onChange={(e) => void window.assistant.setAlwaysOnTop(e.target.checked)}
          />
        </label>
        <label className="row">
          <span>
            Show the island
            <small>A small bar at the top of the screen for quick questions.</small>
          </span>
          <input
            type="checkbox"
            checked={state.islandVisible}
            onChange={(e) => void window.assistant.setIslandVisible(e.target.checked)}
          />
        </label>
        {state.glass && (
          <div className="field">
            <span id="island-look-label">Island look</span>
            <div className="segmented" role="radiogroup" aria-labelledby="island-look-label">
              {(['pill', 'glass'] as const).map((look) => (
                <button key={look} type="button" role="radio" aria-checked={state.islandStyle === look} onClick={() => void window.assistant.setIslandStyle(look)}>
                  {look === 'pill' ? 'Pill' : 'Frosted glass'}
                </button>
              ))}
            </div>
            <small className="model-license">
              {state.islandStyle === 'pill'
                ? 'A black capsule with round ends, like a phone’s Dynamic Island.'
                : 'Blurs what is behind it, like the taskbar. Windows can only round its corners slightly.'}
            </small>
          </div>
        )}
      </section>
      {keyboard}
      </>
      )}

      {tab === 'AI' && <AiSettings ai={state.ai} local={state.local} />}
      {tab === 'Voice' && <VoiceSettings voice={state.voice} local={state.local} />}

      {tab === 'Character' && (
      <section aria-labelledby="model-heading">
        <h2 id="model-heading">Character model</h2>
        <div className="model">
          <p className="model-name" aria-live="polite">
            {model.name}
            {model.authors.length > 0 && <small> by {model.authors.join(', ')}</small>}
          </p>
          {model.custom && model.licenseUrl && (
            <p className="model-license">
              License: <span className="selectable">{model.licenseUrl}</span>
            </p>
          )}
          {model.license && (
            <p className="model-license">
              © {model.authors.join(', ')} · {model.license} · <span className="selectable">{model.licenseUrl}</span>
            </p>
          )}
          <div className="characters" role="radiogroup" aria-label="Characters">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={model.id === c.id}
                className="character-choice"
                disabled={busy}
                onClick={() => void window.assistant.model.select(c.id)}
              >
                <strong>{c.name}</strong>
                <small>{c.voice} voice</small>
              </button>
            ))}
          </div>
          <div className="model-actions">
            <button type="button" className="secondary" onClick={() => void chooseModel()} disabled={busy}>
              Use my own .vrm file…
            </button>
          </div>
          <div className="find-more">
            <span>
              Want Hatsune Miku, Kasane Teto or someone else? Their creators don’t allow apps to include them, but you can download a free
              model for yourself on VRoid Hub (sign in with pixiv, open a model whose terms allow it, press Download), then choose
              “Use my own .vrm file…”.
            </span>
            <span className="model-actions">
              <button type="button" className="secondary small" onClick={() => void window.assistant.model.openSite('miku')}>
                Find Miku
              </button>
              <button type="button" className="secondary small" onClick={() => void window.assistant.model.openSite('teto')}>
                Find Teto
              </button>
              <button type="button" className="secondary small" onClick={() => void window.assistant.model.openSite('browse')}>
                Browse VRoid Hub
              </button>
            </span>
          </div>
          <div className="field">
            <span id="graphics-label">Graphics quality</span>
            <div className="segmented" role="radiogroup" aria-labelledby="graphics-label">
              {GRAPHICS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  role="radio"
                  aria-checked={state.graphics === g.value}
                  onClick={() => void window.assistant.model.setGraphics(g.value)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <small className="model-license">{GRAPHICS.find((g) => g.value === state.graphics)?.hint}</small>
          </div>
          {modelError && (
            <p className="warn" role="alert">
              {modelError}
            </p>
          )}
          <p className="model-license">Only use models whose license allows it. Your file is copied; the original is never changed.</p>
        </div>
      </section>
      )}

      {tab === 'Tools' && <ToolsSettings tools={state.tools} />}
      {tab === 'Integrations' && <IntegrationsSettings integrations={state.integrations} />}
      {tab === 'Claude Code' && <ClaudeSettings claude={state.claude} />}
      {tab === 'Memory' && <MemorySettings state={state} />}


      
      </main>
    </div>
  )
}
