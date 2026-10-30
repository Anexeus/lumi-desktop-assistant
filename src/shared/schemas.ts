import { LOCAL_MODEL_IDS } from './localModels'
import { PROVIDER_IDS } from './providers'
import { CHARACTER_IDS } from './characters'
import { z } from 'zod'
import { CHARACTER_EVENTS } from './character'
import { isAccelerator, SHORTCUT_ACTIONS } from './shortcuts'
import { Invoke, MENU_ACTIONS, Send } from './ipc'

const coord = z.number().finite().min(-100_000).max(100_000)
const point = z.object({ screenX: coord, screenY: coord }).strict()
const none = z.undefined()

const parseUrl = (v: string): URL | null => {
  try {
    return new URL(v)
  } catch {
    return null
  }
}

/** http(s) only, no embedded credentials (keys go in the encrypted key store). */
export const baseUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  // Zod runs refinements even after .url() fails, so these must not throw on a malformed address.
  .refine((v) => /^https?:$/.test(parseUrl(v)?.protocol ?? ''), 'Use an http:// or https:// address.')
  .refine((v) => !parseUrl(v)?.username && !parseUrl(v)?.password, 'Do not put credentials in the address.')

export const aiSettingsSchema = z
  .object({ provider: z.enum(PROVIDER_IDS), baseUrl: z.union([z.literal(''), baseUrlSchema]), model: z.string().trim().max(200) })
  .strict()
  .refine((a) => a.provider === 'builtin' || (a.baseUrl !== '' && a.model !== ''), 'Choose an address and a model.')

export const voiceSettingsSchema = z
  .object({
    output: z.enum(['local', 'system', 'off']),
    input: z.boolean(),
    stt: z.enum(['builtin', 'server']).default('server'),
    wake: z.boolean().default(false),
    model: z.string().trim().min(1).max(200),
    voice: z.string().trim().max(200),
    speed: z.number().min(0.5).max(2),
    micId: z.string().max(500)
  })
  .strict()

export const assistantNameSchema = z.string().trim().min(1).max(40)

const pathSchema = z.string().min(3).max(1000)

export const mcpServerSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    name: z.string().trim().min(1).max(60),
    command: z.string().max(1000),
    args: z.array(z.string().max(1000)).max(50),
    url: z.url().max(1000).refine((u) => /^https?:/.test(u), 'http(s) only').optional(),
    trusted: z.boolean(),
    enabled: z.boolean()
  })
  .strict()
export const toolsSettingsSchema = z
  .object({
    folders: z.array(pathSchema).max(50),
    apps: z.array(z.object({ name: z.string().trim().min(1).max(120), path: pathSchema }).strict()).max(100),
    disabled: z.array(z.string().max(100)).max(100),
    notifications: z.boolean(),
    screenshots: z.boolean().default(false),
    autoApprove: z.boolean().default(false)
  })
  .strict()

export const graphicsSchema = z.enum(['low', 'balanced', 'high'])

const acceleratorSchema = z.string().max(60).refine(isAccelerator, 'Use Ctrl, Alt or Win with one key')
export const shortcutsSchema = z.object({ character: acceleratorSchema, island: acceleratorSchema, stop: acceleratorSchema }).strict()

export const settingsFileSchema = z
  .object({
    assistantName: assistantNameSchema,
    ai: aiSettingsSchema,
    islandVisible: z.boolean(),
    historyEnabled: z.boolean(),
    voice: voiceSettingsSchema,
    tools: toolsSettingsSchema,
    mcp: z.array(mcpServerSchema).max(30),
    claude: z.object({ path: z.string().max(1000), hookToken: z.string().regex(/^[a-f0-9]{48}$/) }).strict(),
    character: z.enum(CHARACTER_IDS),
    graphics: graphicsSchema,
    local: z.object({ llm: z.enum(LOCAL_MODEL_IDS), stt: z.enum(LOCAL_MODEL_IDS) }).strict(),
    shortcuts: shortcutsSchema,
    islandStyle: z.enum(['pill', 'glass'])
  })
  .partial()
  .strict()

