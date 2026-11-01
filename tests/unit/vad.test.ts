import { describe, expect, it } from 'vitest'
import { VAD, vadInit, vadStep } from '../../src/renderer/ui/vad'

const feed = (v: ReturnType<typeof vadInit>, rms: number, ms: number, frame = 50): ('start' | 'end' | 'noise')[] => {
  const events: ('start' | 'end' | 'noise')[] = []
  for (let t = 0; t < ms; t += frame) {
    const e = vadStep(v, rms, frame)
    if (e) events.push(e)
  }
  return events
}

describe('vad', () => {
  it('starts on sustained speech and ends after a pause', () => {
    const v = vadInit()
    expect(feed(v, 0.004, 2000)).toEqual([]) // quiet room
    expect(feed(v, 0.1, 100)).toEqual([]) // a click is too short
    expect(feed(v, 0.004, 200)).toEqual([])
    expect(feed(v, 0.1, 1000)).toEqual(['start'])
    expect(feed(v, 0.004, 500)).toEqual([]) // a breath between words
    expect(feed(v, 0.1, 300)).toEqual([])
    expect(feed(v, 0.004, VAD.endMs + 100)).toEqual(['end'])
  })

  it('hears a soft voice in a quiet room', () => {
    const v = vadInit()
    expect(feed(v, 0.002, 2000)).toEqual([])
    expect(feed(v, 0.015, 600)).toEqual(['start'])
    expect(feed(v, 0.002, VAD.endMs + 100)).toEqual(['end'])
  })

  it('adapts to a noisy room so steady noise is not speech', () => {
    const v = vadInit()
    for (let i = 0; i < 20; i++) feed(v, 0.015, 1000)
    expect(feed(v, 0.03, 2000)).toEqual([]) // fan noise just above the minimum threshold
    expect(feed(v, 0.2, 400)).toEqual(['start'])
  })

  it('cuts off an utterance that never pauses long enough', () => {
    const v = vadInit()
    const events = []
    // Talking on and on: short dips between words, never the 0.7 s pause that ends a sentence.
    for (let t = 0; t <= VAD.maxMs + 1000; t += 500) events.push(...feed(v, 0.1, 400), ...feed(v, 0.004, 100))
    expect(events).toEqual(['start', 'end', 'start'])
  })

  it('learns a crowd that suddenly gets loud instead of hearing it as an endless sentence', () => {
    const v = vadInit()
    expect(feed(v, 0.003, 2000)).toEqual([]) // a quiet room
    expect(feed(v, 0.04, VAD.noiseMs + 200)).toEqual(['start', 'noise']) // a crowd: loud and steady, no dips
    expect(feed(v, 0.04, 3000)).toEqual([]) // the same crowd is now the background
    expect(feed(v, 0.2, 400)).toEqual(['start']) // a voice near the mic still gets through
    expect(feed(v, 0.04, VAD.endMs + 100)).toEqual(['end'])
  })

  it('never drops a loud voice that talks for long without quiet gaps', () => {
    const v = vadInit()
    expect(feed(v, 0.003, 2000)).toEqual([])
    const events = []
    // Syllables at 0.25 and gaps that only fall to 0.03 (close to the mic, a bit of echo): a voice, not noise.
    for (let t = 0; t < VAD.noiseMs + 2000; t += 300) events.push(...feed(v, 0.25, 200), ...feed(v, 0.03, 100))
    events.push(...feed(v, 0.002, VAD.endMs + 100))
    expect(events).toEqual(['start', 'end'])
  })
})
