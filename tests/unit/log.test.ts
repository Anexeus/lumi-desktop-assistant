import { describe, expect, it } from 'vitest'
import { redact } from '../../src/main/log'

describe('redact', () => {
  it('masks keys and tokens but keeps the message', () => {
    expect(redact('auth: Bearer sk-abc123def456ghi')).toBe('auth: Bearer [redacted]')
    expect(redact('key AIzaSyA1234567890abcdefghijklmnopqrstu failed')).toBe('key [redacted] failed')
    expect(redact('{"apiKey":"hunter2secret"}')).toBe('{"apiKey":"[redacted]"}')
    expect(redact('github_pat_11ABCDEFGHIJKLMNOPQRSTUV_x')).toBe('[redacted]')
    expect(redact('The local AI took too long to load.')).toBe('The local AI took too long to load.')
  })
})
