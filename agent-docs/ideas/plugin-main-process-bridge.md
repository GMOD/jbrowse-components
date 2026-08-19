---
name: plugin-main-process-bridge
description: Four in-repo plugins and Apollo reach Electron's main process by hand-rolling `window.require('electron')` and restating channelTypes.ts with casts. The shape that fixes it is already in the tree as fileToLocation, the ReExports ABI objection to publishing more of them does not hold up, and one rule follows from why it does not.
---

# Give plugins a sanctioned way to reach the main process

Desktop has no supported way for a plugin to reach the main process, so the ones
that need it hand-roll `window.require('electron')` and restate
`channelTypes.ts` with casts:

| | reaches |
| --- | --- |
| `plugins/blat/src/desktopBlat.ts` | `blatFetch`, `openBlatChallenge` |
| `plugins/authentication/src/OAuthModel/model.tsx` | `openAuthWindow` |
| `packages/core/src/ui/FileSelector/LocalFileChooser.tsx` | `promptOpenLocalFile` |
| `packages/core/src/util/index.ts` (`fileToLocation`) | `webUtils.getPathForFile` |

A fifth lives outside this repo: Apollo's `ApolloInternetAccount/model.ts:209`
does `globalThis.require('electron')` and hand-builds desktop's
`AuthWindowParams` with no types at all — not even a cast, since
`globalThis.require` is `any`.

## The division, which decides the shape

The Web Worker is for processing and has Node — `nodeIntegrationInWorker`,
independent of the renderer's flag, and runtime plugins load into that realm
(`product-core/src/rpcWorker.ts`). The page thread is for UI.

So an analysis-suite plugin that wants to run tools or read files registers an
`RpcMethodType` and does it in the worker; the contextIsolation flip
([reference/DESKTOP_CONTEXT_ISOLATION.md](../reference/DESKTOP_CONTEXT_ISOLATION.md))
does not touch that. **The bridge is only for what the worker structurally
cannot have**: the app's window, identity and OS integration.

**No IPC is ever plumbed into the worker.** Today that is enforced only by
accident, since every non-test reach is spelled `window.require('electron')` and
a worker has no `window`.

## The shape is already in the tree, and it is not invoke-shaped

`fileToLocation` (`packages/core/src/util/index.ts`) wraps
`webUtils.getPathForFile` as a plain function and is published at
`@jbrowse/core/util` (`ReExports/publicUtil.ts`, alongside `isElectron`).
Every caller is a React drop zone.

That is the pattern the other crossings want: **core exports a plain capability
function, desktop implements it, the plugin never sees `ipcRenderer`.** It also
dissolves the old worry that "the bridge can't be only `invoke`", since a wrapper
does not care what it is built on.

## ReExports is the surface, and the ABI objection to it does not hold up

An earlier reading of
[reference/PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md)
overstated the risk of *adding* a name:

- `rollup-plugin-external-globals` inlines
  `JBrowseExports["@jbrowse/core/util"].name` at each **use site**. A name an old
  host lacks reads `undefined` there and throws only when called.
  `defaultCodonTable` error-paged hosts because the *plugin* called it at module
  scope, not because of the import mechanism.
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

## Design against Apollo, and start with `blatFetch`

Apollo is the plugin to design against: it is the one external consumer we
coordinate releases with, its build externalizes `@jbrowse/core/ReExports/list`
wholesale (`rollup/rollup.config.mjs`), and the store can serve it per host
version — `SourceVersion.jbrowseRange` in GMOD/jbrowse-plugin-list, which "drives
semver range selection by the consumer". So an ABI floor is manageable for store
installs; what has no range resolution is a jb2hubs config naming `latest/`
directly.

**Do not start with `webUtils`.** Decide the shape on `blatFetch`, which has one
consumer and a test, then move the other three.

## Fix one sentence when this lands

`electron/requireShim.ts`'s header still says every crossing is an
`ipcRenderer.invoke`. It isn't — `webUtils.getPathForFile` is the counterexample
— and the shim's own error message telling the reader to use an RPC worker for
filesystem access is right. The wrapper shape makes the header true again, so fix
it here rather than separately.
