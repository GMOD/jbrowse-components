---
name: host-chosen-plugin-sets-for-embedded-products
description: A bring-your-own host cannot ship only the plugins it uses: createModel concatenates its plugins onto a hardcoded corePlugins array, and a runtime allowlist saves zero bytes. The minimal change is a parameter; measure what the one BYO page that swaps product plugins would save first.
---

# Host-chosen plugin sets for embedded products

Split out of the build-and-dependencies collection on 2026-09-27.


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
per [PLUGIN_ABI_STABILITY.md](../../reference/PLUGIN_ABI_STABILITY.md): a defaulted
parameter is additive, but the two newly-published factories ossify.

**Unmeasured, and cheap to measure first.** The one BYO page that swaps product
— `SyntenyRibbons.tsx`, the only importer of `@jbrowse/react-app2` — is 675 KB
gzip / 333 chunks against 507-566 for the pages on
`@jbrowse/react-linear-genome-view2` (`eagerBundleSizes.json`). That is +11
plugins for ~115 KB, so roughly 10 KB gzipped per plugin, and it is a
correlation on one page rather than a controlled result: react-app2 also brings
app chrome. Taken at face value it says a four-plugin subset of the 18 might
save ~140 KB off a 508 KB page. Get the real number by building the
`one-track` page against a hand-cut array and running that site's
`measureEagerBundle.mjs`, before anyone argues about the ABI.

**This is the lever [reference/EAGER_BUNDLE.md](../../reference/EAGER_BUNDLE.md)
leaves unexplored, not one it declined.** That doc's closing "not worth chasing"
is about the ~1.4 MB raw needed to register a *fixed* 18-plugin set — "that is
the engine, and `createViewState`'s contract is that all of it is registered
before a session snapshot can be read". Both halves of that sentence hold only
while the set is fixed. A host choosing four plugins is a different question,
and its six pins are all spent.
