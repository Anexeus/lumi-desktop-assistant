import { describe, expect, it } from 'vitest'
import { listModels, streamChat } from '../../src/main/ai/provider'

// Opt-in: talks to a real local Ollama. Run with OLLAMA_TEST=1 npx vitest run tests/unit/ollama.integration.test.ts
const cfg = { baseUrl: 'http://127.0.0.1:11434/v1', model: process.env['OLLAMA_MODEL'] ?? 'qwen3:4b' }

describe.skipIf(!process.env['OLLAMA_TEST'])('Ollama (live)', () => {
  it('lists the configured model', async () => {
    expect(await listModels(cfg)).toContain(cfg.model)
  })

  it('streams a reply without leaking reasoning', { timeout: 180_000 }, async () => {
    const started = Date.now()
    let firstAt = 0
    let text = ''
    let chunks = 0
    for await (const t of streamChat(cfg, [
      { role: 'system', content: 'Answer in one short sentence.' },
      { role: 'user', content: 'Say hello and tell me what 2 + 2 is.' }
    ])) {
      if (typeof t !== 'string') continue
      if (!firstAt) firstAt = Date.now()
      text += t
      chunks++
    }
    const seconds = (Date.now() - firstAt) / 1000
    console.log(
      `first token after ${((firstAt - started) / 1000).toFixed(1)} s, ${chunks} chunks in ${seconds.toFixed(1)} s ` +
        `(~${(chunks / Math.max(seconds, 0.001)).toFixed(0)} chunks/s): ${JSON.stringify(text.trim())}`
    )
    expect(text).toMatch(/4|four/i)
    expect(text).not.toMatch(/<\/?think>/)
  })
})
