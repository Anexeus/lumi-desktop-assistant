import type { MemoryKind, SaveResult } from '@shared/ipc'
import { looksSensitive } from '../storage/sensitive'

export const MAX_MEMORY_CHARS = 1000

export const HELP = [
  'Commands:',
  '/remember <something>: I keep it in mind in every chat.',
  '/note <something>: a private note for you (I never read notes).',
  '/help: this list.',
  'See and delete everything in Settings → Memory.'
].join('\n')

/** The one path for saving memories and notes, from chat commands and from Settings. */
export function saveMemory(add: (kind: MemoryKind, text: string) => void, kind: MemoryKind, raw: string): SaveResult {
  const text = raw.trim()
  if (!text) return { ok: false, message: 'There is nothing to save.' }
  if (text.length > MAX_MEMORY_CHARS) return { ok: false, message: `Keep it under ${MAX_MEMORY_CHARS} characters.` }
  if (looksSensitive(text)) {
    return { ok: false, message: 'That looks like a password, key or card number, so I won’t save it. Keep secrets in a password manager.' }
  }
  add(kind, text)
  return { ok: true }
}

/** Handles /remember, /note and /help. Returns the reply, or null when the text is not a command. */
export function runCommand(input: string, add: (kind: MemoryKind, text: string) => void): string | null {
  const match = /^\/(remember|note|help)(?:\s+([\s\S]*))?$/i.exec(input.trim())
  if (!match) return null
  const command = match[1]!.toLowerCase()
  const rest = match[2] ?? ''
  if (command === 'help') return HELP
  if (!rest.trim()) return `Tell me what to ${command === 'note' ? 'note down' : 'remember'}, like: /${command} I prefer short answers`
  const kind: MemoryKind = command === 'note' ? 'note' : 'memory'
  const result = saveMemory(add, kind, rest)
  if (!result.ok) return result.message
  return kind === 'memory' ? `Got it. I’ll remember: ${rest.trim()}` : 'Saved to your notes.'
}
