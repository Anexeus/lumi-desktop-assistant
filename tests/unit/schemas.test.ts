import { describe, expect, it } from 'vitest'
import { Invoke, Send } from '../../src/shared/ipc'
import { invokeSchemas, sendSchemas, windowStateSchema } from '../../src/shared/schemas'

describe('IPC schemas', () => {
  it('covers every declared channel', () => {
    expect(Object.keys(invokeSchemas).sort()).toEqual(Object.values(Invoke).sort())
    expect(Object.keys(sendSchemas).sort()).toEqual(Object.values(Send).sort())
  })

  it('accepts valid payloads', () => {
    expect(invokeSchemas[Invoke.openWindow].safeParse({ name: 'chat' }).success).toBe(true)
    expect(invokeSchemas[Invoke.getState].safeParse(undefined).success).toBe(true)
    expect(sendSchemas[Send.dragMove].safeParse({ screenX: 10, screenY: -20 }).success).toBe(true)
  })

  it('rejects wrong types, extra keys and unknown windows', () => {
    const bad: [keyof typeof invokeSchemas | keyof typeof sendSchemas, unknown][] = [
      [Invoke.openWindow, { name: 'devtools' }],
      [Invoke.openWindow, { name: 'chat', url: 'https://example.com' }],
      [Invoke.setAlwaysOnTop, { value: 'yes' }],
      [Invoke.getState, { anything: 1 }],
      [Send.dragMove, { screenX: Number.NaN, screenY: 0 }],
      [Send.dragMove, { screenX: Infinity, screenY: 0 }],
      [Send.resize, { width: 1.5, height: 300 }],
      [Send.resize, { width: -1, height: 300 }],
      [Send.setIgnoreMouse, {}]
    ]
    for (const [channel, payload] of bad) {
      const schema = (invokeSchemas as Record<string, { safeParse(v: unknown): { success: boolean } }>)[channel] ??
        (sendSchemas as Record<string, { safeParse(v: unknown): { success: boolean } }>)[channel]
      expect(schema!.safeParse(payload).success, `${channel} ${JSON.stringify(payload)}`).toBe(false)
    }
  })

  it('rejects a tampered window-state file', () => {
    expect(windowStateSchema.safeParse({ character: { x: 0, y: 0, width: 0, height: 10 } }).success).toBe(false)
    expect(windowStateSchema.safeParse({ alwaysOnTop: true, extra: 1 }).success).toBe(false)
    expect(windowStateSchema.safeParse({}).success).toBe(true)
  })
})

describe('ai settings', () => {
  it('accepts the built-in provider with no address, and never throws on a bad address', async () => {
    const { aiSettingsSchema } = await import('../../src/shared/schemas')
    expect(aiSettingsSchema.safeParse({ provider: 'builtin', baseUrl: '', model: 'qwen3' }).success).toBe(true)
    expect(aiSettingsSchema.safeParse({ provider: 'custom', baseUrl: '', model: 'x' }).success).toBe(false)
    expect(() => aiSettingsSchema.safeParse({ provider: 'custom', baseUrl: 'not a url', model: 'x' })).not.toThrow()
    expect(aiSettingsSchema.safeParse({ provider: 'custom', baseUrl: 'not a url', model: 'x' }).success).toBe(false)
  })
})
