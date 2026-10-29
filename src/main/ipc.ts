import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent, type WebFrameMain } from 'electron'
import {
  invokeSchemas,
  sendSchemas,
  type InvokeChannel,
  type InvokePayload,
  type SendChannel,
  type SendPayload
} from '@shared/schemas'
import { devOrigin } from './env'
import { isTrustedUrl } from './policy'

function trusted(frame: WebFrameMain | null): boolean {
  return !!frame && isTrustedUrl(frame.url, devOrigin)
}

/** Registers an invoke handler that rejects untrusted senders and invalid payloads. */
export function handle<C extends InvokeChannel>(
  channel: C,
  fn: (payload: InvokePayload<C>, event: IpcMainInvokeEvent) => unknown
): void {
  ipcMain.handle(channel, (event, raw: unknown) => {
    if (!trusted(event.senderFrame)) throw new Error(`Rejected ${channel}: untrusted sender`)
    const parsed = invokeSchemas[channel].safeParse(raw)
    if (!parsed.success) throw new Error(`Rejected ${channel}: invalid payload`)
    return fn(parsed.data as InvokePayload<C>, event)
  })
}

/** Registers a fire-and-forget listener; invalid messages are dropped and logged. */
export function on<C extends SendChannel>(
  channel: C,
  fn: (payload: SendPayload<C>, event: IpcMainEvent) => void
): void {
  ipcMain.on(channel, (event, raw: unknown) => {
    if (!trusted(event.senderFrame)) return console.warn(`Dropped ${channel}: untrusted sender`)
    const parsed = sendSchemas[channel].safeParse(raw)
    if (!parsed.success) return console.warn(`Dropped ${channel}: invalid payload`)
    fn(parsed.data as SendPayload<C>, event)
  })
}
