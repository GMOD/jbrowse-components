import { contextBridge, ipcRenderer } from 'electron'

import { createRequireShim } from './requireShim.ts'

// Runs in the renderer, before the page, once the window turns on
// contextIsolation. The page itself gets no Node; the shim below is the entire
// surface it gets instead. See requireShim.ts for what it allows and why.
//
// NOTE: this is built to build/preload.cjs, and the extension matters — this
// package is "type": "module", so a preload named .js parses as ESM and throws
// on its own require() before exposing anything, silently leaving the renderer
// with no bridge. See scripts/buildElectronMain.ts.

contextBridge.exposeInMainWorld(
  'require',
  createRequireShim((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
)
