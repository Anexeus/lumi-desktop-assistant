// Mono 16-bit PCM WAV encoding for push-to-talk recordings (unit-tested).

export const SPEECH_RATE = 16_000 // what speech-to-text models expect

/** Averages samples down to the target rate (input rate must be ≥ target). */
export function downsample(samples: Float32Array, fromRate: number, toRate = SPEECH_RATE): Float32Array {
  if (fromRate === toRate) return samples
  const ratio = fromRate / toRate
  const out = new Float32Array(Math.floor(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += samples[j]!
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}

export function encodeWav(samples: Float32Array, rate = SPEECH_RATE): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const text = (at: number, s: string): void => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true) // PCM chunk size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true) // byte rate
  v.setUint16(32, 2, true) // block align
  v.setUint16(34, 16, true) // bits per sample
  text(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Uint8Array(buf)
}

/**
 * Ollama streams WAV with 0xFFFFFFFF "unknown length" sizes, which decodeAudioData may refuse.
 * Rewrites the RIFF and data chunk sizes from the real byte count (returns a copy).
 */
export function fixWavSizes(input: Uint8Array): Uint8Array {
  const bytes = input.slice()
  if (bytes.byteLength < 44) return bytes
  const v = new DataView(bytes.buffer)
  const tag = (at: number): string => String.fromCharCode(...bytes.subarray(at, at + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return bytes
  v.setUint32(4, bytes.byteLength - 8, true)
  // Walk the chunks to find "data" (there may be others, like LIST, before it).
  for (let at = 12; at + 8 <= bytes.byteLength; ) {
    const size = v.getUint32(at + 4, true)
    if (tag(at) === 'data') {
      v.setUint32(at + 4, bytes.byteLength - at - 8, true)
      break
    }
    if (size === 0xffffffff) break
    at += 8 + size + (size % 2)
  }
  return bytes
}
