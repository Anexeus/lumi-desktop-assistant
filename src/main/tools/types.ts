import type { ZodType } from 'zod'

/** What a tool may touch; shown to the user in Settings → Tools. */
export type Permission = 'files.read' | 'files.write' | 'desktop.control' | 'projects.run' | 'apps.launch' | 'apps.install' | 'notify' | 'web.browse' | 'github.read' | 'mcp' | 'claude-code'

export interface Tool<I = unknown> {
  name: string
  description: string
  /** JSON Schema for the model. */
  parameters: Record<string, unknown>
  /** Validates the model's arguments; anything that fails is never run. */
  input: ZodType<I>
  /** "act" tools ask the user every time (or once per chat); "read" tools run without asking. */
  risk: 'read' | 'act'
  /** One line for the permission prompt and the chat activity line, e.g. "Open VS Code". */
  describe(input: I): string
  /** Optional pre-check: a reason to refuse without asking the user (e.g. app not on the list). */
  check?(input: I): string | null
  run(input: I, signal: AbortSignal): Promise<string>
}

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  permissions: Permission[]
  tools: Tool[]
}

export const tool = <I>(t: Tool<I>): Tool => t as unknown as Tool
