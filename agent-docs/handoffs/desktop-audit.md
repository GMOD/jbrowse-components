---
name: handoff-desktop-audit
description: What remains of the jbrowse-desktop structural audit — the contextIsolation finish and the plugin bridge — plus the two decisions that are Colin's. The BLAT bridge, export-to-web durability and the quitAndInstall/closeGuard gap have landed; read this before starting either of the two that are left.
---

# Handoff: the jbrowse-desktop audit

An end-to-end read of `products/jbrowse-desktop`. Most of it has landed. This
file is what keeps the rest from being re-derived.

## Landed

- **The `INVOKABLE_CHANNELS` guard and the four gaps it hid** —
  `fix(desktop): repair the IPC channel guard and the four gaps it hid`.
- **The BLAT bridge is off the app's default cookie jar** — its own partition
  (`electron/blatSession.ts`), plus http(s)-only, no embedded credentials, a
  16 MB capped read and a timeout. `electron/ipc/blatHandlers.test.ts`.
- **Export links say when they will not travel** — `ShareLinkField` separates
  "may not survive delivery" (8k) from "will not open" (80k, WebKit's ceiling,
  which Chromium's 2 MB hides from whoever made the link), and the export dialog
  fills the second tier's action with the short-link mode. The url also carries
  `exportedFrom=jbrowse-desktop@<version>`.
- **`quitAndInstall` against `closeGuard`** — Electron closes the windows
  without emitting `before-quit`, so the guard held that close and never
  re-issued the quit; on macOS the update silently did not install.
  `subscribeQuitSignals` names both events.
- **The bundling spike** — answered, and its answer is in
  `reference/DESKTOP_CONTEXT_ISOLATION.md` with the two-build table.

## 1. Finish the contextIsolation migration

`reference/DESKTOP_CONTEXT_ISOLATION.md` holds the plan; read that, not this.
What belongs here is what the spike changed and what is still unprobed.

**Step 1 is an import change, not a resolution change.** Deleting the
`generic-filehandle2` alias does clear `fs` from the renderer — and from the RPC
worker, which then holds the stub `LocalFile` that rejects every read. One
`resolve` config serves both graphs. So: `await import()` the `LocalFile` behind
the capability check, and let the renderer's graph contain a node build it never
evaluates.

**Start with the barrel leak — it is the cheapest win in the whole workstream.**
`src/indexJobsModel.ts` imports two pure config helpers from
`@jbrowse/text-indexing`, whose barrel also re-exports the indexer, which
imports `ixixx`, which spawns `sort`. Eight of the renderer's twelve node
builtins are that one import. An `exports` map on that package removes them
without touching desktop's behavior at all. Measured inventory in the reference
doc's "What the renderer actually requires from Node".

**Unprobed, and worth knowing before step 6:** whether page-thread JS can
construct its own Web Worker and inherit `nodeIntegrationInWorker`. If Electron
grants node integration to any worker the renderer creates rather than only to
same-origin script urls, the flip is worth much less than it looks. Same minimal
probe-app shape as the three rows already in that doc's table.

## 2. Give plugins a sanctioned way to reach the main process

**The division, which decides the shape.** The Web Worker is for processing and
has Node (`nodeIntegrationInWorker`, independent of the renderer's flag, and
runtime plugins load into that realm — `product-core/src/rpcWorker.ts`). The
page thread is for UI. So an analysis-suite plugin that wants to run tools or
read files registers an `RpcMethodType` and does it in the worker; the flip does
not touch that. The bridge is only for what the worker structurally cannot have:
the app's window, identity and OS integration. **No IPC is ever plumbed into the
worker** — today that is enforced only by accident, since every non-test reach is
spelled `window.require('electron')` and a worker has no `window`.

**The shape is already in the tree, and it is not invoke-shaped.**
`fileToLocation` (`packages/core/src/util/index.ts`) wraps
`webUtils.getPathForFile` as a plain function and is published at
`@jbrowse/core/util` (`ReExports/publicUtil.ts:100`, alongside `isElectron`).
Every caller is a React drop zone. That is the pattern the other crossings want:
**core exports a plain capability function, desktop implements it, the plugin
never sees `ipcRenderer`** — which also dissolves the old worry that "the bridge
can't be only `invoke`", since a wrapper does not care what it is built on.

Still hand-rolling `window.require('electron')` and restating `channelTypes.ts`
with casts:

| | reaches |
| --- | --- |
| `plugins/blat/src/desktopBlat.ts` | `blatFetch`, `openBlatChallenge` |
| `plugins/authentication/src/OAuthModel/model.tsx` | `openAuthWindow` |
| `packages/core/src/ui/FileSelector/LocalFileChooser.tsx` | `promptOpenLocalFile` |
| `packages/core/src/util/index.ts` (`fileToLocation`) | `webUtils.getPathForFile` |

A fifth lives outside this repo: Apollo's
`ApolloInternetAccount/model.ts:209` does `globalThis.require('electron')` and
hand-builds desktop's `AuthWindowParams` with no types at all.

**ReExports is the surface — the ABI objection to it does not hold up.** The
earlier reading of `PLUGIN_ABI_STABILITY.md` overstated the risk of *adding* a
name:

- `rollup-plugin-external-globals` inlines `JBrowseExports["@jbrowse/core/util"]
  .name` at each **use site**. A name an old host lacks reads `undefined` there
  and throws only when called. `defaultCodonTable` error-paged hosts because the
  *plugin* called it at module scope, not because of the import mechanism.
- `PluginLoader.loadSettled` — what the apps use — already degrades a throwing
  bundle to a reported failure. Its own comment names "a bundle that needs a
  newer host than the one reading the config" as the case it exists for.
- The residual is the worker, which uses all-or-nothing `load`. Only a
  module-scope throw reaches it, and a capability called from an action cannot
  cause one.

**The one rule that follows: add to an existing ReExports module, never a new
module path.** A missing module key makes the member read throw rather than
yield `undefined`, and it is the only shape that can throw at module scope.

`scripts/check-published-plugins.ts` reads every store bundle for the names it
actually takes off `JBrowseExports`; run it before and after.

**Do not start with `webUtils`.** Decide the shape on `blatFetch`, which has one
consumer and a test, then move the other three.

## Colin's calls, not the implementer's

- **The autosave interval is still 1 s.** `autorun`'s `delay` is a throttle
  rather than a debounce, so it fires for as long as anything changes — panning
  included. The data-loss window is much smaller than when 1 s was chosen:
  `closeGuard` flushes on window close, and Exit, return-to-start-screen and
  session-swap all flush too. An interval that scales with the serialized size is
  the version worth proposing. It is a judgment call about the user's data.
- **Whether to pin the export deployment.** `DEFAULT_WEB_BASE_URL` is
  `.../jb2/latest/`, and the hosted base config a link diffed against is fetched
  fresh on both ends. The link now records what produced it; pinning what it
  opens against is a deployment decision.
