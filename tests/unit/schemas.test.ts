import { describe, expect, it } from 'vitest'
import { Invoke, Send } from '../../src/shared/ipc'
import { invokeSchemas, parseSettingsFile, sendSchemas, windowStateSchema } from '../../src/shared/schemas'
import { formatAccelerator, isAccelerator, toAccelerator } from '../../src/shared/shortcuts'

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

describe('settings file', () => {
  it('keeps every valid setting when one is invalid or unknown', () => {
    const file = parseSettingsFile({ assistantName: 'Mia', graphics: 'ultra', character: 'shino', future: true })
    expect(file).toEqual({ assistantName: 'Mia', character: 'shino' })
  })

  it('accepts saved shortcuts and drops unusable ones', () => {
    const shortcuts = { character: 'Control+Alt+Shift+A', island: 'Alt+Shift+Space', stop: 'Control+Alt+Shift+X' }
    expect(parseSettingsFile({ shortcuts }).shortcuts).toEqual(shortcuts)
    expect(parseSettingsFile({ shortcuts: { ...shortcuts, stop: 'Shift+X' } }).shortcuts).toBeUndefined()
    expect(parseSettingsFile(null)).toEqual({})
  })
})

describe('shortcuts', () => {
  const press = (code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
    toAccelerator({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods })

  it('turns key presses into accelerators in a fixed modifier order', () => {
    expect(press('KeyA', { ctrlKey: true, altKey: true, shiftKey: true })).toBe('Control+Alt+Shift+A')
    expect(press('Space', { altKey: true, shiftKey: true })).toBe('Alt+Shift+Space')
    expect(press('F9', { metaKey: true })).toBe('Super+F9')
    expect(press('Digit7', { ctrlKey: true })).toBe('Control+7')
    expect(press('ArrowUp', { ctrlKey: true, altKey: true })).toBe('Control+Alt+Up')
    expect(press('Slash', { ctrlKey: true })).toBe('Control+/')
  })

  it('waits while only modifiers are held and refuses combinations that would swallow typing', () => {
    expect(press('ControlLeft', { ctrlKey: true })).toBeNull()
    expect(press('KeyA')).toBeNull()
    expect(press('KeyA', { shiftKey: true })).toBeNull()
    expect(press('NumpadEnter', { ctrlKey: true })).toBeNull()
  })

  it('validates saved accelerators', () => {
    for (const ok of ['Control+Alt+Shift+A', 'Alt+Shift+Space', 'Super+F12', 'Control+-']) expect(isAccelerator(ok)).toBe(true)
    for (const bad of ['A', 'Shift+A', 'Alt+Control+A', 'Control+Control+A', 'Control+Hyper+A', 'Control+F25', 'Control+', 'Control+AB'])
      expect(isAccelerator(bad)).toBe(false)
  })

  it('formats for people', () => {
    expect(formatAccelerator('Control+Alt+Shift+X')).toBe('Ctrl + Alt + Shift + X')
    expect(formatAccelerator('Super+Space', ' ')).toBe('Win Space')
  })
})
