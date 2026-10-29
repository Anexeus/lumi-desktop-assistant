import { describe, expect, it } from 'vitest'
import { VAD, vadInit, vadStep } from '../../src/renderer/ui/vad'

const feed = (v: ReturnType<typeof vadInit>, rms: number, ms: number, frame = 50): ('start' | 'end')[] => {
  const events: ('start' | 'end')[] = []
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

  it('adapts to a noisy room so steady noise is not speech', () => {
    const v = vadInit()
    for (let i = 0; i < 20; i++) feed(v, 0.015, 1000)
    expect(feed(v, 0.03, 2000)).toEqual([]) // fan noise just above the minimum threshold
    expect(feed(v, 0.2, 400)).toEqual(['start'])
  })

  it('cuts off an utterance that never pauses', () => {
    const v = vadInit()
    expect(feed(v, 0.1, VAD.maxMs + 500)).toEqual(['start', 'end', 'start'])
  })
})
