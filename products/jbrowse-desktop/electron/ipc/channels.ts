import { ipcMain } from 'electron'

import type { IpcChannels } from './channelTypes.ts'
import type { IpcMainInvokeEvent } from 'electron'

type IpcHandler<K extends keyof IpcChannels> = (
  event: IpcMainInvokeEvent,
  ...args: IpcChannels[K]['args']
) => Promise<IpcChannels[K]['return']> | IpcChannels[K]['return']

export function ipcHandle<K extends keyof IpcChannels>(
  channel: K,
  handler: IpcHandler<K>,
) {
  ipcMain.handle(
    channel,
    handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  )
}
