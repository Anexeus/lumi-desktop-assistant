import type { AppState } from '@shared/ipc'
import { useState } from 'react'

/** Uses Mate Engine's animations, sounds and characters from the user's own copy (its licence: personal use, credited). */
export function MateSettings({ mate }: { mate: AppState['mate'] }): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const importing = mate.progress !== null

  async function run(): Promise<void> {
    setMessage(null)
    setError(null)
    const result = await window.assistant.mate.import()
    if (result.ok) {
      const characters = result.models.length ? ` and ${result.models.length} characters (${result.models.join(', ')})` : ''
      setMessage(`Imported ${result.clips} animations, ${result.sounds} sounds${characters}.`)
    } else if (!result.canceled) setError(result.message ?? 'Could not import from that folder.')
  }

  return (
    <section aria-labelledby="mate-heading">
      <h2 id="mate-heading">Mate Engine animations</h2>
      <p className="model-license">
        Have Mate Engine on this PC? Lumi can move with its animations (standing, picked up, sitting, sleeping, head pats,
        reactions, dances), play its sounds and add its characters. They are imported from your copy for your own use only;
        they never leave this PC.
      </p>
      {mate.clips > 0 && (
        <p className="model-name">
          {mate.clips} animations and {mate.sounds} sounds in use <small>· Mate Engine by Shiny</small>
        </p>
      )}
      {importing && (
        <p role="status">
          Importing… <progress max={mate.progress!.total} value={mate.progress!.done} aria-label="Import progress" />
        </p>
      )}
      <div className="model-actions">
        <button type="button" className="secondary" onClick={() => void run()} disabled={importing}>
          {mate.clips > 0 ? 'Import again…' : 'Import from Mate Engine…'}
        </button>
        {mate.clips > 0 && (
          <button type="button" className="secondary" onClick={() => void window.assistant.mate.remove()} disabled={importing}>
            Stop using them
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
