---
name: fetch-keys
description: What keys a fetch, when does a zoom refetch, and how does a fetch run? The `rpcProps()` / `gpuProps()` / `renderState` tiers, cache-key and payload rules, zoom staleness, derived region maps, the loop trap, and the latest-wins fetch skeleton.
kind: spec
---

# Fetch keys, zoom staleness and the fetch skeleton

The three tiers are stated in [ARCHITECTURE.md](../ARCHITECTURE.md#rpcprops--gpuprops-pattern); this doc is the argument behind each rule there. It covers what invalidates a fetch, an upload and a frame, how a per-region display decides its cached data is stale under zoom, and the one machine every fetch runs on.

## What each tier costs when it moves, and who is zoom-sensitive

| tier | a change does | cost |
| --- | --- | --- |
| `rpcProps()` | `settingsFetchInputs` moves, every loaded region's `fetchInputs` stamp goes stale, `SettingsInvalidate` runs `invalidateSettings()` | refetch every region, drawn stale under the scrim meanwhile |
| `gpuProps()` | the identity `installUpload` compares moves (`p !== lastProps` clears `encodedFrom` in `createEncodeMemo`, `packages/render-core/src/encodeMemo.ts`) | **re-encode every cached region, main thread, no RPC** |
| `renderState` | the render callback re-fires | repaint |

The middle row surprises because it is O(cached regions x features) of main-thread work with nothing on the network to show it. [ADR-016](../architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md) measured that cost; the accounting applies to anything that lands in `gpuProps()`.

**A per-frame viewport value must never reach `gpuProps()`.** It re-encodes the whole cache mid-gesture, and the profile blames the encoder rather than the key that let it in. No `gpuProps()` reads live `bpPerPx`, `offsetPx`, `visibleRegions`, `dynamicBlocks` or hover. The one deliberate zoom-sensitive exception is `LinearMafDisplay`'s `binBp`, which reads `encodeBinBp`: `subPixelBinBp` (`packages/display-kit/src/subPixelBinBp.ts`) off the **debounced** `coarseBpPerPx`, quantized to a power of two so a gesture does not thrash it. The alignments worker's `perBaseBinBp` rides the RPC call site instead ([PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md)).

- **`origin` fans out to two tiers.** `gpuProps()` uses it (every mode colours by sign main-thread, and SVG export calls `buildSourceRenderData(data, gpuProps)`), and `renderState` uses it (bar pivot, density fade). It left `rpcProps()` with the worker-side split, so moving the cut no longer refetches.
- **Most `installUpload` call sites pass neither `inputs` nor `encode`.** That is the typed no-`encode` overload: `cells()` already yields encoded data built by an upstream `computed` (`LinearSyntenyDisplay.computedColors`, `DotplotDisplay.computedColors`), so MobX's map diff limits the re-encode instead of `installUpload`'s clear.

## Structural args stay out of `rpcProps()`

`rpcProps()` returns **user-controlled settings only**, the cache keys for `SettingsInvalidate`. Structural args (`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `signal`) are spread in at the RPC call site:

```ts
rpcManager.call(sessionId, 'RenderXxxData', {
  adapterConfig: self.adapterConfig,
  regions, bpPerPx,
  ...self.rpcProps(),
  signal, statusCallback,
})
```

`sessionId` belongs in the first argument only: `RpcManager.call` injects it, and `AssertNoCallLevelFields` fails a registry entry that declares it.

`adapterConfig` comes from `BaseDisplayModel` and rides beside the payload in `FetchMixin.settingsFetchInputs`, so a track re-pointed in the config editor refetches.

**Override `adapterConfig` only to change what the adapter *is*, never to annotate it.** `dataAdapterCache` keys on the config object (`adapterConfigCacheKey`), so a key the adapter never reads still forks the cache: the decorating display gets its own adapter instance and file parse, every plain reader of the track shares a second, and nothing raises an error. Pass a worker-side value that is not the adapter's as a sibling RPC arg, the way `sequenceAdapter` is passed.

`rpcProps()` is the **only** extension point for the RPC payload. Each display defines its own typed shape; subclasses capture `super` and spread:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      return { ...superRpcProps(), showOnlyGenes: self.showOnlyGenes }
    },
  }
})
```

A zoom-derived worker decision is a field of the display's `zoomFetchArgs()` ([Per-region zoom-staleness](#per-region-zoom-staleness)), not of `rpcProps`: a threshold crossing refetches the regions on screen while they keep drawing, where an `rpcProps` move runs `SettingsInvalidate`, supersedes the in-flight fetch and scrims the held data.

`MultiRegionDisplayMixin` provides no base `rpcProps` default, because one would widen the typed return through MST's `.views()` chain. Its `SettingsInvalidate` autorun looks `rpcProps` up dynamically and installs only when the method exists, so a display with no settings-driven refetch simply omits it.

## The cache key is the return value, not the reads

Every family invalidates on the payload's **value**, never on the raw call. `FetchMixin.settingsFetchInputs` (`display-kit/fetchInputs.ts`) holds the payload and the adapter config in one structural computed: `SettingsInvalidate` watches it, each loaded region stamps it, keyed families fold it into `currentFetchKey`, and the byte gate measures under it.

Building the payload reads far more observables than it returns, so tracking the call tracks all of them. Canvas builds it from `fullConfSnapshot`, which reads every slot on the display config and its inherited schemas, so a `showLabels` flip would refetch. HiC's `activeNormalization` consults the **fetched** `availableNormalizations`. The structural computed keeps the previous value when a recomputation returns equal content, so only a change in what is returned invalidates. Tests: `installGlobalFetchAutorun.test.ts`, `fetchInputs.test.ts`.

The compare is structural rather than a serialized string, because `JSON.stringify` drops an `undefined`-valued key and flattens a field-less class to `{}`, which makes a **silently dead cache axis**. `compareStructural` counts keys and compares own fields ([ADR-132](../architecture-decision-records/adr-132-fetch-keys-are-values-compared-structurally.md)). A value stamp has its own hazard, a live collection mutated in place behind it: `snapshotInputs` rebuilds and freezes it, so build a fresh class instance rather than mutating one.

## Pick the payload out of the snapshot; never subtract from it

For a display whose `rpcProps()` starts from `fullConfSnapshot`, the snapshot carries every slot its schema and every inherited schema declare. Pick the slots the worker reads. Canvas's `pickDisplayConfig` copies exactly the keys of its `DisplayConfig` interface off a `Record<keyof DisplayConfig, true>`, which TypeScript checks exhaustive in both directions, so the list cannot drift from the interface the worker reads.

Avoid the subtractive spelling (snapshot minus a destructured exclusion list). It fails silently:

- **A slot nobody excluded becomes an RPC cache key.** The expensive one was `height`: the resize handle writes it every drag frame, so dragging a track taller re-ran the worker pipeline.
- **The leaking names come from another package's schema.** `BaseLinearDisplay`'s schema contributes most, so whoever adds a main-thread slot there has no reason to open a display plugin's `rpcProps()`.
- **The payload type is a lie.** Snapshot-minus-exclusions is a superset of the worker's interface, so it reaches the typed args through an `as DisplayConfig` cast, the assertion that would have caught the extras.

Picking inverts all three: a new worker slot edits the interface and the key list together, and forgetting breaks the feature visibly; a new main-thread slot edits neither.

**A slot in the payload only to invalidate it gets its own field.** A budget edit reaches the verdict through tracked reads, so a raw gate slot in the payload buys only a redundant refetch.

## Per-region zoom-staleness

Worker position output is absolute genomic uint32, so coordinates stay valid under zoom. Staleness under zoom is about zoom-dependent *content*.

No display writes the cache predicate. `MultiRegionDisplayMixin` computes `isCacheValid(idx)` as `regionHasData(idx)` and the `fetchInputs` stamped on that region still equalling the current ones: the settings tier (`rpcProps()` and the adapter config) and the zoom tier (`zoomFetchArgs()`). `FetchVisibleRegions` refetches every region that fails. The loading scrim comes from `staleSettingsDrawn`, which compares the settings half alone, so it stays down on a zoom.

A display states its zoom rule through two hooks that answer different questions:

- **`zoomFetchArgs()`** (undeclared by default) returns the zoom-derived arguments a fetch issued now would send the worker, as the object the display spreads into its RPC. `fetchRegions` reads it before the RPC goes out and stamps it beside the region. A display whose worker reads no zoom leaves it undeclared.
- **`regionHasData(idx)`** answers whether the stored payload still answers at the view's `bpPerPx`. The default reads the store and the payload's `zoomRange` where the adapter declared one (`BaseFeatureDataAdapter.getZoomRange`); a payload with no range answers at every zoom.

Keep them apart. A rule that is no worker input belongs in `regionHasData`; written as a fetch input it stamps an argument the worker never reads. An input that changes when data arrives is the `rpcProps()` loop again ([loop trap](#rpcprops-loop-trap-and-how-to-break-it)).

`zoomFetchArgs` is read inside a computed. Its observables join `FetchVisibleRegions`' dependency set, which is why it is declared in `.views()` (`no-restricted-syntax` refuses it as an action). Args that read anything non-observable are memoized for the display's life, so the first fetch is cached forever; a test knob behind the args has to be a volatile, not a closure value (`perRegionTestEnv.ts`).

### The in-tree zoom rules

**Wiggle and the mark display: the adapter declares the range.** `BigWigAdapter.getZoomRange` answers the bp/px interval its tier pick serves, the RPC writes it on the payload as `zoomRange`, and the displays leave `zoomFetchArgs` alone. A zoom inside the tier refetches nothing; one across it refetches every visible region together. [ADR-125](../architecture-decision-records/adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md).

**Canvas** (`LinearBasicDisplay`): `zoomFetchArgs()` sends the two zoom-driven worker decisions resolved, `peptides` and `geneGlyphMode` (plus `expandedGeneIds` under `longestCoding`), rather than the zoom behind them, so every other zoom change reuses cached features. Both thresholds read the **live** zoom: off the debounced one, a region fetched in the mode the view just left reads as current for the debounce, and an export in that window draws it. `laidOutDataMap` packs rows off `coarseBpPerPx` so packing does not rerun every frame.

**Multi-sample variant matrix**: columns lay out by feature index across exactly the visible span the fetch asked for, so the payload answers only the zoom it was fetched at. The RPC sends no zoom, so this is a `regionHasData` answer over `cellDataBpPerPx`. The regular variant display draws at genomic positions and records none.

**Alignments** (`LinearAlignmentsDisplay`): `zoomFetchArgs()` carries `perBaseBinBp`, resolved off the **debounced** `coarseBpPerPx`, and the RPC spreads the same object. [PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md) owns why the live zoom is wrong there.

**Presence-only answers.** `LinearBasicDisplay` takes the mixin's `regionHasData`. `LinearMultiRowFeatureDisplay` returns `regionHasPinnedData`, which asks for a payload whose partition field matches the pin.

### Export gate, not scrim

`isCacheValid` is a term of `dataCurrent`, the freshness half of `foundationSvgReady`. Spatial coverage alone cannot see a zoom that moved `fetchInputs`, so without the term an export inside the `FetchVisibleRegions` throttle draws the previous zoom's bins, columns or amino acids. A coarse tier answers the gate for itself while it stands in (`coarseTierSvgReady`).

`displayPhase` does not read `dataCurrent`: `MultiRegionDisplayMixin` hands `foundationDisplayPhase` a `viewportWithinLoadedData` thunk instead. Folding staleness into the phase raises the scrim into every zoom, which we declined.

The term cannot latch. `planRegionFetch` refetches a block on `!(isBlockCovered && isCacheValid)`, so the input move that closes the export gate is the same tracked read that wakes the refetch reopening it.

### A coarse tier is a second store with its own span

MAF's summary rows and the density band's sidecar bins are `CoarseTierMixin`: the tier's payloads live in `coarseTier` beside `loadedRegions`, its read records the buffered span and key it covered (`coarseTierRead`), and `coarseTierCovers` decides whether a viewport is still answered. The detail fetch is suspended while the tier stands in, so `regionHasData`, `isCacheValid` and `zoomFetchArgs` stay the detail store's.

The tier cannot share the foundation's `loadedRegions` entry: a narrow detail fetch stamped over the wide summary read narrows its span, and zooming back out re-reads the byte-gated summary adapter. A `summary`/`detail` zoom input is worse, since every zoom-out reads as stale. `CoarseTierMixin.test.ts` and `LinearMafDisplay/summaryTierSwap.test.ts` pin both.

### `dataSuperseded`

`dataSuperseded` (default false) is an export-readiness question, not a cache one: true when a settled fetch-input change is about to invalidate what is held. It is the last term of `dataCurrent`. The window is invisible on screen, since the clear lands a tick later under the scrim, but `awaitSvgReady` samples freshness once, so an export inside it renders data about to be discarded. `GlobalFetchMixin` declares the same hook over its signature compare, so a display with a dependent fetch (multi-way synteny's lane genes) holds the export without re-running its primary fetch.

Every in-tree override is a display invalidating its own load:

- **GWAS Manhattan**: adopting the top hit as the LD index SNP is an `rpcProps` write, invalidating the load that produced the hit.
- **Alignments**: `perBaseBinBp !== livePerBaseBinBp`, covering the `coarseBpPerPx` debounce, before the settled bin moves and the stamp compare takes over.

**It fails hung, not stale.** A supersession that latches true never lets `dataCurrent` go true, and every export waits out `awaitSvgReady`'s backstop. An override states only the live-vs-settled half, as a value compare, and leaves the stamp compare to the foundation.

## `gpuProps()` and derived region maps — re-upload without refetch

`gpuProps()` exists wherever the main thread encodes the GPU buffer: wiggle, MAF and GC-content. HiC (`self.colorRamp` in render state) and multi-LGV synteny (`computedColors`) fill the same role without the method. Canvas's worker emits a color *class* per themed lane and the main-thread encode resolves classes against `session.palette`, so a theme change re-encodes. A wiggle `color` or `origin` change re-encodes and refetches nothing, while `resolution` and `scoreField` change what the worker returns and refetch.

**Opacity is a render parameter, never a packed color.** Synteny multiplies it in `fillShade`, dotplot in `dotplot.slang`'s fragment, each fed from render state with a Canvas2D twin so SVG export matches. Baking it into every packed ABGR byte turns one drag frame into three O(n) passes (recompute, re-pack, re-upload) for a value identical on every instance. A per-instance array is the wrong home for a scalar that multiplies every element. The color-lane patch that spares a genuine recolor a full re-pack is a backend concern: [GPU_DISPLAY_LIFECYCLE.md § Upload patterns](GPU_DISPLAY_LIFECYCLE.md#upload-patterns).

Use a derived region map when settings change the shape of per-region data, and `gpuProps()` for scalars fed to an encoder. Alignments' `laidOutByGroup` returns per group shallow clones of `rpcDataMap` entries with freshly allocated Y arrays from main-thread layout; `sourceSections` pairs each with its arc feed for the upload callback. The raw `rpcDataMap` is never mutated.

That immutability fixes its representation: build it with [`regionDataMap()`](../../packages/render-core/src/regionDataMap.ts), a **shallow** `observable.map`, since an entry that never changes gives MobX's deep enhancer nothing to observe ([ADR-060](../architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)). A hand-written `observable.map<number, …>()` is the thing to notice in review.

**A derived map is a tier, so keep its cheap half out of its expensive half.** Alignments splits it in three: `laidOutByGroupUncolored` places rows, `laidOutByGroupFramed` applies chain strand frames, `laidOutByGroup` bakes per-read colors. Folding color settings into the layout computed would make a recolor re-run placement and every Y remap. Split, the layout stays memoized across a recolor, and because the overlay spreads its input, `readYs` keeps its identity: the GPU renderer reads that as "same layout run" and rewrites the read pass alone (GPU_DISPLAY_LIFECYCLE.md, "Whole-map synced: skipping a region without leaving stale buffers"). The same applies to any value a derived map reads but only sometimes spends; the band-overhead input to the grouped fit budget is a thunk for that reason.

## Theme-derived render inputs are session getters, not pushed volatiles

A palette is a pure function of the active theme, so derive it in a model getter, `<plugin builder>(getPaletteHost(self).palette)`, that `gpuProps()` / `renderState` read directly. Do **not** push it into a volatile from a React `useEffect` via `setColorPalette`: the effect runs only on mount, so SVG export and RPC, which have no component, see a null palette and render blank. A getter is always present and MobX recomputes it only on a theme change. A drawing autorun follows the same rule (tree-sidebar's `treeStroke` / `treeHoverColors`).

**Read `session.palette`, not `session.theme`.** Both resolve from one `resolvePalette` call, but `palette` (`JBrowsePalette`) is plain serializable color strings that cross the RPC boundary and work headless, while `theme` is the MUI `Theme` for MUI components. SVG export overrides the palette with the export theme via `resolvePalette({ configTheme: opts?.theme })`; no display sends a theme to the worker.

## `rpcProps()` loop trap and how to break it

A fetch-result derivative in `rpcProps()` loops forever:

```
setCellData → <derived value> changes → rpcProps() changes
  → SettingsInvalidate → invalidateSettings → clearSettingsBakedData → cellData cleared
  → <derived value> changes → rpcProps() changes → …
```

**Rule:** `rpcProps()` contains only user-controlled settings. Never include `cellData`, `samplePloidy` or any getter that reads them. Split the computation: `rpcProps()` gets a cache-key version from user inputs only, and the part needing fetch-result data stays in a separate view used for rendering. In the variant case, `rpcProps().sampleFilter` reads `sourcesBase` (samples narrowed to the focus before haplotype expansion, which needs `samplePloidy`); the client's `sources` view reads `samplePloidy` for rendering only, and the worker expands haplotype rows itself.

Both families key on the *returned* payload, so the loop needs a fetch-derived value to reach the **return**; one merely consulted while building cannot loop (why HiC's `activeNormalization` is safe). Per-region, the loop is a synchronous freeze caught by `makeSettingsLoopGuard`'s within-tick counter. The global family's `installGlobalFetchAutorun` reads the key and fetches in one debounced body, so it loops at async-fetch cadence, which no within-tick counter can tell from fast interaction. `packages/display-kit/CLAUDE.md` lists the overridable hooks and tests.

## Row order is not a fetch input

The row-stacking displays keep the *order* rows are drawn in out of the RPC:

| display | what crosses | who assigns the row |
| --- | --- | --- |
| wiggle | the full canonical `sources` list, as a **structural** arg (absent from `rpcProps()`) | the main-thread encoder, from `gpuProps().sources` |
| MAF | the focus (`rows.kept`, sorted) only | `placeMafRegionData`, keyed on species name, re-run by the `rpcDataMap` memo |
| multi-sample variant | `sampleFilter` (sorted sample names) | `placeVariantRows`, keyed on `rowNames`, re-run by the derived region map |

**A fetch argument may name the row *set*, never the row order.** The set is real work, since a focused clade is a fraction of the data, while the order is a permutation the main thread applies for free. Sort the set: unsorted, it puts the order back in through the cache key, which compares arrays in order. Drag-reorder, "Group by", clustering and genotype sort are then re-uploads of bytes in hand, and no payload is numbered against a row list the display is not drawing.

- **Name the rows in the payload** (`rowNames` / `sampleId`) and place by name. A row the display is not drawing must not fall back to row 0; variants sends it to a `HIDDEN_ROW` sentinel that every painter's Y-cull discards, MAF drops it.
- **Placement must not disturb an ordering something else depends on.** The variant cell arrays are sorted by `(featureIndex, rowIndex)` in the worker's numbering and the hit test binary-searches that, so placement writes a second array and leaves the sorted one alone.

## The fetch skeleton: one latest-wins machine, one phase contract

**begin → clear the error → run → commit if still current → `handleFetchError` → end.** `runFetchOnce` (`@jbrowse/core/util/installFetch`) is that sequence; `installFetch` is that plus the autorun over it: the abort rotation, the leading edge, the unconditional `reloadCounter` read, the durable cancel gate, and the dev-only contract checks (`assertDisplayContract`, `makeRetryContractCheck`). Copies of the sequence each missed a different rule, so a fetch gets it from here rather than spelling it.

| what | where | who runs on it |
| --- | --- | --- |
| the sequence plus the autorun | `installFetch` / `runFetchOnce` | every fetch. `FetchMixin.runFetch` holds `runFetchOnce` for the per-region family (it needs the MST flow); the keyed families lend `FetchMixin`'s rotation through the `rotation` option so `cancelFetch` and the Cancel button reach the fetch; chord, the breakpoint overlay and the prerequisite reads take the installer |
| latest-wins abort rotation, the `isCurrent` guard, the supersede-vs-end status rule (ADR-080) | `createAbortRotation` | all of them, through the skeleton |
| the `prepare` / `run` / `commit` contract | `FetchPhases` (`@jbrowse/core/util/fetchPhases`) | the global and comparative families; per-region is deliberately not this shape (see `RegionFetchContext`) |
| the leading-edge scheduler | `leadingEdgeAutorun` | every installer, plus the dotplot view's region autorun |
| the fetch-error rule: an abort, and any failure of a fetch no longer current, is swallowed; only a current fetch's real failure is logged and published | `handleFetchError` (`@jbrowse/core/util`) | `runFetchOnce`, so all of them |

`fetchMixinLifecycle` holds `FetchMixin`'s begin/end/error writes for the two entries that run a fetch over it (`runFetch` and the global family's declaration, which lends its rotation).

**Liveness is checked above the `gate`, not only above `prepare`.** Teardown mutates the observables the body reads before the disposers run, and nearly every gate reaches the containing view or track through a parent walk that throws once the node has left the tree. The rule is ported, not shared: the per-region family reaches its gates through `autorunOnReadyView`, so the check sits there, which also covers the other autoruns that family installs. A rule the skeleton grows next owes the same two lines there. We declined declaring the per-region trigger over `installFetch`.

We also declined a shared preamble helper (counter read, cancel read, liveness skip) for the two hand-rolled bodies. The skeleton stamps the counter as the epoch and gates on the cancel; the per-region body voids the counter and hands the cancel to `planRegionFetch`. A preamble would return three values for the second caller to use one of. Pins keep both honest: `installFetch.test.ts` re-runs a body that declined, and `installPerRegionFetchAutoruns.test.ts` asserts the whole dependency set per state.

What differs per site is the parameter list: the trigger list (`prepare` plus `gate`), the commit shape (one payload vs N streaming regions), where the loading flag and status live, and the context `run` receives. A family wanting a richer context wraps its own `run` rather than the skeleton growing an option, as the comparative family does for `adapterConfig` / `rename` / `assemblyManager`.

### `untracked` names its ground, and a perf guard is not one

A body may read untracked three kinds of thing:

- **Self-write.** What its own effect writes: the viewport-change clear reads `error` / `fetchCanceled` because it clears them, and tracking them would re-fire it off `setError` and wipe the flag.
- **Effect input.** A read no decision branches on that only the launched work consumes: the axes behind dotplot's tracked `fetchKey`, which the worker culls with. Tracked, every pan would refetch.
- **Instrumentation.** A dev-only check, so the production dependency set is not a development one.

The test that sorts a read: **does the decision branch on it?** If so it is tracked, whatever the idle-run cost. `no-restricted-syntax` fails a bare `untracked(` and each site names its ground on the disable line. A perf guess is not a ground: we measured the per-region autorun's `isLoading` / `loadedRegions` reads and tracked them instead, costing at most one idle run of the pure plan with no loop. The structural spelling of the self-write case is to read a signal the write does not move, which is why the body never needed `isLoading`.

`RegionTooLargeMixin`'s `ClearGateMeasurementsOnNavOrTierSwap` autorun drops the byte estimate on navigation and tier swap, since a stale estimate would quote the previous chromosome's numbers at the new region. `clearAllRpcData` leaves it alone so an ordinary clear does not flicker the banner ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) § How the verdict is built).

Per-region subclasses override `fetchNeeded` to call a fan-out helper (`fetchEachRegion`, `fetchAllRegions`, `fetchRegionsBatched`). A gated display passes `byteLimit: self.resolvedByteLimit()`; the worker measures index bytes first and answers a `RegionTooLargeResult` when over, which the helper commits through `commitFetchBytes`. A blocked display keeps running that fetch once per settled viewport, because the measurement is what releases the banner.

Variants are the exception to per-region granularity: `MultiSampleVariantGetCellData` returns one batched payload, so variants' `fetchNeeded` ignores `needed` and derives its set (`fetchRegionsForMode`). Regular mode takes `bufferedVisibleRegions`; matrix mode takes `visibleRegions` only, because its columns lay out by feature index across the visible width and a buffered feature would draw a connector to an off-screen position.

### Which reads the per-region autorun tracks

`planRegionFetch` decides as a pure value: fetch this region set, raise this assembly mismatch, or do nothing for this reason. `installPerRegionFetchAutoruns` owns what no pure function can state: which reads MobX tracks and which sit behind a thunk so an early-bailing run does not subscribe to the viewport. Two test files, one per half, plus `fetchRegions.test.ts` for commit ordering. A test that transcribes an autorun stays green when the autorun's behavior is deleted; the split guards against that.

**The dependency set is itself a value.** Every installer builds its reaction through `namedAutorun` (`@jbrowse/render-core/namedReactions`), which records it against the node; a bare `autorun` beside an `addDisposer` would opt out of the tests and nothing would fail. `reactionDependencies(node, name)` returns the sorted leaf names the reaction subscribed to on its last run. The "dependency set is the contract" blocks in `installPerRegionFetchAutoruns.test.ts` and `RenderLifecycleMixin.test.ts` pin the whole list per state, so a trigger dropped under a gate, a guard that stopped being `untracked`, or a dev check leaking a read changes the list.

### Every fetch autorun runs on the leading edge

Every installer schedules through `leadingEdgeAutorun` (`@jbrowse/core/util/leadingEdgeAutorun`). MobX's `autorun(fn, { delay })` is trailing-edge only, schedules even the first run through `setTimeout`, and put the whole delay on first paint.

- **The body reports whether it started work, and only that arms the debounce.** A run that bails on a guard (view not measured, minimized, gate shut) returns nothing and stays on the leading edge. A return value cannot be forgotten the way an imperative `prime()` could.
- **The leading edge is one microtask, not the install call.** A model is routinely built and configured in the same synchronous block; a fetch issued between the two lines is invalidated by the setting that follows and reissued. Yielding once collapses the pair. A change after an `await` is a later decision and correctly costs a refetch.

**Install order does not matter, because of the microtask.** With the first run at the install call, autoruns installed before `FetchVisibleRegions` called `clearAllRpcData`, cancelling a fetch issued first and reissuing it with identical arguments: a duplicate RPC per track on every open, visible only to a call count. A new installer owes its first run to a microtask.

**A fast fetch exposes couplings that a slow one hid.** The LGV's coarse blocks sit on a 500 ms trailing-edge autorun, and wiggle's autoscale domain and the alignments coverage scale clip to them. Over the empty initial block list both yield no entries, and no entries means the fallback domain `[0,1]`, not a stale one: a bigwig line track drew blank. `settledDynamicBlocks` holds the rule: coarse blocks once the view has settled once, live ones before. Anything downstream of a fetch that was only correct because the fetch was slow is a coupling; the empty-versus-stale distinction is where it bites.

### The global-fetch trigger list must be read unconditionally

`installFetch` reads `reloadCounter` and `fetchCanceled` unconditionally at the top of its body, above every gate, and that ordering is load-bearing. MobX rebuilds the dependency set on every run, so a read inside the gate drops out on any run that declines, and can then never wake the autorun again. The deleted arc display exposed it: its `prepare` declined while `dataCurrent` was true, so with `reloadCounter` under the gate `reload()` was silently dead.

The viewport and the `rpcProps()` cache key (`FetchMixin.settingsFetchInputs`) are the global family's other two trigger axes. Both ride `currentFetchKey`, which `prepare` and the freshness gate read on every run the gates let through.

**`prepare` returning `undefined` is the display's gate**, one function rather than a predicate plus a bail-out prefix. It runs synchronously in the autorun body, so whatever it read to decline stays in the dependency set. The skeleton's `gate` already declines while `view.initialized` is false, so `prepare` need not restate that. A `prepare` must not move a trigger read of its own under a bail-out.

The general rule: **a gated trigger read is safe only if the gate is itself an observable that flips on the transition you want to wake up on.** `if (self.isMinimized) return` above the tracked deps is fine, since un-minimizing re-runs the body. A pure signal like `reloadCounter`, which no gate consults, is the dangerous case. `installGlobalFetchAutorun.test.ts` pins this for the skeleton and `installPerRegionFetchAutoruns.test.ts` for the hand-rolled family, asserting `reloadCounter`, `fetchCanceled` and `alive` stay visible in the declining states (minimized, errored).

**A gate on committed state is `installFetch`'s `fetchKey`, not a compare in `prepare`.** The skeleton stamps the key at commit and declines on it, and a run whose `reloadCounter` advanced since the run that last issued a fetch ignores it, so a reload refetches with nothing to clear. The split matters because only one decline can strand a display: `prepare` returning `undefined` is "nothing to fetch", a legitimate decline no retry should change, while the key gate is "I have exactly this", which a retry must override. The stamp is observable (the skeleton's own `observable.box`, or the host's `loadedFetchKey`), because a commit landing after the inputs moved back must wake the declined run; a closure variable would leave the late commit's data under the earlier viewport. Both keyed installers gate on `KeyedFetchMixin.currentFetchKey` (the display's `viewSignature` plus settings and adapter axes, since neither comparative display's signature carries an adapter term), and `dataCurrent` compares the same getter against the same stamp, so the gate and the export gate cannot disagree. A secondary fetch passes no `contract` and installs no `makeRetryContractCheck` (one ledger per node, one `lastCounter` per check), and the multi-way synteny display's dependent fetches once shipped a dead Retry from a hand-compared key in `prepare`. Pinned in `installFetch.test.ts`.

`GlobalFetchMixin.reload()` still drops `loadedFetchKey`, for the overlay: `dataCurrent` goes false so the refetch shows as loading while the data stays on screen.

**The per-region twin: a `fetchNeeded` that declines to fetch must be woken by something `FetchVisibleRegions` already tracks.** That autorun tests `isBlockCovered(...) && isCacheValid(...)`, and `&&` short-circuits, so an uncovered block registers no `isCacheValid` dependency. It is safe because an uncovered block always reaches `fetchNeeded` and a fetch bumps `fetchGeneration`. An override returning early without fetching breaks the chain and must supply its own wake path. Both in-tree cases do: sequence's `zoomedOut` moves with `bpPerPx`; multi-sample variant's `!sourcesBase` refetches through `SettingsInvalidate` because `rpcProps().sampleFilter` goes from `undefined` to a list when sources arrive. That is why `sampleFilter` spells the unfiltered case out in full: reusing `undefined` would leave the key unchanged when sources landed, and the display would wedge.

**The comparative family reads `reloadCounter` above its `prepare()` bail-outs for the same reason.** After a failure every fetch input is unchanged, so clearing the error alone refires nothing. Every fetch carries a pure signal, read unconditionally, pinned by its installer's test:

| family | installer | the pure signal | a user cancel lapses on | pinned by |
| --- | --- | --- | --- | --- |
| per-region | `installPerRegionFetchAutoruns` | `fetchGeneration` | a viewport change, or Retry | `installPerRegionFetchAutoruns.test.ts` |
| global | `installGlobalFetchAutorun` | `reloadCounter` | a viewport change, or Retry | `installGlobalFetchAutorun.test.ts` |
| comparative | `installComparativeFetchAutorun` | `reloadCounter` | Retry | `installComparativeFetchAutorun.test.ts` |
| everything else | `installFetch` | `reloadCounter` | Retry, where the host has a cancel | `installFetch.test.ts` |

A fifth skeleton with a gate needs a signal the gate never consults, read above the gate, and a test that fails when the read is deleted.

The prerequisite reads (HiC header, multi-sample sample list, a synteny file's LOD header via `LodTierInfoMixin`, the mark display's source list) share `installPrerequisiteFetch` (`@jbrowse/core/util`): one RPC about the adapter itself, keyed on the adapter config, gated on minimized. It sits in core because the four are on three different fetch foundations. A display reads the answer through `readFor`, which compares by value as the key does, since an undo rebuilds a track's config into an equal but new object.

**A cancel is durable.** No fetch trigger un-cancels it: the skeleton reads `fetchCanceled` tracked, under the counter and above every gate. Only Retry and, on the LGV families, the viewport moving reopen it, since the thing the user stopped is no longer what they are looking at. The comparative family has the gate but not the lapse, because its viewport is its fetch input, so a viewport clear there would un-cancel on every trigger.

**`reloadCounter` lives on `FetchMixin`**, which every fetch foundation composes. Chord and the breakpoint view declare their own because neither composes `FetchMixin`.
