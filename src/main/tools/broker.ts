import type { ApprovalDecision, ApprovalRequest } from '@shared/ipc'
import type { Tool } from './types'

const TIMEOUT_MS = 120_000 // no answer = no

/**
 * The only way a tool gets to act. "read" tools run freely (they are limited to what the user
 * approved, e.g. folders); "act" tools wait for the user's answer, which defaults to deny.
 */
export class PermissionBroker {
  private readonly grants = new Set<string>() // tool names allowed "for this chat"
  private readonly pending = new Map<number, { request: ApprovalRequest; resolve(d: ApprovalDecision): void }>()
  private nextId = 1

  constructor(
    private readonly onChange: (requests: ApprovalRequest[]) => void,
    private readonly timeoutMs = TIMEOUT_MS
  ) {}

  async approve(tool: Tool, title: string, detail: string, signal: AbortSignal): Promise<boolean> {
    if (tool.risk === 'read' || this.grants.has(tool.name)) return true
    if (signal.aborted) return false
    const id = this.nextId++
    const request: ApprovalRequest = { id, tool: tool.name, title, detail: detail.slice(0, 600) }
    const decision = await new Promise<ApprovalDecision>((resolve) => {
      const timer = setTimeout(() => resolve('deny'), this.timeoutMs)
      const onAbort = (): void => resolve('deny')
      signal.addEventListener('abort', onAbort, { once: true })
      this.pending.set(id, {
        request,
        resolve: (d) => {
          clearTimeout(timer)
          signal.removeEventListener('abort', onAbort)
          resolve(d)
        }
      })
      this.emit()
    })
    this.pending.delete(id)
    this.emit()
    if (decision === 'chat') this.grants.add(tool.name)
    return decision !== 'deny'
  }

  respond(id: number, decision: ApprovalDecision): void {
    this.pending.get(id)?.resolve(decision)
  }

  /** A new chat starts with no standing "allow for this chat" grants, and nothing waiting. */
  reset(): void {
    this.grants.clear()
    for (const p of this.pending.values()) p.resolve('deny')
  }

  requests(): ApprovalRequest[] {
    return [...this.pending.values()].map((p) => p.request)
  }

  private emit(): void {
    this.onChange(this.requests())
  }
}
