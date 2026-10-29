import { useEffect } from 'react'
import { useRecorder } from './useRecorder'

/** Click to talk, click again to send. Esc cancels. Shows a live level meter while the mic is open. */
export function MicButton({ micId, onError }: { micId: string; onError(message: string | null): void }): React.JSX.Element {
  const rec = useRecorder(micId)
  const recording = rec.status === 'recording'

  useEffect(() => onError(rec.error), [rec.error, onError])
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') rec.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [recording, rec])

  const label = recording ? 'Stop and send voice message' : rec.status === 'transcribing' ? 'Transcribing…' : 'Talk (push to talk)'
  return (
    <button
      type="button"
      className={`mic ${rec.status}`}
      onClick={() => void (recording ? rec.stop() : rec.start())}
      disabled={rec.status === 'transcribing'}
      aria-label={label}
      aria-pressed={recording}
      title={label}
      style={{ ['--level' as string]: rec.level }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
        />
      </svg>
      {recording && <span className="mic-live">Listening…</span>}
      {rec.status === 'transcribing' && <span className="mic-live">…</span>}
    </button>
  )
}
