import { useCallback, useEffect, useRef, useState } from 'react'
import { vadInit, vadStep } from './vad'
import { downsample, encodeWav } from './wav'

export type VoicePhase = 'off' | 'listening' | 'hearing' | 'transcribing'

const FRAME = 2048
const PRE_ROLL_FRAMES = 6 // ~250 ms kept from before speech was detected, so first syllables aren't clipped
// With the name check on, her name is needed only after this long without a conversation: tapping the island, or her
// last answer, already means you are talking to her (the owner's "Got it…" and then nothing).
const FOLLOW_UP_MS = 30_000

/**
 * Hands-free voice mode: while on, the mic stays open and each pause in speech sends what was said.
 * Audio is ignored while `paused` (Lumi is thinking or talking) so she never hears herself.
 */
export function useVoiceMode(
  micId: string,
  paused: boolean,
  /** If set, only utterances containing this word (the assistant's name) are sent, without it. */
  wakeWord?: string
): {
  phase: VoicePhase
  level: number
  error: string | null
  /** True when the next sentence needs her name first (the name check is on and the conversation went quiet). */
  needsName: boolean
  toggle(): Promise<void>
} {
  const [phase, setPhase] = useState<VoicePhase>('off')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [needsName, setNeedsName] = useState(!!wakeWord)
  const session = useRef<{ stream: MediaStream; ctx: AudioContext } | null>(null)
  const pausedRef = useRef(paused)
  const busy = useRef(false) // transcribing
  const lastSent = useRef({ text: '', at: 0 })
  const wake = useRef(wakeWord)
  const quietTimer = useRef(0)
  wake.current = wakeWord
  // Talking to her: no name needed until FOLLOW_UP_MS after this.
  const engage = useCallback(() => {
    setNeedsName(false)
    clearTimeout(quietTimer.current)
    quietTimer.current = window.setTimeout(() => setNeedsName(true), FOLLOW_UP_MS)
  }, [])
  pausedRef.current = paused
  useEffect(() => {
    if (!paused && session.current) engage() // she just finished answering: a follow-up needs no name
  }, [paused, engage])
  const needsNameRef = useRef(needsName)
  needsNameRef.current = needsName

  const stop = useCallback(() => {
    const s = session.current
    if (!s) return
    session.current = null
    s.stream.getTracks().forEach((t) => t.stop()) // releases the mic and the Windows mic indicator
    void s.ctx.close()
    setLevel(0)
    setPhase('off')
  }, [])

  const send = useCallback(async (frames: Float32Array[], rate: number) => {
    const length = frames.reduce((n, f) => n + f.length, 0)
    if (length < rate * 0.4) return void window.assistant.characterEvent('cancel') // a cough, not a sentence
    const samples = new Float32Array(length)
    frames.reduce((at, f) => (samples.set(f, at), at + f.length), 0)
    busy.current = true
    setPhase('transcribing')
    const result = await window.assistant.voice.transcribe(encodeWav(downsample(samples, rate)))
    busy.current = false
    if (session.current) setPhase('listening')
    if (!result.ok) {
      void window.assistant.characterEvent('cancel')
      return setError(result.message)
    }
    let text = result.text
    if (!text) {
      void window.assistant.characterEvent('cancel')
      return setError('Didn’t catch that. Try again.')
    }
    if (wake.current) {
      const at = text.toLowerCase().indexOf(wake.current.toLowerCase())
      if (at < 0 && needsNameRef.current) {
        // Not addressed to her. Say so: ignoring it silently looked like the mic was broken.
        void window.assistant.characterEvent('cancel')
        return setError(`Heard you, but only “${wake.current}, …” is sent (Settings → Voice)`)
      }
      if (at >= 0) text = (text.slice(0, at) + text.slice(at + wake.current.length)).replace(/^[\s,.!?]+|[\s,]+$/g, '').trim() || 'Hi'
    }
    // The same sentence twice in a row within a few seconds is an echo or a double detection, not a new request.
    if (text === lastSent.current.text && Date.now() - lastSent.current.at < 5000) return
    lastSent.current = { text, at: Date.now() }
    setError(null)
    void window.assistant.chat.send(text)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true, channelCount: 1 }
      })
    } catch {
      return setError('The microphone is not available. Turn on voice input in Settings → Voice, and allow mic access in Windows.')
    }
    // Unplugging the mic ends the stream: stop cleanly and say why, instead of listening to silence.
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      stop()
      setError('The microphone was disconnected.')
    })
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    // shortcut: ScriptProcessorNode is deprecated but universally supported (same as useRecorder); move both to an AudioWorklet together.
    const processor = ctx.createScriptProcessor(FRAME, 1, 1)
    const vad = vadInit()
    const ms = (FRAME / ctx.sampleRate) * 1000
    let frames: Float32Array[] = []
    processor.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0))
      let sum = 0
      for (const s of data) sum += s * s
      const rms = Math.sqrt(sum / data.length)
      setLevel(Math.min(1, rms * 8))
      if (pausedRef.current || busy.current) {
        Object.assign(vad, vadInit(), { floor: vad.floor })
        frames = []
        return
      }
      frames.push(data)
      const event = vadStep(vad, rms, ms)
      if (event === 'start') {
        setPhase('hearing')
        void window.assistant.characterEvent('listen')
      } else if (event === 'end') {
        const utterance = frames
        frames = []
        setPhase('listening')
        void send(utterance, ctx.sampleRate)
      } else if (!vad.speaking && frames.length > PRE_ROLL_FRAMES) frames.shift()
    }
    source.connect(processor)
    processor.connect(ctx.destination) // required for onaudioprocess to fire; the output is silent
    session.current = { stream, ctx }
    setPhase('listening')
    engage() // the tap itself means "I'm talking to you"
    void window.assistant.voice.warm().catch(() => {}) // load the speech and chat models while you speak
  }, [micId, send, engage])

  const toggle = useCallback(async () => (session.current ? stop() : start()), [start, stop])

  useEffect(
    () => () => {
      stop()
      clearTimeout(quietTimer.current)
    },
    [stop]
  )

  return { phase, level, error, needsName, toggle }
}
