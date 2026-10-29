import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MicButton } from '../ui/MicButton'
import { useAppState } from '../ui/useAppState'
import { useConversation } from '../ui/useConversation'

export function Chat(): React.JSX.Element {
  const state = useAppState()
  const { items, status } = useConversation()
  const [draft, setDraft] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const listEnd = useRef<HTMLDivElement>(null)
  // Busy while the text streams, and also while she is still saying it.
  const busy = status !== 'idle' || state?.character === 'SPEAKING'

  // Block body on purpose: newer Chromium returns a Promise from scrollIntoView, and React
  // would treat that return value as the effect's cleanup function.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' })
  }, [items])

  function send(event?: FormEvent): void {
    event?.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    void window.assistant.chat.send(text)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) send(event)
    if (event.key === 'Escape' && busy) void window.assistant.chat.cancel()
  }

  const ai = state?.ai
  return (
    <main className="chat">
      <header className="chat-header">
        <h1>Assistant</h1>
        <div className="header-actions">
          {ai && (
            <span className={`badge ${ai.local ? 'local' : 'cloud'}`} title={ai.baseUrl}>
              {ai.model} · {ai.local ? 'on this PC' : 'cloud'}
            </span>
          )}
          <button type="button" className="ghost" onClick={() => void window.assistant.chat.clear()} disabled={!items.length}>
            New chat
          </button>
          <button type="button" className="ghost" onClick={() => void window.assistant.openWindow('settings')}>
            Settings
          </button>
        </div>
      </header>

      <section className="messages" aria-label="Conversation" aria-live="polite">
        {items.length === 0 && <p className="empty">Ask me anything. Type /help for commands.</p>}
        {items.map((m) => (
          <p key={m.id} className={`bubble ${m.role}`}>
            <span className="visually-hidden">{m.role === 'user' ? 'You: ' : m.role === 'error' ? 'Error: ' : 'Assistant: '}</span>
            {m.text}
          </p>
        ))}
        {status === 'thinking' && <p className="bubble assistant typing" aria-label="Assistant is thinking">…</p>}
        <div ref={listEnd} />
      </section>

      {voiceError && (
        <p className="cloud-note" role="alert">
          {voiceError}
        </p>
      )}
      {ai && !ai.local && <p className="cloud-note">Messages are sent to {new URL(ai.baseUrl).host}.</p>}
      <form className="composer" onSubmit={send}>
        <label htmlFor="message" className="visually-hidden">
          Message
        </label>
        <textarea
          id="message"
          rows={2}
          value={draft}
          placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={8000}
          autoFocus
        />
        {state?.voice.input && <MicButton micId={state.voice.micId} onError={setVoiceError} />}
        {busy ? (
          <button type="button" className="stop" onClick={() => void window.assistant.chat.cancel()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim()}>
            Send
          </button>
        )}
      </form>
    </main>
  )
}
