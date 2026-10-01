---
name: desktop-context-isolation
description: How to remove jbrowse-desktop's renderer privilege — what actually blocks the contextIsolation flip (the renderer bundle's static `fs` require, the `openLocation` funnel, the `isElectron` userAgent sniff), what a probe disproved, and the suggested order. Read before touching electron/window.ts or the desktop file-access path.
audience: internal
kind: spec
---

# Desktop contextIsolation migration

## The problem

`electron/window.ts` creates the main window with `nodeIntegration: true`,
`contextIsolation: false`, `webSecurity: false` and no preload, so anything that
executes in the renderer — injected content, a loaded plugin, a navigated-to
page — has Node. Two paths to that privilege are gated: remote-config plugins at
`fetchConfig`
([ADR-038](../architecture-decision-records/adr-038-desktop-plugin-trust-at-fetchconfig-funnel.md))
and navigation (`electron/navigationGuard.ts`). Gating paths one at a time does
not remove the privilege; the flip does.

## "Plugins need filesystem access" is false

- Apollo, the plugin usually cited, imports no node builtins; its only Electron
  use is one `ipcRenderer.invoke('openAuthWindow')`.
- The plugin API (`packages/core/src/ReExports/list.ts`) never offered a node
  builtin. A plugin touching `fs` reaches around it via `window.require`.
- File I/O that matters runs in RPC workers, which keep Node through
  `nodeIntegrationInWorker` — a setting independent of the renderer's.

The real compatibility constraint is the shape plugins already use,
`const { ipcRenderer } = require('electron')`, and nearly every crossing is an
`ipcRenderer.invoke`. `electron/requireShim.ts` + `electron/preload.ts` keep
that shape, so contextIsolation costs third-party plugins no release.

**The shim exposes only `invoke`, and four crossings are not one.** Each fails
silently under the flip:

- `fileToLocation` in `packages/core/src/util/index.ts` calls
  `webUtils.getPathForFile`, which is how a dropped file becomes a
  `LocalPathLocation`. Without it drag-and-drop breaks, in core. Expose it beside
  `invoke` or give it a channel.
- Desktop's renderer listens with `ipcRenderer.on`/`off` (`onIpc` in
  `src/ipc.ts`) on the three `IpcPushChannels` in `electron/ipc/channelTypes.ts`:
  `flushSessionForClose`, `openLaunchTarget`, `mcpRequest`. With no `on`, the
  close guard waits for a flush that never comes, a pushed launch does nothing,
  and every MCP call times out. The shim needs `on`/`off` for exactly those names.

## Verified by probe

Electron 43, minimal probe apps:

| Claim | Result |
| --- | --- |
| `contextIsolation:true` + `nodeIntegration:false` + `nodeIntegrationInWorker:true` | renderer has no `require`/`process`; a Worker still `readFileSync`s off disk |
| The shim under contextIsolation | Apollo's `globalThis.require('electron')` destructuring works; `invoke` round-trips; `require('fs')` and unlisted channels refused |
| main-process `loadURL` | does **not** emit `will-navigate`, so the navigation guard doesn't break `loadTarget` |

**The preload must be `.cjs`.** The package is `"type": "module"`, so a
`build/preload.js` parses as ESM and throws on its own `require()`. A throwing
preload does not stop the page; the renderer just has no bridge, which looks like
`contextBridge` being broken. `products/jbrowse-desktop/scripts/buildElectronMain.ts` carries the why.

## What blocks the flip

### 1. `openLocation` is the chokepoint

`packages/core/src/util/io/index.ts` holds the only non-test `new LocalFile`.
`openLocation` returns a `GenericFilehandle`, so an IPC-backed implementation
for `LocalPathLocation` behind that interface fixes every call site unchanged,
including ones grep misses.

Main-thread reads exist because the RPC boundary is for rendering: an adapter
feeding a renderer is built in the worker, where Node lives, but a read whose
result lands in the model as data (refNameAliases, cytobands, the spreadsheet
import wizard) has no render call to ride on. These are small, whole-file,
read-once metadata reads through the same `openLocation`.

