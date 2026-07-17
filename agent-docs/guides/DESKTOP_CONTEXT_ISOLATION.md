# Desktop contextIsolation migration

How to remove jbrowse-desktop's renderer privilege, what actually blocks it, and
what turned out not to. Written after auditing `products/jbrowse-desktop` and
probing Electron 43 directly.

## The problem

`electron/window.ts` creates the main window with `nodeIntegration: true`,
`contextIsolation: false`, `webSecurity: false` and no preload. So anything that
executes in the renderer — injected content, a loaded plugin, a page navigated
to — has Node, and with it the user's machine.

Two specific paths to that privilege are now gated, but the privilege itself
remains, and gating paths one at a time is a losing game:

- Link-supplied plugins (`f573bcad11`): a `jbrowse://` link → remote config →
  its `plugins` → `fetchCJS` → `require()`. Now vetted by
  `src/components/StartScreen/assertPluginsTrusted.ts` using
  `@jbrowse/core/checkPlugins`, shared with web.
- Navigation (`c7a2ef063c`): the window had no `will-navigate` guard, so a
  navigated-to page inherited nodeIntegration. Now `electron/navigationGuard.ts`.

## "Plugins need filesystem access" is false

This was the stated reason not to lock the renderer down. It does not hold:

- **Apollo** (`packages/jbrowse-plugin-apollo` in the Apollo3 repo), the plugin
  usually cited, has **zero node-builtin imports** in its shipped source and
  stores its ontology in IndexedDB. Its only Electron use is one
  `ipcRenderer.invoke('openAuthWindow')` for OAuth.
- **The sanctioned plugin API never offered fs.** `packages/core/src/ReExports/list.ts`
  is ~157 entries of React/MUI/MST/core, no node builtins. A plugin touching
  `fs` is reaching around the plugin API via `window.require`, not using it.
- **The file I/O that matters already runs in RPC workers**, which keep Node via
  `nodeIntegrationInWorker` — a setting **independent** of the renderer's.

The real compatibility constraint is not fs, it is the *shape* plugins already
use: `const { ipcRenderer } = require('electron')`. Every crossing to the main
process — all 23 in JBrowse, and Apollo's one — is an `ipcRenderer.invoke`, so
one method is the entire bridge. `electron/requireShim.ts` + `electron/preload.ts`
keep that shape, so contextIsolation costs third-party plugins no release.

## Verified by probe, not by documentation

Electron 43, minimal probe apps. Re-run these if you doubt any of it.

| Claim | Result |
| --- | --- |
| `contextIsolation:true` + `nodeIntegration:false` + `nodeIntegrationInWorker:true` | renderer has no `require`/`process`; a Worker still `readFileSync`s off disk |
| The shim under contextIsolation | Apollo's exact `globalThis.require('electron')` destructuring works; `invoke` round-trips a real value from main; `require('fs')` refused; unlisted channel refused |
| main-process `loadURL` | does **not** emit `will-navigate` (renderer-initiated navigation does) — why the guard doesn't break `loadTarget` |

**The preload must be `.cjs`.** This package is `"type": "module"`, so a preload
written to `build/preload.js` parses as ESM and throws on its own `require()`
before exposing anything — silently, because a throwing preload does not stop
the page. The renderer just quietly has no bridge, which looks exactly like
`contextBridge` being broken. See `scripts/buildElectronMain.ts`.

## What actually blocks the flip

### 1. `openLocation` is the chokepoint — fix the funnel, not the call sites

There is **exactly one** non-test `new LocalFile` in the repo:

```
packages/core/src/util/io/index.ts:56    return new LocalFile(location.localPath)
```

`openLocation` returns a `GenericFilehandle` (`read`/`readFile`/`stat`/`close`).
Slot an IPC-backed implementation in behind that interface for
`LocalPathLocation` when Node isn't reachable, and **every call site is fixed
unchanged** — including any not found by grep.

Why main-thread reads exist at all: JBrowse's RPC boundary exists for
*rendering* ("render this region → return an image"). An adapter feeding a
renderer is constructed **inside the worker**, so its `openLocation` runs where
Node lives. Reads whose result lands in the main-thread model as *data* have no
render call to ride on, so they run on the main thread. Known instances —
`assemblyManager/assembly.ts` (refNameAliases, genetic codes),
`data_adapters/CytobandAdapter`, `spreadsheet-view/ImportWizard` — are all small,
whole-file, read-once metadata. They are not special-casing Electron; they call
the same `openLocation` as everything else, and it only reached `node:fs`
because the renderer happened to have it. The same code runs fine in
jbrowse-web, where a `LocalPathLocation` cannot exist.

### 2. The renderer bundle statically requires `fs` — this is the real blocker

The flip does not degrade gracefully; it stops the app booting. The chain:

- `products/jbrowse-desktop/scripts/config.ts` sets `config.target =
  'electron-renderer'`, so webpack leaves node-builtin `require()` calls in the
  renderer bundle instead of polyfilling them. The current bundle really does
  contain literal `require("fs")` (`build/main.*.js`, `build/912.*.chunk.js`).
- The same file sets `config.resolve.aliasFields = []`, which **disables the
  browser field**, and then explicitly aliases `generic-filehandle2` to
  `dist/index.js` — the Node build.
