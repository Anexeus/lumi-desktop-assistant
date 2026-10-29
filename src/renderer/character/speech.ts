// Pure helpers for speaking a streamed reply sentence by sentence (unit-tested).

/** Splits finished sentences off the front of a streaming buffer; the unfinished tail stays in `rest`. */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = []
  // A sentence ends at . ! ? … followed by whitespace, or at a line break, so "3.14" stays whole.
  let last = 0
  for (const m of buffer.matchAll(/[.!?…]+(?=\s)|\n+/g)) {
    const end = m.index + m[0].length
    const s = buffer.slice(last, end).trim()
    if (s) sentences.push(s)
    last = end
  }
  return { sentences, rest: buffer.slice(last) }
}

/** Makes chat text pleasant to hear: no markdown symbols, no raw URLs or code. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' (code) ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/[*_#>|~]+/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{200D}]/gu, '') // emoji: voices read them out or stumble
    .replace(/\s+/g, ' ')
    .trim()
}

const MALE = /\b(david|mark|guy|george|james|ryan|christopher|eric|roger|andrew|brian|davis|tony|jason|steffan)\b/i
const FEMALE = /\b(zira|aria|jenny|hazel|susan|libby|sonia|emma|ava|michelle|ana|heera|catherine|linda|nanami)\b/i

/** A Windows voice by exact name, or, for "male"/"female" (a character's voice), the first voice of that gender. */
export function pickVoice<V extends { name: string }>(voices: V[], wanted: string): V | undefined {
  const named = voices.find((v) => v.name === wanted)
  if (named || !wanted) return named
  const gender = /^(female|male)/.exec(wanted)?.[1]
  return gender ? voices.find((v) => (gender === 'male' ? MALE : FEMALE).test(v.name)) : undefined
}

/** Mouth openness from an audio frame's RMS loudness (speech sits around 0.02–0.2). */
export function mouthLevel(rms: number): number {
  return Math.min(1, Math.max(0, (rms - 0.015) * 7))
}
