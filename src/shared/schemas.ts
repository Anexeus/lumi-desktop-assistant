import { z } from 'zod'
import { CHARACTER_EVENTS } from './character'
import { Invoke, Send } from './ipc'

const coord = z.number().finite().min(-100_000).max(100_000)
const point = z.object({ screenX: coord, screenY: coord }).strict()
const none = z.undefined()

/** http(s) only, no embedded credentials (keys go in the encrypted key store). */
export const baseUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((v) => /^https?:$/.test(new URL(v).protocol), 'Use an http:// or https:// address.')
  .refine((v) => !new URL(v).username && !new URL(v).password, 'Do not put credentials in the address.')

export const aiSettingsSchema = z
  .object({ baseUrl: baseUrlSchema, model: z.string().trim().min(1).max(200) })
  .strict()

export const voiceSettingsSchema = z
  .object({
    output: z.enum(['local', 'system', 'off']),
    input: z.boolean(),
    model: z.string().trim().min(1).max(200),
    voice: z.string().trim().max(200),
    speed: z.number().min(0.5).max(2),
    micId: z.string().max(500)
  })
  .strict()

export const settingsFileSchema = z
  .object({ ai: aiSettingsSchema, islandVisible: z.boolean(), historyEnabled: z.boolean(), voice: voiceSettingsSchema })
  .partial()
  .strict()

export type SettingsFile = z.infer<typeof settingsFileSchema>

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
  [Invoke.resetModel]: none,
  [Invoke.setIslandVisible]: z.object({ value: z.boolean() }).strict(),
  [Invoke.setIslandExpanded]: z.object({ expanded: z.boolean() }).strict(),
  [Invoke.chatGet]: none,
  [Invoke.chatSend]: z.object({ text: z.string().trim().min(1).max(8000) }).strict(),
  [Invoke.chatCancel]: none,
  [Invoke.chatClear]: none,
  [Invoke.aiSetSettings]: aiSettingsSchema,
  [Invoke.aiSetApiKey]: z.object({ key: z.string().trim().min(1).max(1000).nullable() }).strict(),
  [Invoke.aiListModels]: z.object({ baseUrl: baseUrlSchema.optional() }).strict(),
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
  [Invoke.voiceSynthesize]: z.object({ text: z.string().trim().min(1).max(1000) }).strict()
} as const

export const sendSchemas = {
  [Send.setIgnoreMouse]: z.object({ ignore: z.boolean() }).strict(),
  [Send.dragStart]: point,
  [Send.dragMove]: point,
  [Send.dragEnd]: none,
  [Send.resize]: z
    .object({ width: z.number().int().min(1).max(10_000), height: z.number().int().min(1).max(10_000) })
    .strict(),
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
