import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
}

// Milestone 1 shell: no provider yet, so replies are a fixed notice. Milestone 3 replaces
// `reply` with a streamed provider response.
const NO_PROVIDER = 'I can’t think yet: no AI provider is connected. That arrives in Milestone 3.'

export function Chat(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', text: 'Hi! I live on your desktop now. Chat comes alive once a provider is set up.' }
  ])
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)
  const listEnd = useRef<HTMLDivElement>(null)

  // Block body on purpose: newer Chromium returns a Promise from scrollIntoView, and React
  // would treat that return value as the effect's cleanup function.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  function send(event?: FormEvent): void {
    event?.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [
      ...m,
      { id: nextId.current++, role: 'user', text },
      { id: nextId.current++, role: 'assistant', text: NO_PROVIDER }
    ])
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) send(event)
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <h1>Assistant</h1>
        <button type="button" className="ghost" onClick={() => void window.assistant.openWindow('settings')}>
          Settings
        </button>
      </header>

      <section className="messages" aria-label="Conversation" aria-live="polite">
        {messages.map((m) => (
          <p key={m.id} className={`bubble ${m.role}`}>
            <span className="visually-hidden">{m.role === 'user' ? 'You: ' : 'Assistant: '}</span>
            {m.text}
          </p>
        ))}
        <div ref={listEnd} />
      </section>

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
          autoFocus
        />
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </main>
  )
}
