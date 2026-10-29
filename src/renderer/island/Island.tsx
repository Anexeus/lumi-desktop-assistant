import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MicButton } from '../ui/MicButton'
import { RichText } from '../ui/RichText'
import { useAppState } from '../ui/useAppState'
import { useConversation } from '../ui/useConversation'
import { useVoiceMode, type VoicePhase } from '../ui/useVoiceMode'

const VOICE_LABEL: Record<Exclude<VoicePhase, 'off'>, string> = { listening: 'Listening…', hearing: 'Hearing you…', transcribing: 'Got it…' }
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
  const voice = useVoiceMode(state?.voice.micId ?? '', busy)
  const talking = voice.phase !== 'off'

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
        : talking
          ? VOICE_LABEL[voice.phase as Exclude<VoicePhase, 'off'>]
          : voice.error
            ? voice.error
            : state?.voice.input
              ? `Talk to ${state.assistantName}…`
              : `Ask ${state?.assistantName ?? 'Lumi'}…`

  if (!expanded) {
    const canTalk = !!state?.voice.input
    return (
      <div className={`pill liquid ${status}${talking ? ' talking' : ''}`} style={{ '--level': voice.level } as React.CSSProperties}>
        <button
          type="button"
          className="pill-main"
          onClick={() => void (canTalk ? voice.toggle() : setExpanded(true))}
          aria-pressed={canTalk ? talking : undefined}
          aria-label={canTalk ? `Voice mode${talking ? ' on' : ''}: ${label}. Click to ${talking ? 'stop' : 'talk'}.` : `Assistant: ${label}. Click to type.`}
        >
          <span className={`dot ${talking ? 'talking' : status}`} aria-hidden="true" />
          <span className={`pill-text${voice.error && !talking ? ' error' : ''}`}>{label}</span>
        </button>
        <button type="button" className="pill-type" onClick={() => setExpanded(true)} aria-label="Open quick ask" title="Type instead">
          {state?.islandShortcut.registered ? <kbd>{state.islandShortcut.accelerator.replaceAll('+', ' ')}</kbd> : <kbd>Type</kbd>}
        </button>
      </div>
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
