import { ipcMain } from 'electron'

import type { IpcChannels, IpcPushChannels } from './channelTypes.ts'
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

/**
 * Push to the renderer, checked against {@link IpcPushChannels} the same way
 * ipcHandle checks the invoke direction. Takes the webContents rather than the
 * window so a destroyed window is the caller's problem, not a crash here.
 */
export function ipcSend<K extends keyof IpcPushChannels>(
  webContents: Electron.WebContents,
  channel: K,
  ...args: IpcPushChannels[K]['args']
) {
  webContents.send(channel, ...args)
}
