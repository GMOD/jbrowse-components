---
name: build-and-dependencies
description: The MUI v10 cleanup, lazy display behavior via `extendInstance`, host-chosen plugin sets for embedded products, and why an embedded component cannot switch itself to the RPC worker.
---

# Build & dependencies

**Delete the jbrowse-img react-transition-group ESM workaround at MUI v10.** MUI v9's
"true ESM" build deep-imports the bare subpath `react-transition-group/TransitionGroupContext`;
that package has no `exports` map (unmaintained ~4y), so raw Node ESM rejects it with
`ERR_UNSUPPORTED_DIR_IMPORT` while bundlers resolve it fine. `@jbrowse/img` ships raw ESM,
so `jb2export` (and published end users) are exposed. Current workaround is a resolve hook
duplicated across `products/jbrowse-img/src/resolve.ts` (shipped, installed by `bin.ts`
before `await import('./main.ts')`), the packed-tarball component test
(`component_tests/jbrowse-img/resolve.mjs`), and the pre-build integration test
(`integrationResolve.mjs`, must stay hand-authored `.mjs` for tsx's loader thread).
MUI is **removing react-transition-group entirely** (migrated to an in-house transition in
PR mui/material-ui#48325), targeted for **Material UI v10** — see
[mui/material-ui#48644](https://github.com/mui/material-ui/issues/48644). When we bump to
MUI v10 the offending deep-import vanishes and the *entire* workaround (resolve.ts, the
`register` export if added, both test `.mjs`) can be deleted. Until then the runtime hook
is load-bearing and won't be backported to v9. Near-term cleanup (optional, doesn't need
v10): collapse the duplicated copies into one shipped `@jbrowse/img/register` subpath that
the CLI, the component test (`node --import @jbrowse/img/register run.mjs` against the
packed tarball), and programmatic consumers all use — which also closes the
`import { renderRegion }`-under-raw-Node exposure gap and makes CI exercise the real shipped
hook instead of its own copy. Don't bundle `@jbrowse/img` for this — it freezes the
semver flow-through for one narrow consumer path.

### Lazy display behavior via `extendInstance` (proposal, not implemented)

Defer the dependency-heavy, interaction-only slice of display models out of the
eager bundle. Today each plugin statically imports its model factory, and
`createPluggableElements()` builds every display's full MST type at boot, because
`track.displays[]` is `types.union(...allDisplays)` and must contain every type a
saved session could reference. Only `ReactComponent` is `lazy()`-split.

The primitive is the fork's `extendInstance(instance, fn)` (branch
`feat/extend-instance-lazy-chain`, unlanded): attach `{actions, views, state}` to
a **live** instance. Persisted props must stay on the base — the union hydrates
props only, so a `.props()` in a deferred segment would be dropped from the
snapshot.

The split that makes it safe is by *when the member is read*, not by size:

- **Render-critical, must be present at hydrate:** layout getters, `rpcProps()`,
  height, `renderProps`. Stay on the base.
- **Interaction-triggered:** `trackMenuItems`, `contextMenuItems`, dialog
  launchers, export sub-flows. Read only at interaction boundaries
  (`TrackLabelMenu.tsx`, `BaseTrackModel`'s `displays.flatMap(d =>
  d.trackMenuItems())`), never in the render loop, so an `await` there is fine.
  `trackMenuItems` is a plain view *function* (installed `configurable:true`, and
  observers re-invoke functions each reaction), so there is no stranded computed
  atom — the fork's "sharp edge over lazy members" caveat is about getters.

Mechanism: a volatile function slot (`menuImpl`) plus an idempotent
`ensureBehaviorLoaded()` that `import()`s the menu module and `extendInstance`s
it in; the base view delegates to `self.menuImpl?.(self)`. Either await it at the
menu-open handler, or don't and let MobX fill the open menu a frame later.

The payoff is **transitive deps** (MUI icons, editors, tree-sidebar, non-lazy
dialog helpers), not model code — own-code was measured at single-digit KB
gzipped per model. Several displays already have standalone menu modules
(`hic/LinearHicDisplay/trackMenuItems.ts`,
`canvas/LinearMultiRowFeatureDisplay/trackMenuItems.ts`,
`maf/LinearMafDisplay/trackMenuItems.ts`,
`variants/shared/multiSampleVariantMenuItems.ts`), so pilot on
`LinearHicDisplay` and **measure before continuing**: diff the main chunk gzipped
and confirm a new async chunk carries the icons out. If the deps don't leave the
eager chunk (shared with other eager code), stop — ROI collapses. Hot-path
displays (`LinearBasicDisplay`, `LinearAlignmentsDisplay`) can't defer their
models but can defer this surface, after a mechanical extraction of the
`superTrackMenuItems` wrap blocks.

Risks: one value re-export from an `index.ts` re-pins the deferred module (add a
check-script; type-only re-exports are erased); a render-critical getter reading
a deferred slot gets `undefined`; `contextMenuItems` needs the same treatment or
it re-pins the code.

Orthogonal to deferring whole secondary *view* stacks (dotplot/synteny/circular/
hic/breakpoint/sv-inspector) behind a thin registered base — that variant buys
synchronous saved-session hydration of a code-split view but needs every
persisted prop hoisted to the thin base plus a render-path loading gate. Revisit
only after the interaction-surface approach is proven.

### Host-chosen plugin sets for embedded products (proposal, not implemented)

Let a bring-your-own host ship only the plugins it uses. Today it cannot, and
the shape of *why* is the useful part, because the obvious version of the idea
buys zero bytes.

**What exists is additive only.** `createViewState`'s `plugins` option
(`products/jbrowse-react-linear-genome-view/src/createViewState.ts:106`) reaches
`createModel`, which concatenates the host's plugins onto a hardcoded array:
`corePlugins.map(...)` then `runtimePlugins.map(...)`
(`createModel/createModel.ts:27-30`). `corePlugins.ts` is 18 static imports for
`@jbrowse/react-linear-genome-view2` and 29 for `@jbrowse/react-app2`. Nothing
in the published surface removes an entry, and no example on the BYO site passes
`plugins` at all.

**A runtime allowlist is not the feature.** Bundle size is the static module
graph, not which registry entries a caller instantiates. `plugins: ['wiggle',
'sequence']` filtered at `createViewState` time would still ship all 18 plugin
graphs — no bundler can prove the rest unreachable through a static array. This
has to be *build-time* selection, i.e. the host's own import list reaching the
plugin manager, or it is a no-op with a config knob on top.

**The worker half of that door is already open; the main-thread half is not.**
`initializeWorker(corePlugins, opts)` takes the array as an argument and is
publicly exported (`packages/product-core/src/index.ts:103`), so a host can
write its own worker entry with a chosen set today — which is exactly what each
product's `rpcWorker.ts` does, and why `makeWorkerInstance.ts` says the module is
deliberately not shared. On the main thread, `createModel` is exported from the
package entry but hardcodes `corePlugins` internally, and the two pieces you
would need to assemble the model yourself — `createSessionModel`,
`createConfigModel` — exist on `createModel/index.ts` and are *not* re-exported
from the package's `index.ts`. One layer down, `createEmbeddedRootModel`
(`@jbrowse/embedded-core`) already takes a `pluginManager`, so the seam is
there; it just is not published through.

**The minimal change is therefore a parameter, not an architecture.** Give
`createModel` an optional core-plugin array defaulting to today's, and publish
`createSessionModel`/`createConfigModel` from the package entry. A host then
writes its own `corePlugins.ts` and its own worker entry — two files, both
already the shape the products use.

**What it costs, and this is the part to decide before the code.** The plugin
set stops being ours, so a session snapshot naming a track type the host omitted
fails at hydrate instead of degrading, and every support question about a
missing display type gains a new first answer. Whatever error that produces has
to name the omitted plugin, or the feature is a trap. It is also ABI-adjacent
per [PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md): a defaulted
parameter is additive, but the two newly-published factories ossify.

**Unmeasured, and cheap to measure first.** The one BYO page that swaps product
— `SyntenyRibbons.tsx`, the only importer of `@jbrowse/react-app2` — is 675 KB
gzip / 333 chunks against 507-566 for the pages on
`@jbrowse/react-linear-genome-view2` (`eagerBundleSizes.json`). That is +11
plugins for ~115 KB, so roughly 10 KB gzipped per plugin, and it is a
correlation on one page rather than a controlled result: react-app2 also brings
app chrome. Taken at face value it says a four-plugin subset of the 18 might
save ~140 KB off a 508 KB page. Get the real number by building the
`ultraminimal` page against a hand-cut array and running that site's
`measureEagerBundle.mjs`, before anyone argues about the ABI.

**This is the lever [reference/EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md)
leaves unexplored, not one it declined.** That doc's closing "not worth chasing"
is about the ~1.4 MB raw needed to register a *fixed* 18-plugin set — "that is
the engine, and `createViewState`'s contract is that all of it is registered
before a session snapshot can be read". Both halves of that sentence hold only
while the set is fixed. A host choosing four plugins is a different question,
and its six pins are all spent.

### An embedded component that opts into the worker by itself (proposal, not implemented)

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
[reference/BGZF_WORKER_POOL.md](../reference/BGZF_WORKER_POOL.md) exists to
record, one layer down, and this adds a second of the same shape. A warning
naming the driver it fell back to costs nothing, and is the difference between
a slow embed and a mystery.
