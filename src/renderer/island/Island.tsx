import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MicButton } from '../ui/MicButton'
import { RichText } from '../ui/RichText'
import { useAppState } from '../ui/useAppState'
import { useConversation } from '../ui/useConversation'

const tail = (text: string, n: number): string => (text.length > n ? '…' + text.slice(-n).trimStart() : text)

export function Island(): React.JSX.Element {
  const state = useAppState()
  const { items, status } = useConversation()
  const [draft, setDraft] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const replyEnd = useRef<HTMLDivElement>(null)
  const expanded = state?.islandExpanded ?? false
  const busy = status !== 'idle' || state?.character === 'SPEAKING'

  const lastUser = [...items].reverse().find((i) => i.role === 'user')
  const lastReply = lastUser ? [...items].reverse().find((i) => i.id > lastUser.id && (i.role === 'assistant' || i.role === 'error')) : undefined

  useEffect(() => {
    if (expanded) input.current?.focus()
  }, [expanded])
  useEffect(() => {
    replyEnd.current?.scrollIntoView({ block: 'end' })
  }, [lastReply?.text])

  const setExpanded = (value: boolean): void => void window.assistant.island.setExpanded(value)

  function send(event?: FormEvent): void {
    event?.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    void window.assistant.chat.send(text)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return
    if (busy) void window.assistant.chat.cancel()
    else setExpanded(false)
  }

  const label =
    status === 'thinking'
      ? 'Thinking…'
      : status === 'streaming' && lastReply
        ? tail(lastReply.text, 46)
        : `Ask ${state?.assistantName ?? 'Lumi'}…`

  if (!expanded) {
    return (
      <button type="button" className={`pill liquid ${status}`} onClick={() => setExpanded(true)} aria-label={`Assistant: ${label}. Open quick ask.`}>
        <span className={`dot ${status}`} aria-hidden="true" />
        <span className="pill-text">{label}</span>
        {state?.islandShortcut.registered && <kbd>{state.islandShortcut.accelerator.replaceAll('+', ' ')}</kbd>}
      </button>
    )
  }

  return (
    <section className="panel liquid" aria-label="Quick ask" onKeyDown={onKeyDown}>
      <header>
        <span className={`dot ${status}`} aria-hidden="true" />
        <span className="panel-title">{state ? `${state.assistantName} · ${state.ai.model}${state.ai.local ? '' : ' · cloud'}` : 'Lumi'}</span>
        <button type="button" className="link" onClick={() => void window.assistant.openWindow('chat')}>
          Open chat
        </button>
        <button type="button" className="close" onClick={() => setExpanded(false)} aria-label="Close quick ask">
          ×
        </button>
      </header>

      <div className="exchange" aria-live="polite">
        {lastUser ? (
          <>
            <p className="you">{lastUser.text}</p>
            {lastReply ? (
              <div className={lastReply.role === 'error' ? 'reply error' : 'reply'}>
                {lastReply.role === 'assistant' ? <RichText text={lastReply.text} /> : lastReply.text}
              </div>
            ) : (
              <p className="reply muted">{busy ? 'Thinking…' : ''}</p>
            )}
          </>
        ) : (
          <p className="reply muted">Ask a quick question. The full conversation is in the chat window.</p>
        )}
        {voiceError && (
          <p className="reply error" role="alert">
            {voiceError}
          </p>
        )}
        <div ref={replyEnd} />
      </div>

      <form onSubmit={send}>
        <label htmlFor="island-input" className="visually-hidden">
          Message
        </label>
        <input
          id="island-input"
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask anything…"
          maxLength={8000}
          autoComplete="off"
        />
        {state?.voice.input && <MicButton micId={state.voice.micId} onError={setVoiceError} />}
        {busy ? (
          <button type="button" onClick={() => void window.assistant.chat.cancel()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim()}>
            Send
          </button>
        )}
      </form>
    </section>
  )
}
