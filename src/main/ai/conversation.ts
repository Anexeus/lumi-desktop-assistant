import type { CharacterEvent } from '@shared/character'
import type { ChatItem, ChatSnapshot } from '@shared/ipc'
import { ProviderError, type ChatMessage } from './provider'

// One conversation shared by every window. Persistence is the caller's job (see onPersist).

const HISTORY_LIMIT = 20 // shortcut: fixed message window; upgrade to token-aware trimming when long chats lose context
const MEMORY_CHARS = 2000 // cap so saved memories can't crowd a small model's context

export function systemPrompt(memories: string[] = [], now = new Date()): string {
  let budget = MEMORY_CHARS
  const kept = memories.filter((m) => (budget -= m.length + 3) >= 0)
  return [
    'You are Desktop Assistant, a friendly AI companion who lives on the user’s Windows desktop as an animated character.',
    'Be warm, concise and helpful. Prefer a few sentences unless the user asks for detail.',
    'You cannot yet see the screen, open apps, read files or browse the web. If asked, say that feature is coming instead of pretending.',
    // Small models otherwise guess the date (or claim they can look it up).
    `The current local date and time is ${now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}.`,
    ...(kept.length
      ? ['\nThe user asked you to remember these things (trust them unless the user corrects them):', ...kept.map((m) => `\n- ${m}`)]
      : [])
  ].join(' ')
}

export interface ConversationDeps {
  stream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string>
  onSnapshot(snapshot: ChatSnapshot): void
  onDelta(id: number, text: string): void
  onCharacter(event: CharacterEvent): void
  /** Saved memories, newest first, included in the system prompt. */
  memories?(): string[]
  /** Called once per finished message (the user's, and the reply with whatever text arrived). */
  onPersist?(message: { role: 'user' | 'assistant'; text: string }): void
}

export class Conversation {
  private items: ChatItem[] = []
  private status: ChatSnapshot['status'] = 'idle'
  private nextId = 1
  private turn = 0
  private generation = 0 // bumped by clear(): replies from before a clear belong to the old chat
  private controller: AbortController | undefined
  private pendingSave: (() => void) | undefined

  constructor(private readonly deps: ConversationDeps) {}

  snapshot(): ChatSnapshot {
    return { items: this.items.map((i) => ({ ...i })), status: this.status }
  }

  /** Replaces the conversation with saved messages (e.g. the last chat after a restart). */
  restore(messages: { role: 'user' | 'assistant'; text: string }[]): void {
    this.items = messages.map((m) => ({ id: this.nextId++, ...m }))
    this.emit()
  }

  /** Adds an exchange answered locally (chat commands), without calling the AI. */
  addLocal(userText: string, replyText: string): void {
    if (this.status !== 'idle') {
      // Like a new message, a command stops the reply in progress (otherwise it would land after the command's answer).
      this.pendingSave?.()
      this.pendingSave = undefined
      this.turn++
      this.controller?.abort()
      this.controller = undefined
      this.status = 'idle'
      this.deps.onCharacter('cancel')
    }
    for (const [role, text] of [['user', userText], ['assistant', replyText]] as const) {
      this.items.push({ id: this.nextId++, role, text })
      this.deps.onPersist?.({ role, text })
    }
    this.emit()
  }

  /** Starts a reply. A send while a reply is still streaming cancels that reply first. */
  async send(text: string): Promise<void> {
    this.pendingSave?.() // save a reply this send interrupts before the new message, so history stays in order
    this.controller?.abort()
    const turn = ++this.turn
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller

    const history: ChatMessage[] = this.items
      .filter((i) => i.role !== 'error' && i.text)
      .slice(-HISTORY_LIMIT)
      .map((i) => ({ role: i.role as 'user' | 'assistant', content: i.text }))
    this.items.push({ id: this.nextId++, role: 'user', text })
    this.deps.onPersist?.({ role: 'user', text })
    this.status = 'thinking'
    this.deps.onCharacter('think')
    this.emit()

    let reply: ChatItem | undefined
    let saved = false
    const save = (): void => {
      if (saved) return
      saved = true
      if (reply?.text && generation === this.generation) this.deps.onPersist?.({ role: 'assistant', text: reply.text })
    }
    this.pendingSave = save
    try {
      for await (const chunk of this.deps.stream(
        [{ role: 'system', content: systemPrompt(this.deps.memories?.() ?? []) }, ...history, { role: 'user', content: text }],
        controller.signal
      )) {
        if (turn !== this.turn) return save()
        if (!reply) {
          reply = { id: this.nextId++, role: 'assistant', text: '' }
          this.items.push(reply)
          this.status = 'streaming'
          this.deps.onCharacter('speak')
          this.emit()
        }
        reply.text += chunk
        this.deps.onDelta(reply.id, chunk)
      }
      save()
      if (turn !== this.turn) return
      if (!reply) this.items.push({ id: this.nextId++, role: 'error', text: 'The AI returned an empty reply.' })
      this.finish(reply ? 'done' : 'error')
    } catch (error) {
      save() // keep whatever text arrived
      if (turn !== this.turn) return // a newer turn took over; it owns the status and character now
      if (error instanceof ProviderError && error.kind === 'canceled') {
        if (reply && !reply.text) this.items = this.items.filter((i) => i !== reply)
        return this.finish('cancel')
      }
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      this.items.push({ id: this.nextId++, role: 'error', text: message })
      this.finish('error')
    }
  }

  cancel(): void {
    this.controller?.abort()
  }

  clear(): void {
    this.turn++ // orphan any running turn
    this.generation++
    this.pendingSave = undefined
    this.controller?.abort()
    const wasBusy = this.status !== 'idle'
    this.items = []
    this.status = 'idle'
    if (wasBusy) this.deps.onCharacter('cancel')
    this.emit()
  }

  private finish(event: CharacterEvent): void {
    this.status = 'idle'
    this.controller = undefined
    this.deps.onCharacter(event)
    this.emit()
  }

  private emit(): void {
    this.deps.onSnapshot(this.snapshot())
  }
}
