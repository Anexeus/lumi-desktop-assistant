import { useAppState } from '../ui/useAppState'

export function Settings(): React.JSX.Element {
  const state = useAppState()
  if (!state) return <main className="settings" aria-busy="true" />

  return (
    <main className="settings">
      <h1>Settings</h1>

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
      </section>

      <section aria-labelledby="keys-heading">
        <h2 id="keys-heading">Keyboard</h2>
        <dl className="keys">
          <dt>Show or hide the character</dt>
          <dd>
            <kbd>{state.shortcut.accelerator.replaceAll('+', ' + ')}</kbd>
            {!state.shortcut.registered && <span className="warn"> (taken by another app)</span>}
          </dd>
          <dt>With the character focused</dt>
          <dd>
            <kbd>Enter</kbd> chat · <kbd>Shift + F10</kbd> menu · <kbd>+</kbd> / <kbd>−</kbd> size
          </dd>
        </dl>
      </section>

      <p className="note">AI providers, voice, memory and tools are added in later milestones.</p>
    </main>
  )
}
