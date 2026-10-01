---
name: fetch-keys
description: What keys a fetch, when does a zoom refetch, and how does a fetch run? The `rpcProps()` / `gpuProps()` / `renderState` tiers, cache-key and payload rules, zoom staleness, derived region maps, the loop trap, and the latest-wins fetch skeleton.
kind: spec
---

# Fetch keys, zoom staleness and the fetch skeleton

[ARCHITECTURE.md](../ARCHITECTURE.md#rpcprops--gpuprops-pattern) states the three
tiers; this doc holds the rules behind them: what invalidates a fetch, an upload and a
frame, how a per-region display decides its cached data is stale under zoom, and the one
machine every fetch runs on.

## What each tier costs when it moves, and who is zoom-sensitive

| tier | a change does | cost |
| --- | --- | --- |
| `rpcProps()` | `settingsFetchInputs` moves, every loaded region's `fetchInputs` stamp goes stale, `SettingsInvalidate` runs `invalidateSettings()` | refetch every region, drawn stale under the scrim meanwhile |
| `gpuProps()` | the identity `installUpload` compares moves (`createEncodeMemo`, `packages/render-core/src/encodeMemo.ts`) | **re-encode every cached region, main thread, no RPC** |
| `renderState` | the render callback re-fires | repaint |

The middle row surprises because it is O(cached regions x features) of main-thread work
with nothing on the network to show it ([ADR-016](../architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md)).

**A per-frame viewport value must never reach `gpuProps()`.** It re-encodes the whole
cache mid-gesture, and the profile blames the encoder rather than the key that let it in.
No `gpuProps()` reads live `bpPerPx`, `offsetPx`, `visibleRegions`, `dynamicBlocks` or
hover. The one deliberate exception is `LinearMafDisplay`'s `binBp`
(`encodeBinBp`: `subPixelBinBp` off the **debounced** `coarseBpPerPx`, quantized to a
power of two). The alignments worker's `perBaseBinBp` rides the RPC call site instead
([PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md)).

`origin` fans out to two tiers: `gpuProps()` (every mode colours by sign main-thread, and
SVG export calls `buildSourceRenderData(data, gpuProps)`) and `renderState`. It is not in
`rpcProps()`, so moving the cut does not refetch.

## Structural args stay out of `rpcProps()`

`rpcProps()` returns **user-controlled settings only**, the cache keys for
`SettingsInvalidate`. Structural args (`adapterConfig`, `sequenceAdapter`, `region(s)`,
`bpPerPx`, `signal`) are spread in at the RPC call site beside `...self.rpcProps()`.
`sessionId` belongs in the first argument only: `RpcManager.call` injects it, and
`AssertNoCallLevelFields` fails a registry entry that declares it.

**Override `adapterConfig` only to change what the adapter *is*, never to annotate it.**
`dataAdapterCache` keys on the config object (`adapterConfigCacheKey`), so a key the
adapter never reads still forks the cache: the decorating display gets its own adapter
instance and file parse, and nothing raises an error. Pass a worker-side value that is
not the adapter's as a sibling RPC arg, the way `sequenceAdapter` is passed.

`rpcProps()` is the **only** extension point for the RPC payload; subclasses capture
`super` and spread. A zoom-derived worker decision is a field of `zoomFetchArgs()`
([zoom-staleness](#per-region-zoom-staleness)), not of `rpcProps`: a threshold crossing
refetches the regions on screen while they keep drawing, where an `rpcProps` move
supersedes the in-flight fetch and scrims the held data.

## The cache key is the return value, not the reads

Every family invalidates on the payload's **value**. `FetchMixin.settingsFetchInputs`
(`display-kit/fetchInputs.ts`) holds the payload and adapter config in one structural
computed that `SettingsInvalidate` watches, each loaded region stamps, and keyed
families fold into `currentFetchKey`.

Building the payload reads far more observables than it returns, so tracking the call
tracks all of them (Canvas builds it from `fullConfSnapshot`, which reads every slot, so
a `showLabels` flip would refetch). The structural computed keeps the previous value
when a recomputation returns equal content. Tests: `installGlobalFetchAutorun.test.ts`,
`fetchInputs.test.ts`.

The compare is structural, not a serialized string: `JSON.stringify` drops an
`undefined`-valued key and flattens a field-less class to `{}`, a **silently dead cache
axis** ([ADR-132](../architecture-decision-records/adr-132-fetch-keys-are-values-compared-structurally.md)).
A live collection mutated in place behind a stamp is the other hazard: `snapshotInputs`
rebuilds and freezes it, so build a fresh class instance rather than mutating one.

## Pick the payload out of the snapshot; never subtract from it

For a display whose `rpcProps()` starts from `fullConfSnapshot`, pick the slots the
worker reads. Canvas's `pickDisplayConfig` copies exactly the keys of its `DisplayConfig`
interface off a `Record<keyof DisplayConfig, true>`, checked exhaustive in both
directions.

The subtractive spelling (snapshot minus an exclusion list) fails silently: a slot nobody
excluded becomes an RPC cache key (`height`, which the resize handle writes every drag
frame, once re-ran the worker pipeline); the leaking names come from another package's
schema, so whoever adds a main-thread slot has no reason to open a display plugin's
`rpcProps()`; and the superset reaches the typed args through an `as DisplayConfig` cast,
the assertion that would have caught the extras.

**A slot in the payload only to invalidate it gets its own field.** A budget edit reaches
the verdict through tracked reads, so a raw gate slot in the payload buys only a
redundant refetch.

## Per-region zoom-staleness

Worker position output is absolute genomic uint32, so coordinates stay valid under zoom.
Staleness under zoom is about zoom-dependent *content*.

No display writes the cache predicate. `MultiRegionDisplayMixin` computes
`isCacheValid(idx)` as `regionHasData(idx)` and the `fetchInputs` stamped on that region
still equalling the current ones: the settings tier (`rpcProps()` and adapter config) and
the zoom tier (`zoomFetchArgs()`). `FetchVisibleRegions` refetches every region that
fails. The loading scrim comes from `staleSettingsDrawn`, which compares the settings
half alone, so it stays down on a zoom.

A display states its zoom rule through two hooks. **`zoomFetchArgs()`** (undeclared by
default) returns the zoom-derived arguments a fetch issued now would send the worker;
`fetchRegions` stamps it beside the region. **`regionHasData(idx)`** answers whether the
stored payload still answers at the view's `bpPerPx`; the default reads the payload's
`zoomRange` where the adapter declared one (`BaseFeatureDataAdapter.getZoomRange`).

Keep them apart. A rule that is no worker input belongs in `regionHasData`; written as a
fetch input it stamps an argument the worker never reads. An input that changes when data
arrives is the `rpcProps()` loop again ([loop trap](#rpcprops-loop-trap-and-how-to-break-it)).

`zoomFetchArgs` is read inside a computed, so it is declared in `.views()`
(`no-restricted-syntax` refuses it as an action). Args that read anything non-observable
are memoized for the display's life, so the first fetch is cached forever; a test knob
behind the args has to be a volatile, not a closure value (`perRegionTestEnv.ts`).

In-tree rules: wiggle and the mark display declare the range on the adapter
(`BigWigAdapter.getZoomRange`, [ADR-125](../architecture-decision-records/adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md));
Canvas's `zoomFetchArgs()` sends the resolved `peptides` and `geneGlyphMode`, reading the
**live** zoom (off the debounced one, a region fetched in the mode the view just left
reads as current and an export in that window draws it); alignments carries `perBaseBinBp`
off the **debounced** `coarseBpPerPx` ([PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md));
the multi-sample variant matrix lays out by feature index across the visible span, so
`regionHasData` compares `cellDataBpPerPx`.

### Export gate, not scrim

`isCacheValid` is a term of `dataCurrent`, the freshness half of `foundationSvgReady`.
Without it, an export inside the `FetchVisibleRegions` throttle draws the previous zoom's
bins, columns or amino acids. `displayPhase` does not read `dataCurrent`
(`MultiRegionDisplayMixin` hands `foundationDisplayPhase` a `viewportWithinLoadedData`
thunk): folding staleness into the phase raises the scrim into every zoom, which we
declined. The term cannot latch, because `planRegionFetch` refetches a block on
`!(isBlockCovered && isCacheValid)`.

### A coarse tier is a second store with its own span

`CoarseTierMixin` (MAF summary rows, density-band bins) keeps payloads in `coarseTier`
beside `loadedRegions`, and `coarseTierCovers` decides whether a viewport is still
answered; `regionHasData`, `isCacheValid` and `zoomFetchArgs` stay the detail store's. The
tier cannot share `loadedRegions`: a narrow detail fetch stamped over the wide summary
narrows its span, and a `summary`/`detail` zoom input reads every zoom-out as stale.

`dataSuperseded` (default false) is true when a settled fetch-input change is about to
invalidate what is held, the last term of `dataCurrent`; `awaitSvgReady` samples freshness
once, so without it an export renders data about to be discarded. **It fails hung, not
stale**: a supersession that latches true never lets `dataCurrent` go true, so an override
states only the live-vs-settled half, as a value compare.

## `gpuProps()` and derived region maps — re-upload without refetch

`gpuProps()` exists wherever the main thread encodes the GPU buffer (wiggle, MAF,
GC-content); HiC (`self.colorRamp`) and multi-LGV synteny (`computedColors`) fill the
same role without the method. Canvas's worker emits a color *class* per themed lane and
the main-thread encode resolves classes against `session.palette`, so a theme change
re-encodes.

**Opacity is a render parameter, never a packed color.** Synteny multiplies it in
`fillShade`, dotplot in `dotplot.slang`'s fragment, fed from render state with a Canvas2D
twin so SVG export matches. Baking it into every packed ABGR byte turns one drag frame
into three O(n) passes for a value identical on every instance. The color-lane patch that
spares a genuine recolor a full re-pack is a backend concern:
[GPU_DISPLAY_LIFECYCLE.md § Upload patterns](GPU_DISPLAY_LIFECYCLE.md#upload-patterns).

Use a derived region map when settings change the shape of per-region data, and
`gpuProps()` for scalars fed to an encoder. The raw `rpcDataMap` is never mutated, which
fixes its representation: build it with
[`regionDataMap()`](../../packages/render-core/src/regionDataMap.ts), a **shallow**
`observable.map` ([ADR-060](../architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
A hand-written `observable.map<number, …>()` is the thing to notice in review.

**A derived map is a tier, so keep its cheap half out of its expensive half.** Alignments
splits `laidOutByGroupUncolored` (place rows), `laidOutByGroupFramed` (chain strand
frames) and `laidOutByGroup` (per-read colors). Folding color into the layout computed
would make a recolor re-run placement. Split, `readYs` keeps its identity, which the GPU
renderer reads as "same layout run" and rewrites the read pass alone (GPU_DISPLAY_LIFECYCLE.md,
"Whole-map synced: skipping a region without leaving stale buffers").

## Theme-derived render inputs are session getters, not pushed volatiles

A palette is a pure function of the active theme, so derive it in a model getter,
`<plugin builder>(getPaletteHost(self).palette)`, that `gpuProps()` / `renderState` read
directly. Do **not** push it into a volatile from a React `useEffect` via
`setColorPalette`: the effect runs only on mount, so SVG export and RPC, which have no
component, see a null palette and render blank. A drawing autorun follows the same rule.

**Read `session.palette`, not `session.theme`.** `palette` (`JBrowsePalette`) is plain
serializable color strings that cross the RPC boundary and work headless; `theme` is the
MUI `Theme`. SVG export overrides the palette via `resolvePalette({ configTheme:
opts?.theme })`; no display sends a theme to the worker.

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

Both families key on the *returned* payload, so the loop needs a fetch-derived value to
reach the **return**; one merely consulted while building cannot loop (why HiC's
`activeNormalization` is safe). Per-region, `makeSettingsLoopGuard`'s within-tick counter
catches the synchronous freeze; the global family loops at async-fetch cadence, which no
within-tick counter can tell from fast interaction.

## Row order is not a fetch input

Row-stacking displays keep the *order* rows are drawn in out of the RPC: wiggle places
rows from `gpuProps().sources`, MAF (`placeMafRegionData`) and multi-sample variant
(`placeVariantRows`) place by name from a sorted row set.

**A fetch argument may name the row *set*, never the row order.** The set is real work,
while the order is a permutation the main thread applies for free. Sort the set: unsorted,
it puts the order back in through the cache key, which compares arrays in order.

- **Name the rows in the payload** (`rowNames` / `sampleId`) and place by name. A row the
  display is not drawing must not fall back to row 0; variants sends it to a `HIDDEN_ROW`
  sentinel that every painter's Y-cull discards, MAF drops it.
- **Placement must not disturb an ordering something else depends on.** The variant cell
  arrays are sorted by `(featureIndex, rowIndex)` in the worker's numbering and the hit
  test binary-searches that, so placement writes a second array.

## The fetch skeleton: one latest-wins machine, one phase contract

**begin → clear the error → run → commit if still current → `handleFetchError` → end.**
`runFetchOnce` (`@jbrowse/core/util/installFetch`) is that sequence; `installFetch` adds
the autorun over it: the abort rotation, the leading edge, the unconditional
`reloadCounter` read, the durable cancel gate, and the dev-only contract checks
(`assertDisplayContract`, `makeRetryContractCheck`). Copies of the sequence each missed a
different rule, so a fetch gets it from here.

Map: `FetchMixin.runFetch` holds `runFetchOnce` for the per-region family (it needs the
MST flow); keyed families lend `FetchMixin`'s rotation through the `rotation` option;
`createAbortRotation` owns latest-wins abort and the supersede-vs-end status rule
(ADR-080); `FetchPhases` (`@jbrowse/core/util/fetchPhases`) is the `prepare`/`run`/`commit`
contract for the global and comparative families (per-region is deliberately not this
shape, see `RegionFetchContext`); `handleFetchError` swallows an abort and any failure of
a fetch no longer current.

**Liveness is checked above the `gate`, not only above `prepare`.** Teardown mutates the
observables the body reads before the disposers run, and nearly every gate reaches the
containing view through a parent walk that throws once the node has left the tree. The
per-region family reaches its gates through `autorunOnReadyView`, so the check sits
there. A rule the skeleton grows next owes the same two lines there. We declined
declaring the per-region trigger over `installFetch`, and a shared preamble helper for
the two hand-rolled bodies (it would return three values for the second caller to use one
of). `installFetch.test.ts` and `installPerRegionFetchAutoruns.test.ts` keep both honest.

### `untracked` names its ground, and a perf guard is not one

A body may read untracked three kinds of thing:

- **Self-write.** What its own effect writes: the viewport-change clear reads `error` /
  `fetchCanceled` because it clears them, and tracking them would re-fire it off
  `setError` and wipe the flag.
- **Effect input.** A read no decision branches on that only the launched work consumes:
  the axes behind dotplot's tracked `fetchKey`.
- **Instrumentation.** A dev-only check, so the production dependency set is not a
  development one.

The test: **does the decision branch on it?** If so it is tracked, whatever the idle-run
cost. `no-restricted-syntax` fails a bare `untracked(` and each site names its ground on
the disable line. A perf guess is not a ground: we measured the per-region autorun's
`isLoading` / `loadedRegions` reads and tracked them, costing at most one idle run of the
pure plan.

Per-region subclasses override `fetchNeeded` to call a fan-out helper
(`fetchEachRegion`, `fetchAllRegions`, `fetchRegionsBatched`). Variants return one batched
payload, so `fetchNeeded` ignores `needed` and derives its set (`fetchRegionsForMode`);
matrix mode takes `visibleRegions` only, because a buffered feature would draw a connector
to an off-screen position.

### Which reads the per-region autorun tracks

`planRegionFetch` decides as a pure value; `installPerRegionFetchAutoruns` owns which
reads MobX tracks. **The dependency set is itself a value**: every installer builds its
reaction through `namedAutorun` (`@jbrowse/render-core/namedReactions`), and a bare
`autorun` beside an `addDisposer` would opt out of the tests and nothing would fail.
`reactionDependencies(node, name)` returns the leaf names subscribed on the last run, and
the "dependency set is the contract" blocks in `installPerRegionFetchAutoruns.test.ts` and
`RenderLifecycleMixin.test.ts` pin the list per state.

### Every fetch autorun runs on the leading edge

Every installer schedules through `leadingEdgeAutorun`. MobX's `autorun(fn, { delay })`
is trailing-edge only, schedules even the first run through `setTimeout`, and put the
whole delay on first paint.

- **The body reports whether it started work, and only that arms the debounce.** A run
  that bails on a guard returns nothing and stays on the leading edge.
- **The leading edge is one microtask, not the install call.** A model is routinely built
  and configured in one synchronous block; a fetch issued between the two lines is
  invalidated by the setting that follows. A change after an `await` is a later decision
  and correctly costs a refetch.

**Install order does not matter, because of the microtask.** With the first run at the
install call, autoruns installed before `FetchVisibleRegions` called `clearAllRpcData`
and reissued a fetch with identical arguments: a duplicate RPC per track, visible only to
a call count. A new installer owes its first run to a microtask.

**A fast fetch exposes couplings that a slow one hid.** Over the LGV's empty initial
coarse-block list, wiggle's autoscale domain yields the fallback `[0,1]`, not a stale one,
and a bigwig line track drew blank. `settledDynamicBlocks` holds the rule: coarse blocks
once the view has settled once, live ones before.

### The global-fetch trigger list must be read unconditionally

`installFetch` reads `reloadCounter` and `fetchCanceled` unconditionally at the top of
its body, above every gate, and that ordering is load-bearing. MobX rebuilds the
dependency set on every run, so a read inside the gate drops out on any run that
declines and can never wake the autorun again. The deleted arc display exposed it: with
`reloadCounter` under the gate, `reload()` was silently dead.

**`prepare` returning `undefined` is the display's gate.** It runs synchronously in the
autorun body, so whatever it read to decline stays in the dependency set. The skeleton's
`gate` already declines while `view.initialized` is false. A `prepare` must not move a
trigger read of its own under a bail-out.

The general rule: **a gated trigger read is safe only if the gate is itself an
observable that flips on the transition you want to wake up on.** `if (self.isMinimized)
return` above the tracked deps is fine; a pure signal like `reloadCounter`, which no gate
consults, is the dangerous case. `installGlobalFetchAutorun.test.ts` and
`installPerRegionFetchAutoruns.test.ts` assert `reloadCounter`, `fetchCanceled` and
`alive` stay visible in the declining states.

**A gate on committed state is `installFetch`'s `fetchKey`, not a compare in `prepare`.**
The skeleton stamps the key at commit and declines on it, and a run whose `reloadCounter`
advanced since the last issued fetch ignores it. Only one decline can strand a display:
`prepare` returning `undefined` is "nothing to fetch", which no retry should change, while
the key gate is "I have exactly this", which a retry must override. The stamp must be
observable (the skeleton's `observable.box`, or the host's `loadedFetchKey`), because a
commit landing after the inputs moved back must wake the declined run. A secondary fetch
passes no `contract` and installs no `makeRetryContractCheck` (one ledger per node);
multi-way synteny's dependent fetches once shipped a dead Retry from a hand-compared key
in `prepare`. Pinned in `installFetch.test.ts`.

**The per-region twin: a `fetchNeeded` that declines to fetch must be woken by something
`FetchVisibleRegions` already tracks.** That autorun tests `isBlockCovered(...) &&
isCacheValid(...)`, and `&&` short-circuits, so an uncovered block registers no
`isCacheValid` dependency. It is safe because an uncovered block always reaches
`fetchNeeded` and a fetch bumps `fetchGeneration`. An override returning early without
fetching must supply its own wake path: sequence's `zoomedOut` moves with `bpPerPx`;
multi-sample variant's `!sourcesBase` refetches through `SettingsInvalidate` because
`rpcProps().sampleFilter` goes from `undefined` to a list when sources arrive, which is
why `sampleFilter` spells the unfiltered case out in full.

Every fetch carries a pure signal, read unconditionally and pinned by its installer's
test (the comparative family reads `reloadCounter` above its `prepare()` bail-outs).

| family | installer | the pure signal | a user cancel lapses on |
| --- | --- | --- | --- |
| per-region | `installPerRegionFetchAutoruns` | `fetchGeneration` | a viewport change, or Retry |
| global | `installGlobalFetchAutorun` | `reloadCounter` | a viewport change, or Retry |
| comparative | `installComparativeFetchAutorun` | `reloadCounter` | Retry |
| everything else | `installFetch` | `reloadCounter` | Retry, where the host has a cancel |

A fifth skeleton with a gate needs a signal the gate never consults, read above the gate,
and a test that fails when the read is deleted.

`installPrerequisiteFetch` (`@jbrowse/core/util`) serves the one-RPC prerequisite reads
(HiC header, sample list, synteny LOD header, mark source list); a display reads the
answer through `readFor`, which compares by value, since an undo rebuilds a config into an
equal but new object.

**A cancel is durable.** No fetch trigger un-cancels it: the skeleton reads
`fetchCanceled` tracked, under the counter and above every gate. Only Retry and, on the
LGV families, the viewport moving reopen it. The comparative family has the gate but not
the lapse, because its viewport is its fetch input, so a viewport clear there would
un-cancel on every trigger. **`reloadCounter` lives on `FetchMixin`**; chord and the
breakpoint view declare their own because neither composes it.
