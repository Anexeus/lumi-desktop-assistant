// Voice activity detection for hands-free voice mode: loudness against a tracked noise floor. Pure, so it is unit-tested.

export const VAD = {
  minThreshold: 0.01, // RMS; quieter than this is never speech (0.02 missed soft voices on laptop mics)
  floorRatio: 3, // speech must be this many times louder than the room
  startMs: 150, // this much loud audio starts an utterance
  endMs: 700, // this much quiet ends it (0.9 s felt slow to answer)
  maxMs: 30_000 // an utterance never runs longer
}

export interface VadState {
  floor: number
  speaking: boolean
  loudMs: number
  quietMs: number
  spokenMs: number
}

export const vadInit = (): VadState => ({ floor: 0.005, speaking: false, loudMs: 0, quietMs: 0, spokenMs: 0 })

/** Feeds one audio frame (its RMS and length). Returns 'start' or 'end' when an utterance begins or finishes. */
export function vadStep(v: VadState, rms: number, ms: number): 'start' | 'end' | null {
  const threshold = Math.max(VAD.minThreshold, v.floor * VAD.floorRatio)
  const loud = rms > threshold
  if (!v.speaking) {
    if (!loud) v.floor += (rms - v.floor) * 0.05 // the room's noise drifts; follow it while nobody talks
    v.loudMs = loud ? v.loudMs + ms : 0
    if (v.loudMs < VAD.startMs) return null
    Object.assign(v, { speaking: true, quietMs: 0, spokenMs: v.loudMs })
    return 'start'
  }
  v.spokenMs += ms
  v.quietMs = rms > threshold * 0.6 ? 0 : v.quietMs + ms // a little hysteresis so soft syllables don't end it
  if (v.quietMs < VAD.endMs && v.spokenMs < VAD.maxMs) return null
  Object.assign(v, { speaking: false, loudMs: 0, quietMs: 0, spokenMs: 0 })
  return 'end'
}
