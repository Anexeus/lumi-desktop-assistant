import { useCallback, useEffect, useRef, useState } from 'react'
import { downsample, encodeWav } from './wav'

const MAX_SECONDS = 60

export type RecorderStatus = 'idle' | 'recording' | 'transcribing'

/**
 * Push-to-talk: the microphone opens on start() and closes on stop()/cancel(). Nothing listens otherwise.
 * stop() transcribes the recording and sends it as a chat message.
 */
export function useRecorder(micId: string): {
  status: RecorderStatus
  level: number
  error: string | null
  start(): Promise<void>
  stop(): Promise<void>
  cancel(): void
} {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const session = useRef<{ stream: MediaStream; ctx: AudioContext; chunks: Float32Array[]; timer: number } | null>(null)

  const close = useCallback((): { samples: Float32Array; rate: number } | null => {
    const s = session.current
    if (!s) return null
    session.current = null
    clearTimeout(s.timer)
    s.stream.getTracks().forEach((t) => t.stop()) // releases the mic (and the Windows mic indicator)
    const rate = s.ctx.sampleRate
    void s.ctx.close()
    setLevel(0)
    const length = s.chunks.reduce((n, c) => n + c.length, 0)
    const samples = new Float32Array(length)
    let at = 0
    for (const c of s.chunks) {
      samples.set(c, at)
      at += c.length
    }
    return { samples, rate }
  }, [])

  const stop = useCallback(async () => {
    const recording = close()
    if (!recording) return
    if (recording.samples.length < recording.rate * 0.3) {
      setStatus('idle')
      void window.assistant.characterEvent('cancel')
      return setError('That was too short. Click the mic, speak, then click again.')
    }
    setStatus('transcribing')
    const result = await window.assistant.voice.transcribe(encodeWav(downsample(recording.samples, recording.rate)))
    setStatus('idle')
    if (!result.ok) {
      void window.assistant.characterEvent('cancel')
      return setError(result.message)
    }
    if (!result.text) {
      void window.assistant.characterEvent('cancel')
      return setError('I didn’t catch anything. Try again a bit closer to the mic.')
    }
    void window.assistant.chat.send(result.text)
  }, [close])

  const cancel = useCallback(() => {
    if (!close()) return
    setStatus('idle')
    void window.assistant.characterEvent('cancel')
  }, [close])

  const start = useCallback(async () => {
    if (session.current) return
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true, channelCount: 1 }
      })
    } catch {
      return setError('The microphone is not available. Check that voice input is on in Settings and that Windows allows mic access.')
    }
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    // shortcut: ScriptProcessorNode is deprecated but universally supported; move to an AudioWorklet if Chromium drops it.
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const chunks: Float32Array[] = []
    processor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0)
      chunks.push(new Float32Array(data))
      let sum = 0
      for (const s of data) sum += s * s
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 8))
    }
    source.connect(processor)
    processor.connect(ctx.destination) // required for onaudioprocess to fire; the output is silent
    const timer = window.setTimeout(() => void stop(), MAX_SECONDS * 1000)
    session.current = { stream, ctx, chunks, timer }
    setStatus('recording')
    void window.assistant.characterEvent('listen')
  }, [micId, stop])

  useEffect(() => () => void close(), [close])

  return { status, level, error, start, stop, cancel }
}
