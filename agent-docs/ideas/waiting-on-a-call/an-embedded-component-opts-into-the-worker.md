---
name: an-embedded-component-opts-into-the-worker
description: An embedded component cannot switch itself to the RPC worker because its plugins are registered in the main realm, not because of bundling. A conditional default is decidable at createViewState time and the failure path is mostly built; the call is whether demoting to the main thread is silent.
---

# An embedded component opts into the worker by itself

Split out of the build-and-dependencies collection on 2026-09-27.


Make `@jbrowse/react-linear-genome-view2` and its siblings run their RPC in a
worker without the host writing anything, so the fast path is the default one.
Today `createViewState` parses on the UI thread unless the caller supplies a
`makeWorkerInstance` factory.

**Bundling is not the blocker, though the docs read as though it is.**
`embedded_components.md` explains the opt-in as bundler-specific, which is true
of the spelling a *host* writes and not of the package.
`products/jbrowse-react-linear-genome-view/src/makeWorkerInstance.ts` already
ships as a published subpath export, and its body — `new Worker(new
URL('./rpcWorker', import.meta.url))` — is the form Vite and webpack 5 both
resolve natively. `createViewState` could `await import('./makeWorkerInstance.ts')`
when the caller passes none. Dynamic, so the worker chunk and the 18 plugin
graphs behind it stay out of the eager bundle: the same move, for the same
reason, as `sharedBgzfWorkerPool` on the load clock.

**The blocker is which realm a plugin is registered in**, and it is written
down already, at `packages/product-core/src/pluginInput.ts`. Only a plugin
carrying a `definition` reaches the worker — `toPluginLoadRecord` keeps one off
a `loadPlugins` record and a bare class has none, so
`PluginManager.runtimePluginDefinitions`, the list `RpcManager` ships as the
worker's boot config, never names it. A host passing `plugins: [MyPlugin]`
works today because there is one realm. Flipping the default hands it two, its
adapter is registered in neither the worker nor an error message, and the
failure lands as an unknown adapter type on a track that used to load. An
automatic default that breaks a working app is worse than a slow one, so it
cannot be unconditional.

**A conditional default is decidable at `createViewState` time.** Take the
worker when the caller passed no plugins, or passed only `{plugin, definition}`
records; stay on the main thread when any entry is a bare class, and say so
once on the console with the `loadPlugins` fix beside it. No page on the BYO
examples site passes `plugins` at all, so the rule covers the common case
without touching the one it would break.

**The failure path is most of the way built.** `WebWorkerRpcDriver.makeWorker`
already rejects on a worker-posted `error` and on the raw `ErrorEvent`, the
second with a comment about a worker script that throws while loading and posts
nothing — which is what a bundler that does not resolve the worker URL
produces. What is missing is the demotion: `RpcManager.getDriverForCall` reads
`this.defaultDriverName` on every call, so falling back is assigning that field
once on a boot rejection. Without it an automatic default turns a bundler
mismatch into a view that never loads, which is the one outcome worse than
parsing on the UI thread.

**Decide before the code whether the demotion is silent.** A pool that quietly
stops being a pool is the trap
[reference/BGZF_WORKER_POOL.md](../../reference/BGZF_WORKER_POOL.md) exists to
record, one layer down, and this adds a second of the same shape. A warning
naming the driver it fell back to costs nothing, and is the difference between
a slow embed and a mystery.