export type SettingsFile = z.infer<typeof settingsFileSchema>

/**
 * Validates each setting on its own: one bad or unknown value (e.g. written by another Lumi version) resets only that
 * setting. Validating the whole file at once used to reset every setting, provider and voice included.
 */
export function parseSettingsFile(raw: unknown): SettingsFile {
  if (!raw || typeof raw !== 'object') return {}
  const file: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(settingsFileSchema.shape)) {
    const value = (raw as Record<string, unknown>)[key]
    if (value === undefined) continue
    const parsed = schema.safeParse(value)
    if (parsed.success) file[key] = parsed.data
    else console.warn(`Setting "${key}" was not valid and has been reset to its default`)
  }
  return file as SettingsFile
}

/** Payload schema for every channel main accepts. A channel missing here is rejected. */
export const invokeSchemas = {
  [Invoke.getState]: none,
  [Invoke.setAlwaysOnTop]: z.object({ value: z.boolean() }).strict(),
  [Invoke.setCharacterVisible]: z.object({ value: z.boolean() }).strict(),
  [Invoke.openWindow]: z.object({ name: z.enum(['chat', 'settings']) }).strict(),
  // `timeout` is internal to main's transient-state timers, so renderers cannot send it.
  [Invoke.characterEvent]: z.object({ event: z.enum(CHARACTER_EVENTS).exclude(['timeout']) }).strict(),
  [Invoke.getModel]: none,
  [Invoke.chooseModel]: none,
  [Invoke.selectCharacter]: z.object({ id: z.enum(CHARACTER_IDS) }).strict(),
  [Invoke.setGraphics]: z.object({ quality: graphicsSchema }).strict(),
  // null puts the default back.
  [Invoke.setShortcut]: z.object({ action: z.enum(SHORTCUT_ACTIONS), accelerator: acceleratorSchema.nullable() }).strict(),
  [Invoke.localDownload]: z.object({ id: z.enum(LOCAL_MODEL_IDS) }).strict(),
  [Invoke.localCancel]: none,
  [Invoke.emergencyStop]: none,
  [Invoke.localRemove]: z.object({ id: z.enum(LOCAL_MODEL_IDS) }).strict(),
  [Invoke.localSelect]: z.object({ kind: z.enum(['llm', 'stt']), id: z.enum(LOCAL_MODEL_IDS) }).strict(),
  [Invoke.setIslandVisible]: z.object({ value: z.boolean() }).strict(),
  [Invoke.setIslandStyle]: z.object({ style: z.enum(['pill', 'glass']) }).strict(),
  [Invoke.menuRun]: z.object({ action: z.enum(MENU_ACTIONS) }).strict(),
  [Invoke.setIslandExpanded]: z.object({ expanded: z.boolean() }).strict(),
  [Invoke.chatGet]: none,
  [Invoke.chatSend]: z.object({ text: z.string().trim().min(1).max(8000) }).strict(),
  [Invoke.chatCancel]: none,
  [Invoke.chatClear]: none,
  [Invoke.aiSetSettings]: aiSettingsSchema,
  [Invoke.aiSetApiKey]: z.object({ key: z.string().trim().min(1).max(1000).nullable() }).strict(),
  [Invoke.aiListModels]: z.object({ baseUrl: baseUrlSchema.optional() }).strict(),
  [Invoke.aiOpenKeyPage]: z.object({ provider: z.enum(PROVIDER_IDS) }).strict(),
  [Invoke.openCharacterSite]: z.object({ site: z.enum(['miku', 'teto', 'browse']) }).strict(),
  [Invoke.memoryList]: none,
  [Invoke.memoryAdd]: z.object({ kind: z.enum(['memory', 'note']), text: z.string().max(2000) }).strict(),
  [Invoke.memoryDelete]: z.object({ id: z.number().int().positive() }).strict(),
  [Invoke.historyList]: none,
  [Invoke.historyDelete]: z.object({ id: z.number().int().positive() }).strict(),
  [Invoke.historyDeleteAll]: none,
  [Invoke.historySetEnabled]: z.object({ value: z.boolean() }).strict(),
  [Invoke.dataDeleteAll]: none,
  [Invoke.voiceSetSettings]: voiceSettingsSchema,
  // ~25 MB is several minutes of 16 kHz mono; recordings stop at 60 s anyway.
  [Invoke.voiceTranscribe]: z.object({ wav: z.instanceof(Uint8Array).refine((b) => b.byteLength >= 44 && b.byteLength <= 25 * 1024 * 1024) }).strict(),
  [Invoke.voiceSynthesize]: z.object({ text: z.string().trim().min(1).max(1000) }).strict(),
  [Invoke.setAssistantName]: z.object({ name: assistantNameSchema }).strict(),
  [Invoke.windowControl]: z.object({ action: z.enum(['minimize', 'close']) }).strict(),
  [Invoke.approvalRespond]: z.object({ id: z.number().int().positive(), decision: z.enum(['once', 'chat', 'deny']) }).strict(),
  [Invoke.toolsAddFolder]: none,
  [Invoke.toolsRemoveFolder]: z.object({ path: pathSchema }).strict(),
  [Invoke.toolsAddApp]: z.object({ kind: z.enum(['app', 'folder']) }).strict(),
  [Invoke.toolsRemoveApp]: z.object({ path: pathSchema }).strict(),
  [Invoke.toolsSetPlugin]: z.object({ id: z.string().max(100), enabled: z.boolean() }).strict(),
  [Invoke.toolsSetNotifications]: z.object({ value: z.boolean() }).strict(),
  [Invoke.toolsSetScreenshots]: z.object({ value: z.boolean() }).strict(),
  [Invoke.toolsSetAutoApprove]: z.object({ value: z.boolean() }).strict(),
  [Invoke.githubSetToken]: z.object({ token: z.string().trim().min(10).max(500).nullable() }).strict(),
  [Invoke.mcpAdd]: z.object({ name: z.string().trim().min(1).max(60), target: z.string().trim().min(1).max(1000) }).strict(),
  [Invoke.mcpRemove]: z.object({ id: z.string().max(40) }).strict(),
  [Invoke.mcpUpdate]: z.object({ id: z.string().max(40), patch: z.object({ enabled: z.boolean().optional(), trusted: z.boolean().optional() }).strict() }).strict(),
  [Invoke.mcpRestart]: z.object({ id: z.string().max(40) }).strict(),
  [Invoke.claudeStart]: z
    .object({ prompt: z.string().trim().min(1).max(8000), project: z.string().min(3).max(1000), mode: z.enum(['plan', 'manual', 'acceptEdits']) })
    .strict(),
  [Invoke.claudeCancel]: z.object({ id: z.string().max(40) }).strict(),
  [Invoke.claudeChoosePath]: none,
  [Invoke.claudeInstallHooks]: none,
  [Invoke.claudeUninstallHooks]: none
} as const

export const sendSchemas = {
  [Send.setIgnoreMouse]: z.object({ ignore: z.boolean() }).strict(),
  [Send.dragStart]: point,
  [Send.dragMove]: point,
  [Send.dragEnd]: none,
  [Send.resize]: z
    .object({ width: z.number().int().min(1).max(10_000), height: z.number().int().min(1).max(10_000) })
    .strict(),
  [Send.scale]: z.object({ factor: z.number().min(0.5).max(2) }).strict(),
  [Send.resizeEnd]: none,
  [Send.showMenu]: none
} as const

export type InvokeChannel = keyof typeof invokeSchemas
export type SendChannel = keyof typeof sendSchemas
export type InvokePayload<C extends InvokeChannel> = z.infer<(typeof invokeSchemas)[C]>
export type SendPayload<C extends SendChannel> = z.infer<(typeof sendSchemas)[C]>

export const boundsSchema = z
  .object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
  .strict()

export const windowStateSchema = z
  .object({
    character: boundsSchema.optional(),
    alwaysOnTop: z.boolean().optional()
  })
  .strict()

export type WindowStateFile = z.infer<typeof windowStateSchema>
