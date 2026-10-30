import type { AppState, ChatEvent, VoiceSettings } from '@shared/ipc'
import { fixWavSizes } from '../ui/wav'
import { mouthLevel, pickVoice, speakable, takeSentences } from './speech'

// Speaks streamed replies sentence by sentence and drives the mouth from the real audio.
// Main does not send "done" while voice is on; this module sends it once the last sentence ends.

interface Sentence {
  text: string
  audio?: Promise<Uint8Array | null> // prefetched while the previous sentence plays
}

export function createSpeaker(setMouth: (level: number | null) => void): {
  onChat(event: ChatEvent): void
  onState(state: AppState): void
  /** A quick, cute line like "Yay!" in her voice (higher and quicker), unless she is talking or voice is off. Cached per voice. */
  exclaim(text: string): void
} {
  const exclaims = new Map<string, Promise<Uint8Array | null>>()
  let voice: VoiceSettings | undefined
  let ttsKey = '' // the AI voice setup in use; after one failure Lumi stops asking it until the setup changes
  let ttsFailed: string | null = null
  let lastExclaim = 0
  let replyId = -1
  let buffer = ''
  let streaming = false
  let queue: Sentence[] = []
  let playing = false
  let generation = 0 // bumped by stop(); late callbacks from an older generation do nothing
  let source: AudioBufferSourceNode | undefined
  let ctx: AudioContext | undefined
  let warnedFallback = false

  const synth = (text: string): Promise<Uint8Array | null> => {
    if (ttsFailed === ttsKey) return Promise.resolve(null) // e.g. Lumi's built-in engine has no voice: don't wait on it per sentence
    const key = ttsKey
    return window.assistant.voice.synthesize(text).then((r) => {
      if (r.ok) return r.audio
      if (!warnedFallback) console.warn(`The AI voice is unavailable, using the Windows voice: ${r.message}`)
      warnedFallback = true
      ttsFailed = key
      return null
    })
  }

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

  async function playWav(bytes: Uint8Array, gen: number, rate = 1): Promise<void> {
    ctx ??= new AudioContext()
    const data = fixWavSizes(bytes)
    const buffer = await ctx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
    if (gen !== generation) return
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    const samples = new Float32Array(analyser.fftSize)
    source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate // above 1 also raises the pitch: a cuter voice for exclamations
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

  function speakWithWindows(text: string, gen: number, cute = false): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = (voice?.speed ?? 1) * (cute ? 1.1 : 1)
      if (cute) u.pitch = 1.7
      const named = voice?.voice ? pickVoice(speechSynthesis.getVoices(), voice.voice) : undefined
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
    exclaim(text) {
      if (!voice || voice.output === 'off' || playing || streaming || speechSynthesis.speaking) return
      if (performance.now() - lastExclaim < 1200) return // a burst of clicks gets one "Yay!", not five
      lastExclaim = performance.now()
      const gen = generation
      if (voice.output === 'system') return void speakWithWindows(text, gen, true)
      const key = `${ttsKey}|${text}`
      if (!exclaims.has(key)) exclaims.set(key, synth(text))
      void exclaims
        .get(key)!
        .then((audio) => {
          if (gen !== generation || playing) return
          return audio ? playWav(audio, gen, 1.15) : speakWithWindows(text, gen, true)
        })
        .catch(() => {})
    },
    onState(state) {
      voice = state.voice
      ttsKey = `${state.ai.provider}|${state.ai.baseUrl}|${voice.model}|${voice.voice}`
      // Anything that takes her out of SPEAKING (Stop, a new question, an error) cuts the voice off.
      if (state.character !== 'SPEAKING' && (playing || queue.length || streaming)) stop()
    }
  }
}
