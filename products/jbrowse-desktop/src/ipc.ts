import type {
  IpcChannels,
  IpcPushChannels,
} from '../electron/ipc/channelTypes.ts'

// `import type` only here. channelTypes.ts is itself import-free, so what the
// renderer takes from it — these types, and the shared constants elsewhere —
// never drags the main process's tree along.

// Node's require, available because the window runs with nodeIntegration (see
// electron/window.ts and src/declare.d.ts). Destructured once here rather than
// at the top of every module that talks to the main process.
const { ipcRenderer } = window.require('electron')

/**
 * Call a main-process handler, checked against the same {@link IpcChannels}
 * contract the handlers are registered under.
 *
 * `ipcRenderer.invoke` is `(channel: string, ...args: any[]) => Promise<any>`,
 * so calling it directly means the channel name, the arguments and the result
 * are all unchecked: a renamed channel, a dropped argument, or a wrong
 * assumption about what comes back are runtime surprises, and each call site
 * has to assert the return type for itself. Going through here makes all three
 * a compile error instead, and is the one place the `any` stops.
 */
export function invokeIpc<K extends keyof IpcChannels>(
  channel: K,
  ...args: IpcChannels[K]['args']
): Promise<IpcChannels[K]['return']> {
  return ipcRenderer.invoke(channel, ...args)
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
