import { useState } from 'react'
import { TitleBar } from '../ui/TitleBar'
import { useAppState } from '../ui/useAppState'
import { AiSettings } from './AiSettings'
import { MemorySettings } from './MemorySettings'
import { ClaudeSettings } from './ClaudeSettings'
import { IntegrationsSettings } from './IntegrationsSettings'
import { ToolsSettings } from './ToolsSettings'
import { VoiceSettings } from './VoiceSettings'

export function Settings(): React.JSX.Element {
  const state = useAppState()
  const [modelError, setModelError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!state) return <main className="settings" aria-busy="true" />

  async function chooseModel(): Promise<void> {
    setBusy(true)
    setModelError(null)
    const result = await window.assistant.model.choose()
    if (!result.ok && !result.canceled) setModelError(result.message ?? 'Could not load that file.')
    setBusy(false)
  }

  const { model } = state

  return (
    <div className="settings-shell">
      <TitleBar title={`${state.assistantName} · Settings`} />
      <main className="settings">

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

      <AiSettings ai={state.ai} />

      <VoiceSettings voice={state.voice} />

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
      </section>

      <section aria-labelledby="model-heading">
        <h2 id="model-heading">Character model</h2>
        <div className="model">
          <p className="model-name" aria-live="polite">
            {model.name}
            {model.authors.length > 0 && <small> by {model.authors.join(', ')}</small>}
          </p>
          {model.licenseUrl && (
            <p className="model-license">
              License: <span className="selectable">{model.licenseUrl}</span>
            </p>
          )}
          {!model.custom && (
            <p className="model-license">Default model. Seed-san © VirtualCast, Inc., VRM Public License 1.0.</p>
          )}
          <div className="model-actions">
            <button type="button" onClick={() => void chooseModel()} disabled={busy}>
              Choose a .vrm file…
            </button>
            {model.custom && (
              <button type="button" className="secondary" onClick={() => void window.assistant.model.reset()}>
                Use the default
              </button>
            )}
          </div>
          {modelError && (
            <p className="warn" role="alert">
              {modelError}
            </p>
          )}
          <p className="model-license">Only use models whose license allows it. Your file is copied; the original is never changed.</p>
        </div>
      </section>

      <ToolsSettings tools={state.tools} />

      <IntegrationsSettings integrations={state.integrations} />

      <ClaudeSettings claude={state.claude} />

      <MemorySettings state={state} />

      <section aria-labelledby="keys-heading">
        <h2 id="keys-heading">Keyboard</h2>
        <dl className="keys">
          <dt>Show or hide the character</dt>
          <dd>
            <kbd>{state.shortcut.accelerator.replaceAll('+', ' + ')}</kbd>
            {!state.shortcut.registered && <span className="warn"> (taken by another app)</span>}
          </dd>
          <dt>Open the island for a quick question</dt>
          <dd>
            <kbd>{state.islandShortcut.accelerator.replaceAll('+', ' + ')}</kbd>
            {!state.islandShortcut.registered && <span className="warn"> (taken by another app)</span>}
          </dd>
          <dt>With the character focused</dt>
          <dd>
            <kbd>Enter</kbd> chat · <kbd>Shift + F10</kbd> menu · <kbd>+</kbd> / <kbd>−</kbd> size
          </dd>
        </dl>
      </section>

      
      </main>
    </div>
  )
}
