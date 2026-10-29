import { z } from 'zod'
import { CHARACTER_EVENTS } from './character'
import { Invoke, Send } from './ipc'

const coord = z.number().finite().min(-100_000).max(100_000)
const point = z.object({ screenX: coord, screenY: coord }).strict()
const none = z.undefined()

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
  [Invoke.resetModel]: none
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
