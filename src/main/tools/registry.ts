import type { PluginInfo } from '@shared/ipc'
import type { ToolCall, ToolSpec } from '../ai/provider'
import type { PermissionBroker } from './broker'
import type { Plugin, Tool } from './types'

export interface ToolOutcome {
  /** The activity line shown in chat. */
  title: string
  ok: boolean
  /** What the model gets back. */
  result: string
}

export function createRegistry(plugins: () => Plugin[], disabled: () => string[]) {
  const enabled = (): Plugin[] => plugins().filter((p) => !disabled().includes(p.id))
  return {
    info(): PluginInfo[] {
      return plugins().map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
        description: p.description,
        permissions: p.permissions,
        tools: p.tools.map((t) => t.name),
        enabled: !disabled().includes(p.id)
      }))
    },
    specs(): ToolSpec[] {
      return enabled().flatMap((p) =>
        p.tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }))
      )
    },
    /** Only tools of enabled plugins can be found, so a disabled plugin can never run. */
    find(name: string): Tool | undefined {
      return enabled()
        .flatMap((p) => p.tools)
        .find((t) => t.name === name)
    }
  }
}

export type Registry = ReturnType<typeof createRegistry>

/** Validates the model's call, asks the broker, runs it. Never throws: failures become results the model can read. */
export async function runToolCall(registry: Registry, broker: PermissionBroker, call: ToolCall, signal: AbortSignal): Promise<ToolOutcome> {
  const tool = registry.find(call.name)
  if (!tool) return { title: `Tried an unavailable tool (${call.name.slice(0, 60)})`, ok: false, result: `There is no enabled tool named "${call.name}".` }
  let raw: unknown
  try {
    raw = JSON.parse(call.arguments || '{}')
  } catch {
    return { title: `${tool.name}: unreadable arguments`, ok: false, result: 'The arguments were not valid JSON. Try again.' }
  }
  const parsed = tool.input.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')
    return { title: `${tool.name}: invalid arguments`, ok: false, result: `Invalid arguments (${issues}).` }
  }
  const title = tool.describe(parsed.data)
  const refusal = tool.check?.(parsed.data)
  if (refusal) return { title: `${title} (not allowed)`, ok: false, result: refusal }
  if (!(await broker.approve(tool, title, JSON.stringify(parsed.data, null, 1), signal))) {
    return { title: `${title} (you declined)`, ok: false, result: 'The user declined this action. Do not retry it unless they ask.' }
  }
  try {
    return { title, ok: true, result: await tool.run(parsed.data, signal) }
  } catch (error) {
    return { title: `${title} (failed)`, ok: false, result: `It failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}
