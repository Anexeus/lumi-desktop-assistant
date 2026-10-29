import type { CharacterEvent } from '@shared/character'
import type { ChatItem, ChatSnapshot } from '@shared/ipc'
import { ProviderError, type ChatMessage } from './provider'

// One conversation shared by every window. Kept in memory until Milestone 5 adds storage.

const HISTORY_LIMIT = 20 // shortcut: fixed message window, until Milestone 5 adds token-aware trimming and memory

export function systemPrompt(now = new Date()): string {
  return [
    'You are Desktop Assistant, a friendly AI companion who lives on the user’s Windows desktop as an animated character.',
    'Be warm, concise and helpful. Prefer a few sentences unless the user asks for detail.',
    'You cannot yet see the screen, open apps, read files or browse the web. If asked, say that feature is coming instead of pretending.',
    // Small models otherwise guess the date (or claim they can look it up).
    `The current local date and time is ${now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}.`
  ].join(' ')
}

export interface ConversationDeps {
  stream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string>
  onSnapshot(snapshot: ChatSnapshot): void
  onDelta(id: number, text: string): void
  onCharacter(event: CharacterEvent): void
}

export class Conversation {
  private items: ChatItem[] = []
  private status: ChatSnapshot['status'] = 'idle'
  private nextId = 1
  private turn = 0
  private controller: AbortController | undefined

  constructor(private readonly deps: ConversationDeps) {}

  snapshot(): ChatSnapshot {
    return { items: this.items.map((i) => ({ ...i })), status: this.status }
  }

  /** Starts a reply. A send while a reply is still streaming cancels that reply first. */
  async send(text: string): Promise<void> {
    this.controller?.abort()
    const turn = ++this.turn
    const controller = new AbortController()
    this.controller = controller

    const history: ChatMessage[] = this.items
      .filter((i) => i.role !== 'error' && i.text)
      .slice(-HISTORY_LIMIT)
      .map((i) => ({ role: i.role as 'user' | 'assistant', content: i.text }))
    this.items.push({ id: this.nextId++, role: 'user', text })
    this.status = 'thinking'
    this.deps.onCharacter('think')
    this.emit()

    let reply: ChatItem | undefined
    try {
      for await (const chunk of this.deps.stream(
        [{ role: 'system', content: systemPrompt() }, ...history, { role: 'user', content: text }],
        controller.signal
      )) {
        if (turn !== this.turn) return
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
      if (turn !== this.turn) return
      if (!reply) this.items.push({ id: this.nextId++, role: 'error', text: 'The AI returned an empty reply.' })
      this.finish(reply ? 'done' : 'error')
    } catch (error) {
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
