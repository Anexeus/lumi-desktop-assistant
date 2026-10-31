import { findLocalModel } from '@shared/localModels'
import { formatAccelerator } from '@shared/shortcuts'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MicButton } from '../ui/MicButton'
import { Orb, type OrbMode } from '../ui/Orb'
import { RichText } from '../ui/RichText'
import { useAppState } from '../ui/useAppState'
import { useConversation } from '../ui/useConversation'
import { useVoiceMode, type VoicePhase } from '../ui/useVoiceMode'

const VOICE_LABEL: Record<Exclude<VoicePhase, 'off'>, string> = { listening: 'Listening… tap to stop', hearing: 'Hearing you…', transcribing: 'Got it…' }
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
  const voice = useVoiceMode(state?.voice.micId ?? '', busy, state?.voice.wake ? state.assistantName : undefined)
  const talking = voice.phase !== 'off'
  const name = state?.assistantName ?? 'Lumi'

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
      ? 'Thinking… tap to stop'
      : status === 'streaming' && lastReply
        ? tail(lastReply.text, 46)
        : talking
          ? (voice.error ?? (voice.phase === 'listening' && state?.voice.wake && voice.needsName ? `Listening for “${name}, …” · tap to stop` : VOICE_LABEL[voice.phase as Exclude<VoicePhase, 'off'>]))
          : voice.error
            ? voice.error
            : state?.voice.input
              ? `Tap to talk to ${name}`
              : `Ask ${name}…`
  const orbMode: OrbMode = status !== 'idle' ? status : talking ? 'listening' : 'idle'
  const glass = state?.glass && state.islandStyle === 'glass' ? ' glass' : ''

  if (!expanded && state?.controlling) {
    // While Lumi operates the desktop the pill becomes the emergency stop.
    return (
      <div className={`pill controlling${glass}`}>
        <button type="button" className="pill-main" onClick={() => void window.assistant.stop()} aria-label={`${name} is using your PC. Click to stop.`}>
          <Orb mode="controlling" />
          <span className="pill-text">{name} is using your PC · tap to stop</span>
        </button>
        <kbd>{formatAccelerator(state.shortcuts.stop.accelerator, ' ')}</kbd>
      </div>
    )
  }

  if (!expanded) {
    const canTalk = !!state?.voice.input
    const island = state?.shortcuts.island
    // A tap while she thinks or talks stops her, and voice mode with her; otherwise it starts or stops listening.
    const tap = (): void => {
      if (busy) {
        void window.assistant.chat.cancel()
        if (talking) void voice.toggle()
      } else if (canTalk) void voice.toggle()
      else setExpanded(true)
    }
    const action = busy ? 'stop' : canTalk ? (talking ? 'stop' : 'talk') : 'type'
    return (
      <div className={`pill${talking ? ' talking' : ''}${glass}`}>
        <button
          type="button"
          className="pill-main"
          onClick={tap}
          aria-pressed={canTalk ? talking : undefined}
          aria-label={`${canTalk ? `Voice mode${talking ? ' on' : ''}` : 'Assistant'}: ${label}. Click to ${action}.`}
        >
          {/* A new key when voice mode starts or stops, so the orb pops in again like Siri's. */}
          <Orb key={talking ? 'voice' : 'quiet'} mode={orbMode} level={talking ? voice.level : 0} />
          <span className={`pill-text${voice.error && !talking ? ' error' : ''}`}>{label}</span>
        </button>
        <button type="button" className="pill-type" onClick={() => setExpanded(true)} aria-label="Open quick ask" title="Type instead">
          <kbd>{island?.registered ? formatAccelerator(island.accelerator, ' ') : 'Type'}</kbd>
        </button>
      </div>
    )
  }

  return (
    <section className={`panel${glass}`} aria-label="Quick ask" onKeyDown={onKeyDown}>
      <header>
        <Orb mode={orbMode} />
        <span className="panel-title">
          <strong>{name}</strong>
          {state?.islandModel && (
            <small>
              {state.ai.provider === 'builtin' ? `${findLocalModel(state.local.llm)?.name.split(' (')[0] ?? 'Lumi built-in'}, on this PC` : `${state.ai.model}, ${state.ai.local ? 'on this PC' : 'online'}`}
            </small>
          )}
        </span>
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
