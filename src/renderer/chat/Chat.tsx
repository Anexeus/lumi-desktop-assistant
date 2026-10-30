import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MicButton } from '../ui/MicButton'
import { RichText } from '../ui/RichText'
import { Approvals } from './Approvals'
import { TasksPanel } from './TasksPanel'
import { TitleBar } from '../ui/TitleBar'
import { Settings } from '../settings/Settings'
import { useAppState } from '../ui/useAppState'
import { useConversation } from '../ui/useConversation'

export function Chat(): React.JSX.Element {
  const state = useAppState()
  const { items, status } = useConversation()
  const [draft, setDraft] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [showTasks, setShowTasks] = useState(false)
  const listEnd = useRef<HTMLDivElement>(null)
  // Busy while the text streams, and also while she is still saying it.
  const busy = status !== 'idle' || state?.character === 'SPEAKING'
  useEffect(() => {
    if (state) document.title = `${state.assistantName} — Chat`
  }, [state])

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
  if (state?.panelView === 'settings') {
    return (
      <main className="chat">
        <TitleBar title="Settings">
          <button type="button" className="ghost" onClick={() => void window.assistant.openWindow('chat')}>
            ← Chat
          </button>
        </TitleBar>
        <Settings />
      </main>
    )
  }
  return (
    <main className="chat">
      <TitleBar title={state?.assistantName ?? 'Lumi'}>
        {ai && (
          <span className={`badge dot ${ai.local ? 'local' : 'cloud'}`} title={`${ai.model}: ${ai.local ? 'runs on this PC' : `cloud (${ai.baseUrl})`}`}>
            <span className="visually-hidden">{ai.model}{ai.local ? ', on this PC' : ', cloud'}</span>
          </span>
        )}
        <button type="button" className="ghost" onClick={() => setShowTasks((v) => !v)} aria-pressed={showTasks}>
          Tasks{state?.claude.tasks.some((t) => t.status === 'running') ? ' •' : ''}
        </button>
        <button type="button" className="ghost" onClick={() => void window.assistant.chat.clear()} disabled={!items.length}>
          New chat
        </button>
        <button type="button" className="ghost" onClick={() => void window.assistant.openWindow('settings')}>
          Settings
        </button>
      </TitleBar>

      {showTasks && state && <TasksPanel state={state} />}
      <section className="messages" aria-label="Conversation" aria-live="polite">
        {items.length === 0 && (
          <p className="empty">
            <strong>Hi, I’m {state?.assistantName ?? 'Lumi'}</strong>
            Ask me anything, or click the mic and talk. Type /help for commands.
          </p>
        )}
        {items.map((m) =>
          m.role === 'tool' ? (
            <p key={m.id} className="activity">
              <span aria-hidden="true">◆</span> {m.text}
            </p>
          ) : (
          <div key={m.id} className={`bubble ${m.role}`}>
            <span className="visually-hidden">{m.role === 'user' ? 'You: ' : m.role === 'error' ? 'Error: ' : 'Assistant: '}</span>
            {m.role === 'assistant' ? <RichText text={m.text} /> : m.text}
          </div>
          )
        )}
        {status === 'thinking' && <p className="bubble assistant typing" aria-label="Assistant is thinking">…</p>}
        <div ref={listEnd} />
      </section>

      {state && <Approvals requests={state.approvals} />}
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
