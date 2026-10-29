import { describe, expect, it } from 'vitest'
import { synthesize, transcribe } from '../../src/main/ai/voice'
import { mouthLevel, pickVoice, speakable, takeSentences } from '../../src/renderer/character/speech'
import { downsample, encodeWav, fixWavSizes } from '../../src/renderer/ui/wav'

const cfg = { baseUrl: 'http://127.0.0.1:11434/v1', model: 'lfm3-audio' }

describe('takeSentences', () => {
  it('splits finished sentences and keeps the unfinished tail', () => {
    expect(takeSentences('Hello there! How are')).toEqual({ sentences: ['Hello there!'], rest: ' How are' })
    expect(takeSentences('One. Two? Three')).toEqual({ sentences: ['One.', 'Two?'], rest: ' Three' })
    expect(takeSentences('Pi is 3.14 roughly. Ok')).toEqual({ sentences: ['Pi is 3.14 roughly.'], rest: ' Ok' })
    expect(takeSentences('Line one\nLine two')).toEqual({ sentences: ['Line one'], rest: 'Line two' })
    expect(takeSentences('No end yet')).toEqual({ sentences: [], rest: 'No end yet' })
  })

  it('does not split a sentence whose terminator has not been followed by a space yet', () => {
    expect(takeSentences('Wait...').sentences).toEqual([])
  })
})

describe('speakable', () => {
  it('drops markdown, code and URLs', () => {
    expect(speakable('**Bold** and `x` see https://example.com/a')).toBe('Bold and x see a link')
    expect(speakable('Run:\n```js\nfoo()\n```\ndone')).toBe('Run: (code) done')
    expect(speakable('Blue! It feels like freedom. 😊👍🏽❤️')).toBe('Blue! It feels like freedom.')
  })
})

describe('mouthLevel', () => {
  it('is closed in silence and clamps when loud', () => {
    expect(mouthLevel(0)).toBe(0)
    expect(mouthLevel(0.1)).toBeGreaterThan(0.5)
    expect(mouthLevel(5)).toBe(1)
  })
})

describe('wav', () => {
  it('encodes a valid 16 kHz mono PCM header', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]))
    const v = new DataView(wav.buffer)
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE')
    expect(v.getUint32(24, true)).toBe(16000)
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(40, true)).toBe(8)
    expect(v.getInt16(46, true)).toBe(0x7fff)
    expect(v.getInt16(48, true)).toBe(-0x8000)
  })

  it('repairs "unknown length" WAV headers from streaming servers', () => {
    const wav = encodeWav(new Float32Array(10))
    const v = new DataView(wav.buffer)
    v.setUint32(4, 0xffffffff, true)
    v.setUint32(40, 0xffffffff, true)
    const fixed = new DataView(fixWavSizes(wav).buffer)
    expect(fixed.getUint32(4, true)).toBe(wav.byteLength - 8)
    expect(fixed.getUint32(40, true)).toBe(20)
    expect(v.getUint32(40, true)).toBe(0xffffffff) // input untouched
  })

  it('downsamples 48 kHz to 16 kHz by averaging', () => {
    const out = downsample(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000)
    expect(Array.from(out).map((x) => +x.toFixed(2))).toEqual([0.3, 1])
  })
})

describe('audio endpoints', () => {
  it('posts a multipart WAV for transcription', async () => {
    let seen: { url: string; form: FormData } | undefined
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, form: init.body as FormData }
      return Response.json({ text: '  hello world ' })
    }) as unknown as typeof fetch
    expect(await transcribe(cfg, new Uint8Array(100), fake)).toBe('hello world')
    expect(seen!.url).toBe('http://127.0.0.1:11434/v1/audio/transcriptions')
    expect(seen!.form.get('model')).toBe('lfm3-audio')
    expect((seen!.form.get('file') as File).type).toBe('audio/wav')
  })

  it('explains a missing voice model', async () => {
    const fake = (async () => Response.json({ error: { message: 'model "lfm3-audio" not found' } }, { status: 404 })) as unknown as typeof fetch
    await expect(synthesize(cfg, 'hi', fake)).rejects.toThrow('ollama pull lfm3-audio')
  })

  it('requests WAV speech with the chosen voice and speed', async () => {
    let body: Record<string, unknown> = {}
    const fake = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string)
      return new Response(new Uint8Array(1000))
    }) as unknown as typeof fetch
    const audio = await synthesize({ ...cfg, voice: 'alloy', speed: 1.2 }, 'x'.repeat(5000), fake)
    expect(audio.byteLength).toBe(1000)
    expect(body).toMatchObject({ model: 'lfm3-audio', response_format: 'wav', voice: 'alloy', speed: 1.2 })
    expect((body['input'] as string).length).toBe(1000)
  })
})

describe('pickVoice', () => {
  const voices = [{ name: 'Microsoft Zira - English (United States)' }, { name: 'Microsoft David - English (United States)' }]
  it('matches an exact name, or a character gender to a Windows voice', () => {
    expect(pickVoice(voices, 'Microsoft Zira - English (United States)')).toBe(voices[0])
    expect(pickVoice(voices, 'male')).toBe(voices[1])
    expect(pickVoice(voices, 'female-japanese')).toBe(voices[0])
    expect(pickVoice(voices, '')).toBeUndefined()
    expect(pickVoice(voices, 'robot')).toBeUndefined()
  })
})

describe('cleanTranscript', () => {
  it('drops non-speech markers and keeps real words', async () => {
    const { cleanTranscript } = await import('../../src/main/ai/voice')
    expect(cleanTranscript(' [BLANK_AUDIO] ')).toBe('')
    expect(cleanTranscript('(music) [ Silence ]')).toBe('')
    expect(cleanTranscript('*cough* open notepad (inaudible)')).toBe('open notepad')
    expect(cleanTranscript('Run npm build.')).toBe('Run npm build.')
  })
})
