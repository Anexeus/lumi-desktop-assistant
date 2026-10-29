import { LocalModels } from './AiSettings'
import { pickVoice } from '../character/speech'
import { useEffect, useRef, useState } from 'react'
import type { AppState, VoiceSettings as Voice } from '@shared/ipc'
import { fixWavSizes } from '../ui/wav'

const SAMPLE = 'Hi! This is how I sound. Do you like it?'

export function VoiceSettings({ voice, local }: { voice: Voice; local?: AppState['local'] }): React.JSX.Element {
  const [windowsVoices, setWindowsVoices] = useState<string[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null)
  const [micLevel, setMicLevel] = useState<number | null>(null)
  const testing = useRef(false)

  useEffect(() => {
    const load = (): void => setWindowsVoices(speechSynthesis.getVoices().map((v) => v.name))
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    void navigator.mediaDevices.enumerateDevices().then((d) => setMics(d.filter((x) => x.kind === 'audioinput')))
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const save = (patch: Partial<Voice>): void => void window.assistant.voice.setSettings({ ...voice, ...patch })

  async function testVoice(): Promise<void> {
    setStatus(null)
    if (voice.output === 'system') {
      const u = new SpeechSynthesisUtterance(SAMPLE)
      u.rate = voice.speed
      const named = pickVoice(speechSynthesis.getVoices(), voice.voice)
      if (named) u.voice = named
      speechSynthesis.speak(u)
      return
    }
    setStatus({ error: false, text: 'Generating… (the first time can take ~20 s while the model loads)' })
    const result = await window.assistant.voice.synthesize(SAMPLE)
    if (!result.ok) return setStatus({ error: true, text: result.message })
    const ctx = new AudioContext()
    const data = fixWavSizes(result.audio)
    const buffer = await ctx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.onended = () => void ctx.close()
    src.start()
    setStatus({ error: false, text: 'Playing.' })
  }

  async function testMic(): Promise<void> {
    if (testing.current) return
    testing.current = true
    setStatus(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: voice.micId ? { deviceId: { exact: voice.micId } } : true })
      // Now that access was granted once, device names are available.
      setMics((await navigator.mediaDevices.enumerateDevices()).filter((x) => x.kind === 'audioinput'))
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      ctx.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const until = performance.now() + 4000
      await new Promise<void>((done) => {
        const tick = (): void => {
          analyser.getFloatTimeDomainData(samples)
          let sum = 0
          for (const s of samples) sum += s * s
          setMicLevel(Math.min(1, Math.sqrt(sum / samples.length) * 8))
          if (performance.now() < until) requestAnimationFrame(tick)
          else done()
        }
        tick()
      })
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
      setStatus({ error: false, text: 'Microphone works. Speak while testing to see the bar move.' })
    } catch {
      setStatus({ error: true, text: 'Could not open the microphone. Check Windows Settings → Privacy → Microphone.' })
    } finally {
      setMicLevel(null)
      testing.current = false
    }
  }

  return (
    <section aria-labelledby="voice-heading">
      <h2 id="voice-heading">Voice</h2>

      <label className="field">
        <span>Speak replies</span>
        <select value={voice.output} onChange={(e) => save({ output: e.target.value as Voice['output'] })}>
          <option value="local">With the AI service’s voice (e.g. Ollama)</option>
          <option value="system">With a Windows voice</option>
          <option value="off">Don’t speak</option>
        </select>
      </label>

      {voice.output === 'local' && (
        <label className="field">
          <span>Voice model and voice</span>
          <span className="inline">
            <input value={voice.model} onChange={(e) => save({ model: e.target.value })} spellCheck={false} aria-label="Voice model" />
            <input
              value={voice.voice}
              onChange={(e) => save({ voice: e.target.value })}
              placeholder="female"
              spellCheck={false}
              aria-label="Voice name"
              list="ollama-voices"
            />
            <datalist id="ollama-voices">
              {['female', 'male', 'female-japanese', 'male-japanese', 'female-british-english', 'male-british-english'].map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </span>
          <small className="model-license">Needs the model in Ollama once: ollama pull {voice.model}</small>
        </label>
      )}

      {voice.output === 'system' && (
        <label className="field">
          <span>Windows voice</span>
          <select value={voice.voice} onChange={(e) => save({ voice: e.target.value })}>
            <option value="">Default</option>
            {windowsVoices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}

      {voice.output !== 'off' && (
        <label className="field">
          <span>Speed: {voice.speed.toFixed(2)}×</span>
          <input type="range" min={0.5} max={2} step={0.05} value={voice.speed} onChange={(e) => save({ speed: Number(e.target.value) })} />
        </label>
      )}

      <label className="row">
        <span>
          Voice input
          <small>
            Push to talk with the mic button, or tap the island for hands-free voice mode (tap again to stop). The mic is only open while one of
            those is on, and Windows shows its mic icon.
          </small>
        </span>
        <input type="checkbox" checked={voice.input} onChange={(e) => save({ input: e.target.checked })} />
      </label>
      {voice.input && (
        <label className="row">
          <span>
            Only respond when I say the name
            <small>In hands-free mode, ignore speech that doesn’t include the assistant’s name (a simple wake word).</small>
          </span>
          <input type="checkbox" checked={voice.wake} onChange={(e) => save({ wake: e.target.checked })} />
        </label>
      )}

      {voice.input && (
        <label className="field">
          <span>Understand speech with</span>
          <select value={voice.stt} onChange={(e) => save({ stt: e.target.value as Voice['stt'] })}>
            <option value="builtin">Lumi’s Whisper, on this PC (private)</option>
            <option value="server">The AI service’s speech model ({voice.model})</option>
          </select>
        </label>
      )}
      {voice.input && voice.stt === 'builtin' && local && <LocalModels kind="stt" local={local} />}

      {voice.input && (
        <label className="field">
          <span>Microphone</span>
          <select value={voice.micId} onChange={(e) => save({ micId: e.target.value })}>
            <option value="">System default</option>
            {mics.map((m, i) => (
              <option key={m.deviceId || i} value={m.deviceId}>
                {m.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="model-actions">
        {voice.output !== 'off' && (
          <button type="button" className="secondary" onClick={() => void testVoice()}>
            Test voice
          </button>
        )}
        {voice.input && (
          <button type="button" className="secondary" onClick={() => void testMic()} disabled={micLevel !== null}>
            {micLevel !== null ? 'Listening…' : 'Test microphone'}
          </button>
        )}
      </div>
      {micLevel !== null && (
        <div className="meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={1} aria-valuenow={micLevel}>
          <span style={{ width: `${Math.round(micLevel * 100)}%` }} />
        </div>
      )}
      {status && (
        <p className={status.error ? 'warn' : 'model-license'} role={status.error ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
    </section>
  )
}
