import { electronRenderer } from '@jbrowse/core/util/electron'

import type {
  IpcChannels,
  IpcPushChannels,
} from '../electron/ipc/channelTypes.ts'

// `import type` only here. channelTypes.ts imports nothing but types, so what
// the renderer takes from it — these types, and the shared constants elsewhere —
// never drags the main process's tree along.

const { ipcRenderer } = electronRenderer()

/**
 * Call a main-process handler, checked against the same {@link IpcChannels}
 * contract the handlers are registered under.
 *
 * `ipcRenderer.invoke` takes any channel name and arguments and resolves to
 * `unknown`, so calling it directly leaves all three unchecked: a renamed
 * channel, a dropped argument, or a wrong assumption about what comes back are
 * runtime surprises. Going through here makes them compile errors, and is the
 * one place the result is asserted.
 */
export function invokeIpc<K extends keyof IpcChannels>(
  channel: K,
  ...args: IpcChannels[K]['args']
): Promise<IpcChannels[K]['return']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<
    IpcChannels[K]['return']
  >
}

/**
 * Listen for a push from the main process, checked against
 * {@link IpcPushChannels} the way {@link invokeIpc} checks the other direction.
 * Returns the unsubscribe, so an effect can hand it straight back.
 */
export function onIpc<K extends keyof IpcPushChannels>(
  channel: K,
  listener: (...args: IpcPushChannels[K]['args']) => void,
): () => void {
  const handler = (_event: unknown, ...args: unknown[]) => {
    listener(...(args as IpcPushChannels[K]['args']))
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
}
