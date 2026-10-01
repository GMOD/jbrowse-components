---
name: desktop-context-isolation
description: How to remove jbrowse-desktop's renderer privilege — what actually blocks the contextIsolation flip (the renderer bundle's static `fs` require, the `openLocation` funnel, the `isElectron` userAgent sniff), what a probe disproved, and the suggested order. Read before touching electron/window.ts or the desktop file-access path.
audience: internal
kind: spec
---

# Desktop contextIsolation migration

`electron/window.ts` creates the main window with `nodeIntegration: true`,
`contextIsolation: false`, `webSecurity: false` and no preload, so anything that
executes in the renderer — injected content, a loaded plugin, a navigated-to
page — has Node. Two paths to that privilege are gated: remote-config plugins at
`fetchConfig`
([ADR-038](../architecture-decision-records/adr-038-desktop-plugin-trust-at-fetchconfig-funnel.md))
and navigation (`electron/navigationGuard.ts`). Gating paths one at a time does
not remove the privilege; the flip does.

`build/preload.js` parses as ESM and throws on its own `require()`. A throwing
preload does not stop the page; the renderer just has no bridge, which looks like
`contextBridge` being broken (`buildElectronMain.ts` carries the why).

## What blocks the flip

### 1. `openLocation` is the chokepoint

`packages/core/src/util/io/index.ts` holds the only non-test `new LocalFile`.
`openLocation` returns a `GenericFilehandle`, so an IPC-backed implementation
for `LocalPathLocation` behind that interface fixes every call site unchanged,
including ones grep misses. Main-thread reads exist because a read whose result
lands in the model as data (refNameAliases, cytobands, the spreadsheet import
wizard) has no render call to ride on.

### 2. The renderer bundle statically requires `fs`

A renderer module that `require`s a node builtin at load throws under the flip
and its chunk fails. `products/jbrowse-desktop/scripts/config.ts` targets
`electron-renderer`, so webpack leaves node-builtin `require()` calls in the
bundle and aliases `generic-filehandle2` to its Node build, whose index
statically requires `localFile.js` (`fs/promises` at module scope);
`util/io/index.ts` imports `{ BlobFile, LocalFile }` from it.

**The alias is load-bearing for the worker.** Deleting it clears `fs` from the
renderer and also swaps the worker's real `LocalFile` for the browser stub that
rejects every read, so desktop boots and can read nothing: the worker is a
sub-compilation sharing one `resolve` config, so resolution cannot fix the
renderer alone. The fix is an import change: keep the alias and stop
`util/io/index.ts` evaluating the package index in the renderer. Making only
`LocalFile` dynamic is not enough, because `BlobFile` comes off the same index;
deep-import `BlobFile`/`RemoteFile` too, and load `LocalFile` behind the
capability check.

### 3. `isElectron` is a userAgent sniff

`isElectron` in `packages/core/src/util/environment.ts` tests
`navigator.userAgent`, which Electron sets regardless of `contextIsolation`.
After the flip `openLocation` still takes the `LocalFile` branch and fails deep
inside generic-filehandle, not with the clean "can't use local files" error.
Don't redefine `isElectron` — most uses mean "am I in desktop". The
`isNode || isElectron` gate in `io/index.ts` wants a capability check.

`webSecurity: false` is load-bearing for CORS to genome servers and independent of
contextIsolation. The flip has been tried only on probe pages, never on the real
app; expect a renderer Node dependency grep missed.
