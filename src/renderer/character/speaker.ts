import type { AppState, ChatEvent, VoiceSettings } from '@shared/ipc'
import { fixWavSizes } from '../ui/wav'
import { mouthLevel, speakable, takeSentences } from './speech'

// Speaks streamed replies sentence by sentence and drives the mouth from the real audio.
// Main does not send "done" while voice is on; this module sends it once the last sentence ends.

interface Sentence {
  text: string
  audio?: Promise<Uint8Array | null> // prefetched while the previous sentence plays
}

export function createSpeaker(setMouth: (level: number | null) => void): {
  onChat(event: ChatEvent): void
  onState(state: AppState): void
} {
  let voice: VoiceSettings | undefined
  let replyId = -1
  let buffer = ''
  let streaming = false
  let queue: Sentence[] = []
  let playing = false
  let generation = 0 // bumped by stop(); late callbacks from an older generation do nothing
  let source: AudioBufferSourceNode | undefined
  let ctx: AudioContext | undefined
  let warnedFallback = false

  const synth = (text: string): Promise<Uint8Array | null> =>
    window.assistant.voice.synthesize(text).then((r) => {
      if (r.ok) return r.audio
      if (!warnedFallback) console.warn(`Ollama voice unavailable, using the Windows voice: ${r.message}`)
      warnedFallback = true
      return null
    })

  function stop(): void {
    generation++
    queue = []
    playing = false
    streaming = false
    buffer = ''
    try {
      source?.stop()
    } catch {
      // already stopped
    }
    speechSynthesis.cancel()
    setMouth(null)
  }

  function finishIfDone(): void {
    if (streaming || playing || queue.length) return
    setMouth(null)
    void window.assistant.characterEvent('done')
  }

  function enqueue(texts: string[]): void {
    for (const raw of texts) {
      const text = speakable(raw)
      if (!text) continue
      queue.push({ text, audio: voice?.output === 'local' ? synth(text) : undefined })
    }
    void pump()
  }

  async function pump(): Promise<void> {
    if (playing || !queue.length) return
    playing = true
    const gen = generation
    const next = queue.shift()!
    try {
      const audio = next.audio ? await next.audio : null
      if (gen !== generation) return
      await (audio ? playWav(audio, gen) : speakWithWindows(next.text, gen))
    } catch (error) {
      console.warn('Could not speak a sentence', error)
    }
    if (gen !== generation) return
    playing = false
    if (queue.length) void pump()
    else finishIfDone()
  }

  async function playWav(bytes: Uint8Array, gen: number): Promise<void> {
    ctx ??= new AudioContext()
    const data = fixWavSizes(bytes)
    const buffer = await ctx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
    if (gen !== generation) return
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    const samples = new Float32Array(analyser.fftSize)
    source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(analyser)
    analyser.connect(ctx.destination)
    const node = source
    await new Promise<void>((resolve) => {
      let ended = false
      node.onended = () => {
        ended = true
        resolve()
      }
      node.start()
      const track = (): void => {
        if (ended) return
        if (gen !== generation) return resolve()
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (const s of samples) sum += s * s
        setMouth(mouthLevel(Math.sqrt(sum / samples.length)))
        requestAnimationFrame(track)
      }
      requestAnimationFrame(track)
    })
    setMouth(0)
  }

  function speakWithWindows(text: string, gen: number): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = voice?.speed ?? 1
      const named = voice?.voice ? speechSynthesis.getVoices().find((v) => v.name === voice!.voice) : undefined
      if (named) u.voice = named
      // No audio access here, so open the mouth on each word and let it fall shut.
      let level = 0
      const decay = (): void => {
        if (gen !== generation || !speechSynthesis.speaking) return
        level *= 0.85
        setMouth(level)
        requestAnimationFrame(decay)
      }
      u.onboundary = () => (level = 0.8)
      u.onstart = () => requestAnimationFrame(decay)
      u.onend = u.onerror = () => {
        setMouth(0)
        resolve()
      }
      speechSynthesis.speak(u)
    })
  }

  return {
    onChat(event) {
      if (!voice || voice.output === 'off') return
      if (event.type === 'delta') {
        if (event.id !== replyId) {
          stop() // a new reply replaces whatever was still being said
          replyId = event.id
          streaming = true
        }
        if (!streaming) return
        buffer += event.text
        const { sentences, rest } = takeSentences(buffer)
        buffer = rest
        enqueue(sentences)
        return
      }
      // The reply's text is complete once the conversation goes idle: speak the tail, then finish.
      if (streaming && event.snapshot.status === 'idle') {
        streaming = false
        const tail = buffer
        buffer = ''
        enqueue([tail])
        finishIfDone()
      }
    },
    onState(state) {
      voice = state.voice
      // Anything that takes her out of SPEAKING (Stop, a new question, an error) cuts the voice off.
      if (state.character !== 'SPEAKING' && (playing || queue.length || streaming)) stop()
    }
  }
}
