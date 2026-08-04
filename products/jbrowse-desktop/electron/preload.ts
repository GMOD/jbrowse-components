import { contextBridge, ipcRenderer } from 'electron'

import { createRequireShim } from './requireShim.ts'

// NOT YET WIRED TO ANY WINDOW. This is built to build/preload.cjs but nothing
// passes it as `webPreferences.preload`: createMainWindow still runs with
// nodeIntegration: true / contextIsolation: false, so today the page gets the
// real Node require() and not the shim below (see src/declare.d.ts). Turning it
// on means setting preload + contextIsolation: true + nodeIntegration: false in
// window.ts — at which point every renderer path that reaches the main process
// has to be an ipcRenderer.invoke on a channel listed in channelNames.ts.
//
// Kept in place, built, and unit-tested so that switch stays a small diff. Don't
// read the comments here or in requireShim.ts as a description of what the
// renderer is confined to now — it isn't confined.
//
// The .cjs extension is load-bearing: this package is "type": "module", so a
// preload named .js parses as ESM and throws on its own require() before
// exposing anything, silently leaving the renderer with no bridge. See
// scripts/buildElectronMain.ts.

contextBridge.exposeInMainWorld(
  'require',
  createRequireShim((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
)
