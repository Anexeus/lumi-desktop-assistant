// Global shortcuts the user can rebind (Settings → General → Keyboard). Pure, so main, Settings and tests share it.

export const SHORTCUT_ACTIONS = ['character', 'island', 'stop'] as const
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number]

// Ctrl+Alt+Space is often taken and Alt+Space is the Windows window menu, hence Alt+Shift+Space for the island.
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = { character: 'Control+Alt+Shift+A', island: 'Alt+Shift+Space', stop: 'Control+Alt+Shift+X' }

const MODIFIERS = ['Control', 'Alt', 'Shift', 'Super']

// KeyboardEvent.code → Electron accelerator key, for the keys that aren't a letter, digit or F-key.
const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Enter: 'Enter',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Equal: '=',
  Minus: '-',
  Backquote: '`'
}
const KEYS = new Set(Object.values(NAMED_KEYS))
const F_KEY = /^F([1-9]|1[0-9]|2[0-4])$/

/**
 * True for a shortcut Lumi accepts: modifiers in a fixed order, then one key. It needs Ctrl, Alt or Win: with only Shift
 * (or nothing) a global shortcut would swallow ordinary typing in every app.
 */
export function isAccelerator(value: string): boolean {
  const parts = value.split('+')
  const key = parts.pop() ?? ''
  let last = -1
  for (const m of parts) {
    const i = MODIFIERS.indexOf(m)
    if (i <= last) return false // unknown, repeated or out of order
    last = i
  }
  return parts.some((m) => m !== 'Shift') && (/^[A-Z0-9]$/.test(key) || F_KEY.test(key) || KEYS.has(key))
}

/**
 * The accelerator for a key press, or null while only modifiers are held or the combination can't be a shortcut.
 * shortcut: uses the physical key (US layout names), so on AZERTY and similar layouts a letter may differ from its label.
 */
export function toAccelerator(e: { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): string | null {
  const key = /^Key[A-Z]$/.test(e.code)
    ? e.code.slice(3)
    : /^Digit[0-9]$/.test(e.code)
      ? e.code.slice(5)
      : F_KEY.test(e.code)
        ? e.code
        : NAMED_KEYS[e.code]
  if (!key) return null
  const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter((m): m is string => !!m)
  const accelerator = [...mods, key].join('+')
  return isAccelerator(accelerator) ? accelerator : null
}

/** "Control+Alt+Shift+A" → "Ctrl + Alt + Shift + A". */
export function formatAccelerator(accelerator: string, separator = ' + '): string {
  return accelerator
    .split('+')
    .map((p) => (p === 'Control' ? 'Ctrl' : p === 'Super' ? 'Win' : p))
    .join(separator)
}