- `generic-filehandle2/dist/index.js` requires `./localFile.js`, which does
  `require("fs/promises")` **at module scope**.
- `packages/core/src/util/io/index.ts:1` imports it statically:
  `import { BlobFile, LocalFile } from 'generic-filehandle2'`.

So under contextIsolation that `require` throws *while the module is loading*,
the chunk fails, and the renderer never starts — a blank window, not a
file-read error.

Fix direction: keep `fs` out of the renderer's module graph entirely rather than
trying to make it fail nicely. `generic-filehandle2` ships a `browser.js` entry
that omits `LocalFile`; letting the browser field resolve (or importing
`LocalFile` lazily behind the capability check) is what makes the IPC-backed
filehandle in step 1 actually reachable. Expect `config.target` to need
revisiting too — `'electron-renderer'` is the wrong target for a renderer with
no Node.

This is also why grep alone underestimates the work: the dependency is in a
transitive `node_modules` module, not in JBrowse source.

### 3. `isElectron` is a userAgent sniff, and it is a landmine

```ts
// packages/core/src/util/index.ts
export const isElectron = /electron/i.test(navigator.userAgent)
```

Electron sets that UA regardless of `contextIsolation`, so after the flip
`isElectron` stays `true`, `openLocation` confidently takes the `new LocalFile`
branch, and it fails deep inside generic-filehandle reaching for `fs` that isn't
there — **not** the clean "can't use local files in the browser" error.

Do not simply redefine `isElectron`: it has ~32 non-test uses across core,
plugins and products, and most of them genuinely mean "am I in desktop",
not "can I reach Node". The gate at `io/index.ts:56` wants a *capability* check.

On the adjacent `isNode` brand-check
(`toString.call(globalThis.process) === '[object process]'`): because the target
is `electron-renderer`, webpack injects no `process` shim, so the real Node
`process` is visible and `isNode` is likely already `true` in the desktop
renderer today — making `|| isElectron` redundant at this call site. Not probed
directly; check before relying on it. After the flip both go false, which is
correct, but by then the bundling issue above has already bitten.

### 4. Plugin loading

`src/util.tsx` `fetchCJS` writes plugin code to a temp dir with `node:fs` and
`require`s it in the renderer. Under contextIsolation neither is available, so
the CJS plugin path needs rethinking (ESM `import(url)` already works in a
browser context). Note this is also the RCE vector the plugin gate compensates
for; once the renderer has no Node, a plugin evaluated there gets only browser
APIs plus the shim, which is the actual goal.

### 5. Argument validation is part of this work, not a follow-up

The preload allowlists channel *names*, not *arguments*. Several channels take
unbounded paths and URLs:

- `saveSession(sessionPath, snap)` — arbitrary file **write**
- `loadSession(sessionPath)` — arbitrary file **read**, returned to the renderer
- `indexFasta(location)` — fetches any URL or reads any local path
- `blatFetch(url, body)` — POSTs anywhere with the default session's cookies

Today this is moot: the renderer already has Node. After the flip these **are**
the boundary, and locking the renderer while leaving `saveSession(anyPath)`
reachable just changes the payload from `require('fs')` to an `invoke`. Constrain
session paths to `userData`/the JBrowse documents dir plus what the user actually
chose through `promptOpenFile` (the main process can remember what it handed
out — that is the only path the user consented to), and bound `blatFetch` to
known hosts.

## Suggested order

Do the bundling first. It is the one that decides whether this is feasible at
all, and every later step is unverifiable while the renderer won't boot.

1. **Get `fs` out of the renderer's module graph** (blocker 2). Concretely: does
   the renderer bundle still contain `require("fs")` after letting the browser
   field resolve for `generic-filehandle2` and revisiting `config.target`? Answer
   that before writing any of the rest — a spike, not a refactor. If it turns out
   `electron-renderer` is load-bearing for something else (workers share the
   config), the whole plan needs rethinking and it is cheap to learn that now.
2. Type the renderer's IPC. `electron/ipc/channels.ts` types only
   `ipcMain.handle`, so all 23 `invoke` sites return `any`. The preload has to
   enumerate the surface anyway (`electron/ipc/channelNames.ts`), so the typed
   client is nearly free — and it makes step 5's validation type-checked.
3. IPC-backed `GenericFilehandle` behind `openLocation` + the capability check.
4. Plugin loading off `node:fs`/`require`.
5. Argument validation on the channels above.
6. Flip `window.ts`: `contextIsolation: true`, `nodeIntegration: false`, keep
   `nodeIntegrationInWorker: true`, add `preload: build/preload.cjs`.
7. An e2e assertion that the lockdown holds — `require('fs')` throws,
   `require('electron').ipcRenderer` works — so nobody quietly re-enables
   nodeIntegration to fix a bug. Assert the bridge *exists* too: the `.cjs` trap
   produces no bridge at all, silently.

`webSecurity: false` is load-bearing for CORS to genome servers and is
independent of contextIsolation; it can stay.

## Not verified

The flip has **not** been attempted against the real app — only minimal probe
pages. Verifying it needs a fresh webpack renderer build plus the packaged-app
e2e harness (`test/harness.ts` runs against `dist/unpacked/…`). Expect at least
one renderer-side Node dependency that grep did not surface; fixing the
`openLocation` funnel (step 2) rather than individual call sites is what makes
that survivable.
