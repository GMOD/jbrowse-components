import { INVOKABLE_CHANNELS } from './ipc/channelNames.ts'

// The require() the renderer gets once contextIsolation is on. Kept free of
// `electron` imports so it is unit-testable without an Electron runtime — the
// contextBridge wiring in preload.ts is not.

export interface RendererElectron {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  }
}

export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>

const allowedChannels = new Set<string>(INVOKABLE_CHANNELS)

/**
 * Builds the shim exposed to the page as `require`.
 *
 * Plugins in the wild already reach the main process by destructuring
 * `require('electron')` — the Apollo plugin does exactly this to open its OAuth
 * window — so keeping that shape means contextIsolation doesn't break them and
 * they need no release to keep working.
 *
 * Everything that crosses to the main process, in all of JBrowse and in Apollo,
 * is an `ipcRenderer.invoke`, so that one method is the whole bridge. A general
 * require() is deliberately not provided: nothing here yields `fs` or
 * `child_process`. Local file reading belongs to the RPC workers, which keep
 * Node via nodeIntegrationInWorker and are unaffected by the renderer lockdown.
 */
export function createRequireShim(invoke: Invoke) {
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
    },
  }

  return function requireShim(id: string) {
    if (id === 'electron') {
      return electron
    }
    throw new Error(
      `Cannot require("${id}") from the JBrowse Desktop renderer. Only require("electron") is available, and it exposes just ipcRenderer.invoke. Node modules are not reachable from the window; use an RPC worker for filesystem access.`,
    )
  }
}
