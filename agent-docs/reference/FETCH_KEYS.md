---
name: fetch-keys
description: What keys a fetch, when does a zoom refetch, and how does a fetch run? The `rpcProps()` / `gpuProps()` / `renderState` tiers, cache-key and payload rules, zoom staleness, derived region maps, the loop trap, and the latest-wins fetch skeleton.
kind: spec
---

# Fetch keys, zoom staleness and the fetch skeleton

[DISPLAY_PIPELINE.md](DISPLAY_PIPELINE.md#rpcprops--gpuprops-pattern) states the tiers;
this doc holds the rules behind them: what invalidates a fetch, an upload and a frame,
how a per-region display decides its cached data is stale under zoom, and the one machine
every fetch runs on.

## What each tier costs when it moves, and who is zoom-sensitive

**A per-frame viewport value must never reach `gpuProps()`.** It re-encodes the whole
cache mid-gesture, and the profile blames the encoder rather than the key that let it in.
No `gpuProps()` reads live `bpPerPx`, `offsetPx`, `visibleRegions`, `dynamicBlocks` or
hover. The one deliberate exception is `LinearMafDisplay`'s `binBp`
(`encodeBinBp`: `subPixelBinBp` off the **throttled** `coarseBpPerPx`, quantized to a
power of two). The alignments worker's `perBaseBinBp` rides the RPC call site instead
([PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md)).

## Structural args stay out of `rpcProps()`

**Override `adapterConfig` only to change what the adapter *is*, never to annotate it.**
`dataAdapterCache` keys on the config object (`adapterConfigCacheKey`), so a key the
adapter never reads still forks the cache: the decorating display gets its own adapter
instance and file parse, and nothing raises an error. Pass a worker-side value that is
not the adapter's as a sibling RPC arg, the way `sequenceAdapter` is passed.

## The cache key is the return value, not the reads

The compare is structural, not a serialized string: `JSON.stringify` drops an
`undefined`-valued key and flattens a field-less class to `{}`, a **silently dead cache
axis** ([ADR-132](../architecture-decision-records/adr-132-fetch-keys-are-values-compared-structurally.md)).
A live collection mutated in place behind a stamp is the other hazard: `snapshotInputs`
rebuilds and freezes it, so build a fresh class instance rather than mutating one.

## Pick the payload out of the snapshot; never subtract from it

The subtractive spelling (snapshot minus an exclusion list) fails silently. A slot nobody
excluded becomes an RPC cache key (`height`, which the resize handle writes every drag
frame). The leaking names come from another package's schema, so whoever adds a
main-thread slot has no reason to open a display plugin's `rpcProps()`. And the superset
reaches the typed args through a cast, the assertion that would have caught the extras.
Pick the slots the worker reads, off a key list the compiler checks exhaustive against
the interface it reads them through; a slot present only to invalidate gets its own named
field.

## Per-region zoom-staleness

A display states its zoom rule through two hooks. **`zoomFetchArgs()`** (undeclared by
default) returns the zoom-derived arguments a fetch issued now would send the worker;
`fetchRegions` stamps it beside the region. **`regionHasData(idx)`** answers whether the
stored payload still answers at the view's `bpPerPx`; the default reads the payload's
`zoomRange` where the adapter declared one (`BaseFeatureDataAdapter.getZoomRange`).

Keep them apart. A rule that is no worker input belongs in `regionHasData`; written as a
fetch input it stamps an argument the worker never reads. An input that changes when data
arrives is the `rpcProps()` loop again ([loop trap](#rpcprops-loop-trap-and-how-to-break-it)).

`zoomFetchArgs` must read an observable: the foundation reads it inside a computed, so
args over non-observable state are memoized for the display's life and the first fetch is
cached forever. A coarse tier is its own store with its own span (`CoarseTierMixin`),
never a `zoomFetchArgs` field or a second map stamped into `loadedRegions`: an input
naming the tier reads as stale when the display swaps tiers, and a shared stamp narrows
the coarse span to the detail's.

### Export gate, not scrim

`isCacheValid` is a term of `dataCurrent`, the freshness half of `foundationSvgReady`.
Without it, an export inside the `FetchVisibleRegions` throttle draws the previous zoom's
bins, columns or amino acids. `displayPhase` does not read `dataCurrent`
(`MultiRegionDisplayMixin` hands `foundationDisplayPhase` a `viewportWithinLoadedData`
thunk): folding staleness into the phase raises the scrim into every zoom, which was
declined. The term cannot latch, because `planRegionFetch` refetches a block on
`!(isBlockCovered && isCacheValid)`. The live-versus-settled half it cannot see is
[`dataSuperseded`](DISPLAY_KIT.md#datasuperseded-covers-what-fetchinputs-cannot-state).

## `gpuProps()` and derived region maps — re-upload without refetch

**Opacity is a render parameter, never a packed color.** Synteny multiplies it in
`fillShade`, dotplot in `dotplot.slang`'s fragment, fed from render state with a Canvas2D
twin so SVG export matches. Baking it into every packed ABGR byte turns one drag frame
into three O(n) passes for a value identical on every instance. The color-lane patch that
spares a genuine recolor a full re-pack is a backend concern:
[GPU_DISPLAY_LIFECYCLE.md § Upload patterns](GPU_DISPLAY_LIFECYCLE.md#upload-patterns).

Use a derived region map when settings change the shape of per-region data, and
`gpuProps()` for scalars fed to an encoder. Split the tier so a recolor doesn't re-run row
placement, and emit fresh per-region objects rather than mutating entries. The raw
`rpcDataMap` is never mutated, which fixes its representation: build it with
[`regionDataMap()`](../../packages/render-core/src/regionDataMap.ts), a **shallow**
`observable.map` ([ADR-060](../architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
A hand-written `observable.map<number, …>()` is the thing to notice in review.

## Theme-derived render inputs are session getters, not pushed volatiles

A palette is a pure function of the active theme, so derive it in a model getter,
`<plugin builder>(getPaletteHost(self).palette)`, that `gpuProps()` / `renderState` read
directly. Do **not** push it into a volatile from a React `useEffect`: the effect runs
only on mount, so SVG export and RPC, which have no component, see a null palette and
render blank. A drawing autorun follows the same rule. Read `session.palette`, not
`session.theme`: the palette is the serializable, toolkit-free one that crosses the RPC
boundary.

## `rpcProps()` loop trap and how to break it

A fetch-result derivative in `rpcProps()` loops forever: `setCellData` changes a derived
value, `rpcProps()` changes, `SettingsInvalidate` runs `invalidateSettings`, which clears
`cellData`, which changes the derived value again.

**Rule:** `rpcProps()` contains only user-controlled settings. Never include `cellData`,
`samplePloidy` or any getter that reads them. Split the computation: `rpcProps()` gets a
cache-key version from user inputs only, and the part needing fetch-result data stays in
a separate view used for rendering. In the variant case, `rpcProps().sampleFilter` reads
`sourcesBase` (before haplotype expansion); the client's `sources` view reads
`samplePloidy` for rendering only, and the worker expands haplotype rows itself.

## Row order is not a fetch input

**A fetch argument may name the row *set*, never the row order.** The set is real work,
while the order is a permutation the main thread applies for free. Sort the set: unsorted,
it puts the order back in through the cache key, which compares arrays in order.

## The fetch skeleton: one latest-wins machine, one phase contract

**begin → clear the error → run → commit if still current → `handleFetchError` → end.**
`runFetchOnce` (`@jbrowse/core/util/installFetch`) is that sequence; `installFetch` adds
the autorun over it: the abort rotation, the leading edge, the unconditional
`reloadCounter` read, the durable cancel gate, and the dev-only contract checks
([DISPLAY_KIT.md](DISPLAY_KIT.md#contract-checks)).

Map: `FetchMixin.runFetch` holds `runFetchOnce` for the per-region family (it needs the
MST flow); keyed families lend `FetchMixin`'s rotation through the `rotation` option;
`createAbortRotation` owns latest-wins abort and the supersede-vs-end status rule
(ADR-080); `FetchPhases` (`@jbrowse/core/util/fetchPhases`) is the `prepare`/`run`/`commit`
contract for the global and comparative families (per-region is deliberately not this
shape, see `RegionFetchContext`); `handleFetchError` swallows an abort and any failure of
a fetch no longer current.

Every installer's first run is a microtask, not the install call: a model is built and
configured in the same synchronous block, and a fetch issued between the two runs against
un-configured state and is reissued. Nothing downstream of a fetch may be correct only
because the fetch is slower than it; an empty block list is not a stale domain but the
fallback one, and `settledDynamicBlocks` is the in-tree fix.

### The global-fetch trigger list must be read unconditionally

`installFetch` reads `reloadCounter` and `fetchCanceled` unconditionally at the top of
its body, above every gate, and that ordering is load-bearing. MobX rebuilds the
dependency set on every run, so a read inside the gate drops out on any run that
declines and can never wake the autorun again: `reload()` is silently dead.

**`prepare` returning `undefined` is the display's gate.** It runs synchronously in the
autorun body, so whatever it read to decline stays in the dependency set. The skeleton's
`gate` already declines while `view.initialized` is false. A `prepare` must not move a
trigger read of its own under a bail-out.

The general rule: **a gated trigger read is safe only if the gate is itself an
observable that flips on the transition you want to wake up on.** `if (self.isMinimized)
return` above the tracked deps is fine; a pure signal like `reloadCounter`, which no gate
consults, is the dangerous case. A `fetchNeeded` override that returns early without
fetching must supply its own wake path: a fetch bumps `fetchGeneration`, and a skipped
fetch breaks that chain. `installGlobalFetchAutorun.test.ts` and `installPerRegionFetchAutoruns.test.ts` assert
`reloadCounter`, `fetchCanceled` and `alive` stay visible in the declining states.