### 2. The renderer bundle statically requires `fs`

The flip does not degrade gracefully; a renderer module that `require`s a node
builtin at load throws and its chunk fails. The chain:

- `products/jbrowse-desktop/scripts/config.ts` targets `electron-renderer`, so
  webpack leaves node-builtin `require()` calls in the bundle, sets
  `resolve.aliasFields = []`, and aliases `generic-filehandle2` to its Node
  build.
- That build's index statically requires `localFile.js`, which requires
  `fs/promises` at module scope, and `util/io/index.ts` imports
  `{ BlobFile, LocalFile }` from it.

**The alias is load-bearing for the worker.** Deleting it clears `fs` from the
renderer and also swaps the worker's real `LocalFile` for the browser stub that
rejects every read, so desktop boots and can read nothing. `generic-filehandle2`
lists `"browser"` first in its `exports`, webpack's `electron-renderer`
conditions include both `node` and `browser`, and the worker is a
sub-compilation sharing one `resolve` config — so resolution cannot fix the
renderer alone.

The fix is an import change: keep the alias and stop `util/io/index.ts`
evaluating the package index in the renderer. Making only `LocalFile` dynamic is
not enough, because `BlobFile` comes off the same index; deep-import
`BlobFile`/`RemoteFile` too, and load `LocalFile` behind the capability check.

The other node builtin left in renderer source is `src/indexJobsModel.ts`'s own
`fs`/`path`, which is small. It reaches `@jbrowse/text-indexing` through the
`./util` subpath; importing the package barrel instead drags `ixixx` and
`child_process` back into the renderer.

### 3. `isElectron` is a userAgent sniff

`isElectron` in `packages/core/src/util/environment.ts` tests
`navigator.userAgent`, which Electron sets regardless of `contextIsolation`.
After the flip `openLocation` still takes the `LocalFile` branch and fails deep
inside generic-filehandle, not with the clean "can't use local files" error.
Don't redefine `isElectron` — most uses mean "am I in desktop". The
`isNode || isElectron` gate in `io/index.ts` wants a capability check. `isNode`
is probably already true in today's renderer (no `process` shim under
`electron-renderer`); unprobed.

### 4. Argument validation is part of the flip

The preload allowlists channel names, not arguments. `saveSession(path, snap)`
is an arbitrary write, `loadSession(path)` an arbitrary read returned to the
renderer, `indexFasta(location)` any URL or path. After the flip these are the
boundary, so constrain session paths to `userData`/the documents dir plus paths
the main process handed out through `promptOpenFile`. The BLAT channels already
run on their own partition (`electron/blatSession.ts`), since a host allowlist
would break user-run gfServers.

## Suggested order

0. **Probe first: does a Worker the page constructs (`new Worker(blobUrl)`)
   inherit `nodeIntegrationInWorker`?** If so, injected content still reaches
   `child_process` after the flip, and the fallback is
   `nodeIntegrationInWorker: false` with the IPC filehandle serving the worker.
1. Get `fs` out of the renderer's evaluated graph (blocker 2). Every later step
   is unverifiable while the renderer won't boot.
2. Type the IPC for the callers outside the product that still hand-roll
   `window.require('electron')`:
   [ideas/ready/plugin-main-process-bridge.md](../ideas/ready/plugin-main-process-bridge.md).
3. IPC-backed `GenericFilehandle` behind `openLocation`, plus the capability
   check.
4. Argument validation.
5. Flip `window.ts`: `contextIsolation: true`, `nodeIntegration: false`, keep
   `nodeIntegrationInWorker: true`, `preload: build/preload.cjs`.
6. An e2e assertion that `require('fs')` throws and
   `require('electron').ipcRenderer` exists, so the `.cjs` trap and a quiet
   re-enable both fail.

`webSecurity: false` is load-bearing for CORS to genome servers and independent
of contextIsolation.

The flip has been tried only on probe pages, never on the real app; that needs a
fresh renderer build and the packaged-app harness (`test/harness.ts`). Expect a
renderer Node dependency grep missed — the `openLocation` funnel is what makes
that survivable.
