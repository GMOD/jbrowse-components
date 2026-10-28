import { INVOKABLE_CHANNELS, PUSH_CHANNELS } from './ipc/channelNames.ts'

// The require() the renderer would get once contextIsolation is on. Nothing
// loads the preload that installs this yet, so it is not what the renderer has
// today — see preload.ts. Kept free of `electron` imports so it is unit-testable
// without an Electron runtime, which the contextBridge wiring in preload.ts is
// not.

export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>
export type Subscribe = (
  channel: string,
  listener: (...args: unknown[]) => void,
) => () => void

interface RendererElectron {
  ipcRenderer: {
    invoke: Invoke
    // Returns its own unsubscribe rather than pairing with an `off`: a function
    // crossing the contextBridge arrives as a new proxy each time, so
    // `off(channel, listener)` never finds the listener `on` registered.
    // src/ipc.ts's onIpc takes the returned function once the preload is on.
    on: Subscribe
  }
}

const allowedChannels = new Set<string>(INVOKABLE_CHANNELS)
const pushChannels = new Set<string>(PUSH_CHANNELS)

/**
 * Builds the shim that would be exposed to the page as `require` (see the note
 * above: no window installs it yet).
 *
 * Plugins in the wild already reach the main process by destructuring
 * `require('electron')` — the Apollo plugin does exactly this to open its OAuth
 * window — so keeping that shape means contextIsolation doesn't break them and
 * they need no release to keep working.
 *
 * Everything that crosses to the main process, in all of JBrowse and in Apollo,
 * is an `ipcRenderer.invoke`; what comes back unasked is one of the push
 * channels, which `on` relays. Those two are the whole bridge. A general
 * require() is deliberately not provided: nothing here yields `fs` or
 * `child_process`. Local file reading belongs to the RPC workers, which keep
 * Node via nodeIntegrationInWorker and are unaffected by the renderer lockdown.
 */
export function createRequireShim(invoke: Invoke, subscribe: Subscribe) {
  const electron: RendererElectron = {
    ipcRenderer: {
      invoke: async (channel, ...args) => {
        if (!allowedChannels.has(channel)) {
          // Not a security boundary by itself — invoke can only reach handlers
          // the main process registered anyway. It keeps the exposed surface
          // explicit, so a future channel has to be opted into deliberately.
          throw new Error(
            `Blocked ipcRenderer.invoke on unknown channel "${channel}"`,
          )
        }
        return invoke(channel, ...args)
      },
      on: (channel, listener) => {
        if (!pushChannels.has(channel)) {
          throw new Error(
            `Blocked ipcRenderer.on for unknown channel "${channel}"`,
          )
        }
        return subscribe(channel, listener)
      },
    },
  }

  return function requireShim(id: string) {
    if (id === 'electron') {
      return electron
    }
    throw new Error(
      `Cannot require("${id}") from the JBrowse Desktop renderer. Only require("electron") is available, and it exposes just ipcRenderer.invoke and ipcRenderer.on. Node modules are not reachable from the window; use an RPC worker for filesystem access.`,
    )
  }
}
