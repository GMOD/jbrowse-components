---
name: fetch-keys
description: What invalidates a fetch, an upload and a frame — the `rpcProps()` / `gpuProps()` / `renderState` tiers and their costs, the cache-key and payload-picking rules, derived region maps, the loop trap. Read before adding a field to any of the three.
kind: spec
---

# Fetch, upload and render keys

The three tiers are stated in [ARCHITECTURE.md](../ARCHITECTURE.md#rpcprops--gpuprops-pattern); this is the argument behind each rule there.

## What each tier costs when it moves, and who is zoom-sensitive

| tier | a change does | cost |
| --- | --- | --- |
| `rpcProps()` | `settingsFetchInputs` moves, every loaded region's `fetchInputs` stamp goes stale, `SettingsInvalidate` runs `invalidateSettings()` | refetch every region, drawn stale under the scrim meanwhile |
| `gpuProps()` | the identity `installUpload` compares moves (`p !== lastProps` clears `encodedFrom` in `createEncodeMemo`, `packages/render-core/src/encodeMemo.ts`) | **re-encode every cached region, main thread, no RPC** |
| `renderState` | the render callback re-fires | repaint |

The middle row surprises because it is O(cached regions x features) of main-thread work with nothing on the network to show it. [ADR-016](../architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md) measured that cost; the accounting applies to anything that lands in `gpuProps()`.

**A per-frame viewport value must never reach `gpuProps()`.** It re-encodes the whole cache mid-gesture, and the profile blames the encoder rather than the key that let it in. No `gpuProps()` reads live `bpPerPx`, `offsetPx`, `visibleRegions`, `dynamicBlocks` or hover. The one deliberate zoom-sensitive exception is `LinearMafDisplay`'s `binBp`, which reads `encodeBinBp`: `subPixelBinBp` (`packages/display-kit/src/subPixelBinBp.ts`) off the **debounced** `coarseBpPerPx`, quantized to a power of two so a gesture does not thrash it. The alignments worker's `perBaseBinBp` rides the RPC call site instead.

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

A zoom-derived worker decision is a field of the display's `zoomFetchArgs()`, not of `rpcProps`: a threshold crossing refetches the regions on screen while they keep drawing, where an `rpcProps` move runs `SettingsInvalidate`, supersedes the in-flight fetch and scrims the held data.

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

## `gpuProps()` and derived region maps — re-upload without refetch

`gpuProps()` exists wherever the main thread encodes the GPU buffer: wiggle, MAF and GC-content. HiC (`self.colorRamp` in render state) and multi-LGV synteny (`computedColors`) fill the same role without the method. Canvas's worker emits a color *class* per themed lane and the main-thread encode resolves classes against `session.palette`, so a theme change re-encodes. A wiggle `color` or `origin` change re-encodes and refetches nothing, while `resolution` and `scoreField` change what the worker returns and refetch.

**Opacity is a render parameter, never a packed color.** Synteny multiplies it in `fillShade`, dotplot in `dotplot.slang`'s fragment, each fed from render state with a Canvas2D twin so SVG export matches. Baking it into every packed ABGR byte turns one drag frame into three O(n) passes (recompute, re-pack, re-upload) for a value identical on every instance. A per-instance array is the wrong home for a scalar that multiplies every element. The color-lane patch that spares a genuine recolor a full re-pack is a backend concern: [GPU_RENDERING.md § Upload patterns](GPU_RENDERING.md#upload-patterns).

Use a derived region map when settings change the shape of per-region data, and `gpuProps()` for scalars fed to an encoder. Alignments' `laidOutByGroup` returns per group shallow clones of `rpcDataMap` entries with freshly allocated Y arrays from main-thread layout; `sourceSections` pairs each with its arc feed for the upload callback. The raw `rpcDataMap` is never mutated.

That immutability fixes its representation: build it with [`regionDataMap()`](../../packages/render-core/src/regionDataMap.ts), a **shallow** `observable.map`, since an entry that never changes gives MobX's deep enhancer nothing to observe ([ADR-060](../architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)). A hand-written `observable.map<number, …>()` is the thing to notice in review.

**A derived map is a tier, so keep its cheap half out of its expensive half.** Alignments splits it in three: `laidOutByGroupUncolored` places rows, `laidOutByGroupFramed` applies chain strand frames, `laidOutByGroup` bakes per-read colors. Folding color settings into the layout computed would make a recolor re-run placement and every Y remap. Split, the layout stays memoized across a recolor, and because the overlay spreads its input, `readYs` keeps its identity: the GPU renderer reads that as "same layout run" and rewrites the read pass alone (GPU_RENDERING.md, "Whole-map synced: skipping a region without leaving stale buffers"). The same applies to any value a derived map reads but only sometimes spends; the band-overhead input to the grouped fit budget is a thunk for that reason.

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
