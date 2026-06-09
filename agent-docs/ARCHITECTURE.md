# Architecture

## Display stacks

There are two parallel linear-display **state-model** stacks. New feature
displays should use the GPU stack; the legacy block stack is kept indefinitely.

| Stack | Base state model | Render path | Concrete displays |
| --- | --- | --- | --- |
| **GPU canvas** | `LinearCanvasBaseDisplay` (plugins/canvas) | canvas/WebGL, data uploaded to GPU | `LinearBasicDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay`, `LinearManhattanDisplay` |
| **Legacy block** | `BaseLinearDisplay` (plugins/linear-genome-view) | block-based, server-side RPC render → SVG | `LinearBareDisplay`, `LinearArcDisplay` |

The vagueness comes from three differently-scoped artifacts sharing the
`BaseLinearDisplay` name:

| Artifact | Kind | Scope |
| --- | --- | --- |
| `baseLinearDisplayConfigSchema` | config schema | **shared by both stacks** + third-party plugins |
| `BaseLinearDisplay` | state model | **legacy block only** (arc + bare) |
| `BaseLinearDisplayComponent` | React shell | **shared by both stacks** |

So `LinearBasicDisplay` (GPU) does **not** extend the `BaseLinearDisplay` state
model, even though it uses the shared config schema and React shell.
`BasicTrack` is a back-compat synonym for `FeatureTrack`. Full rationale,
constraints, and the (deferred) retirement sketch:
`agent-docs/TRACK_DISPLAY_CONCEPTS.md`.

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally for
all genomic features and regions. This matches BED/BAM convention. Adapters
that read 1-based formats (VCF `POS`, GFF `start`) subtract 1 on ingest;
exporters that write 1-based formats add 1 on output.

---

## Data fetching pipeline

`MultiRegionDisplayMixin` (in `plugins/linear-genome-view/src/BaseLinearDisplay/`)
drives RPC fetches for all LGV displays (alignments, canvas, wiggle,
variants) via four autoruns:

| Autorun | Trigger | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` change | `clearAllRpcData()` |
| `FetchVisibleRegions` | viewport / `fetchGeneration` (600ms debounce) | `fetchNeeded(needed)` for uncovered buffered regions; gated by `error`/`regionTooLarge` |
| `SettingsInvalidate` | `rpcProps()` change | `clearAllRpcData()` |
| `ClearBlockingStateOnViewportChange` | viewport change while `regionTooLarge` or `error` is set | `clearAllRpcData()` to unblock retry (no-op for canvas's derived `regionTooLarge`) |

Subclasses override `fetchNeeded` to call `self.fetchRegions(needed, work)`,
where `fetchRegions` runs an optional pre-flight byte estimate
(via `getByteEstimateConfig`) before invoking the work callback. Oversize
regions surface a banner: `DisplayChrome` renders `TooLargeMessage` from the
model's `regionTooLargeReason`. `error`/`regionTooLarge`
reads in `ClearBlockingStateOnViewportChange` are `untracked` for correctness —
tracking either would let `set...` re-fire the autorun and wipe the flag
before any viewport change.

### regionTooLarge: imperative vs. derived

There are two implementations of `regionTooLarge` in the codebase, both
expressed through the `regionTooLarge` getter so consumers
(`regionCannotBeRendered()`, `regionCannotBeRenderedText()`, the
`FetchVisibleRegions` gate) work with either.

- **Imperative** (`RegionTooLargeMixin` default; used by wiggle, alignments,
  hic): `setRegionTooLarge(true)` flips a volatile flag inside `fetchRegions`
  when the byte estimate exceeds the limit. `ClearBlockingStateOnViewportChange`
  clears the flag on viewport change so `FetchVisibleRegions` can retry.
- **Derived** (canvas's `LinearCanvasBaseDisplay`): a pure function of cached
  stats × current `bpPerPx` + visible regions, mirroring `FeatureDensityMixin`.
  - `bytesEstimateTooLarge` reads `featureDensityStats.bytes` (set by the
    byte-estimate RPC) against `userByteSizeLimit ?? adapter limit ?? config`.
  - `densityTooLarge` walks `view.visibleRegions`, looks up
    `densityStatsPerRegion[idx]` (populated for both successful fetches and
    worker-side too-large responses), and tests
    `(featureCount/regionWidthBp) × bpPerPx > maxFeatureDensity`. Scoping to
    currently-visible regions means panning past too-large areas naturally
    releases the gate.
  - `regionTooLarge = bytesEstimateTooLarge || densityTooLarge`.
  - `laidOutDataMap` returns empty when `regionTooLarge` is true, so the GPU
    upload pushes nothing — no stale-feature flash through the banner.
  - `FetchVisibleRegions` gates on `regionTooLarge` before calling
    `isCacheValid`, so density-blocked regions are held back by the gate
    rather than inside `isCacheValid`. When density drops (zoom in or force
    load), `regionTooLarge` flips false, the gate opens, and `isCacheValid`
    returns `false` (no rpcData) → refetch fires and the banner clears.
  - A canvas-level autorun on `view.displayedRegions` clears
    `densityStatsPerRegion`/`featureDensityStats` on chromosome navigation
    (`displayedRegionIndex` gets reused, so stale entries would otherwise gate
    against the wrong region's stats and could permanently block refetch).

The derived approach removes the imperative clear-and-reset cycle that caused
the banner to flicker off and back on during small zoom or pan moves that
didn't actually cross the threshold. Both `featureDensityStats` and
`densityStatsPerRegion` survive `clearAllRpcData()` (they aren't in
`clearDisplaySpecificData`'s clearing path), so
`ClearBlockingStateOnViewportChange` is a no-op for the derived banner —
state recomputes the same value before and after.

`regionCannotBeRendered()` and `regionCannotBeRenderedText()` in
`RegionTooLargeMixin` read through `self.regionTooLarge` (the getter) rather
than `self.regionTooLargeState` (the volatile) so subclass overrides flow
into the banner UI and SVG export text.

Variants are monolithic: `MultiSampleVariantGetCellData` returns one batched
payload covering all visible regions, so variants' `fetchNeeded` expands
`needed` to all `bufferedVisibleRegions` and marks them all loaded together
when the work callback returns.

### `rpcProps()` loop trap and how to break it

Including any fetch-result derivative in `rpcProps()` creates an infinite loop:

```
setCellData → <derived value> changes → rpcProps() changes
  → SettingsInvalidate → clearAllRpcData → cellData cleared
  → <derived value> changes → rpcProps() changes → …
```

The fix is to split the computation: `rpcProps()` gets a cache-key version
computed from user-controlled inputs only; any part that needs fetch-result
data is kept in a separate view used only for rendering or passed directly
to the server.

In the variant case, `rpcProps().sources` calls `getSources` with
`renderingMode: 'alleleCount'` internally so haplotype expansion (which
needs `sampleInfo`) is never triggered. The client's `sources` view still
reads `sampleInfo` for rendering — safe because it is not in `rpcProps()`.
The server receives the unexpanded sources and expands them after computing
`sampleInfo` from features; sources from clustering already carry `HP` and
pass through unchanged.

**Rule**: `rpcProps()` must contain only user-controlled settings. Never
include `cellData`, `sampleInfo`, or any getter that reads them.

See `plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` for the
overridable hook list and test-file mapping.

---

# GPU Rendering Architecture

Canonical reference for the GPU rendering lifecycle across all display types.
Read `PRD.md` first for invariants and active priorities.

## Glossary

- HAL — hardware abstraction layer; abstracts WebGL2 and WebGPU calls.

---

## One-liner

Each GPU display is an MST model that composes `RenderLifecycleMixin`
and calls `self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied
to the model's lifetime — one that runs `upload(backend)`, one that runs
`render(backend)`. MobX auto-tracks every observable read inside each callback,
so changes re-fire the right autorun with no manual dependency declarations.
React components are thin bridges: create a canvas, hand the backend to the
model via `useRenderingBackend`, render JSX.

---

## The API

```ts
interface RenderingBackend {
  // plugin-defined upload/render methods
  dispose(): void
}

// In the plugin's MST model:
startRenderingBackend(backend: RenderingBackend) {
  self.attachRenderingBackend<RenderingBackend>(backend, {
    upload: b => {
      // Read plugin observables, push bytes to the GPU.
      // Re-fires on any observable change.
    },
    render: b => {
      const state = self.renderState
      if (!state) return false              // renderState not ready
      return b.renderBlocks(self.renderBlocks, state)
      // return true only when real content was drawn;
      // mixin calls markCanvasDrawn() → canvasDrawn flips true →
      // MultiRegionDisplayMixin.isReady becomes true once isLoading also clears
    },
  })
}
```

---

## What the mixin owns

```
RenderLifecycleMixin
  .volatile
    canvasDrawn: boolean          set true only after render() returns true with real data
    currentRenderingBackend: unknown    stored backend; autoruns read it each tick
    renderTick: number            bumped by renderNow() and after every upload
    autorunsInstalled: boolean guards attachRenderingBackend (idempotent)
  .actions
    markCanvasDrawn()             idempotent flip to true
    resetCanvasDrawn()            flip to false (called by clearAllRpcData)
    stopRenderingBackend()                 clears currentRenderingBackend + resets canvasDrawn → autoruns idle
    renderNow()                   bumps renderTick → render autorun re-fires
    attachRenderingBackend(b, cbs)         spawns upload + render autoruns (once)

MultiRegionDisplayMixin  (composes RenderLifecycleMixin)
  .views
    isReady: boolean              canvasDrawn && !isLoading
    viewportWithinLoadedData: boolean   every visible block ⊆ a loaded region
    loadingOverlayVisible: boolean      (!isReady || !viewportWithinLoadedData) && !regionTooLarge && !error && !renderError
```

Every display renders its canvas through the shared `DisplayChrome`, which calls
`useRenderingBackend(factory, model)` internally — the backend hook lives in
exactly one place, so a display can't bury it where the chrome can't see it. It
owns every terminal state, reading each off the model: `renderError` (the hook
writes it to model volatile), `regionTooLarge` (rendered as `TooLargeMessage`),
and the `DisplayErrorBar` + `DisplayLoadingOverlay` overlays. `loadingOverlayVisible`
subtracts the other three, so the four states are mutually exclusive by
construction and the JSX order is defensive, not load-bearing. It takes a
render-prop child `({ canvasRef, canvas }) => ReactNode`, so it's agnostic to how
many canvases a display draws and where they mount; pass a `testid` base and the
chrome appends `-done` once `canvasDrawn` flips.
`DisplayLoadingOverlay` reads `loadingOverlayVisible`: `isReady`
covers track-open through the fetch cycle (hiding once the first frame paints);
`viewportWithinLoadedData` re-shows the overlay when the viewport extends past
loaded data — e.g. the pre-refetch debounce after a zoom-out, where `isReady` is
already true but stale data is still on screen (separate getter for tracking
reasons — see BaseLinearDisplay/CLAUDE.md). `stopRenderingBackend` resets
`canvasDrawn` so the overlay recovers after WebGL context loss.

All backend-specific plumbing lives in the plugin. All reactivity plumbing
lives in the mixin.

---

## Life of a frame

1. React hook (`useRenderingBackend`) mounts, creates the HAL, resolves a
   backend, calls `model.startRenderingBackend(backend)`.
2. Mixin sets `currentRenderingBackend = backend`, spawns two autoruns via
   `addDisposer(self, autorun(...))`.
3. Upload autorun fires: reads `currentRenderingBackend`, calls `cbs.upload(b)`,
   bumps `renderTick` so render re-fires after any upload.
4. Render autorun fires: reads `currentRenderingBackend` + `renderTick`, calls
   `cbs.render(b)`. If it returns `true`, flips `canvasDrawn` to `true`.
   `clearAllRpcData` resets `canvasDrawn = false` so the flag is only set
   after the canvas has real content.
5. Any observable touched by `upload` or `render` becomes a dep — when it
   changes, MobX re-fires that autorun. No manual invalidation.

### Context-loss recovery

GPU contexts can be lost. `useRenderer` listens for
`webglcontextlost`/`restored` and `device.lost`, rebuilds the backend, and
calls `model.startRenderingBackend(newRenderingBackend)`. The mixin sees
`autorunsInstalled === true`, skips re-installation, just reassigns
`currentRenderingBackend`. Both autoruns re-fire against the new backend. No special
code path.

### Tab visibility

`useTabVisibilityRerender` calls `model.renderNow()` on `visibilitychange`,
bumping `renderTick`. WebGPU swap-chain textures are reissued by the `render`
callback.

---

## RenderingBackend interfaces per plugin

Each plugin defines its own `RenderingBackend` type and a factory that produces either
a GPU or Canvas 2D implementation:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<XxxRenderingBackend>(
    canvas,
    XXX_PASSES,
    XXX_UNIFORM_BYTE_SIZE,
    hal => new GpuXxxRenderer(hal),
    c => new Canvas2DXxxRenderer(c),
  )
}
```

`createRenderingBackend` calls `createGpuHal`; if a HAL is returned, the GPU backend
is constructed, otherwise Canvas 2D.

### Canvas2D is the floor; GPU is the optional accelerator

Every display **must** ship a Canvas2D draw function regardless — SVG export
goes through it (see "SVG export pipeline"). The GPU shader path is an *optional
accelerator* layered on top for displays whose feature counts demand it
(≳100K features/frame — RFC-001 §3a). So a display whose data is always
gene-scale / low-density / text can be **Canvas2D-only**: it writes no `.slang`,
no `GpuXxxRenderer`, and no pass list. Its factory skips the HAL ladder and
returns the Canvas2D backend directly via `createCanvas2DBackend`:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DXxxRenderer(c))
}
```

The backend plugs into the same `RenderLifecycleMixin` / `DisplayChrome`
machinery as a GPU display — the lifecycle is backend-agnostic, so nothing
downstream knows there's no HAL. Reference: `plugins/sequence`'s
`SequenceRenderer`. Start here for any new display; promote to the dual-path
`createRenderingBackend` only when a profile shows Canvas2D can't hold 60fps at
the display's real feature counts.

### Shared per-region streamed contract

Per-region streamed plugins (canvas, manhattan, MAF, multi-variant, wiggle)
specialize one generic type and inherit from one of two abstract base
classes in `@jbrowse/core/gpu/perRegionRenderingBackend`:

```ts
// Plugin specializes the interface (used in model + React code):
export type XxxRenderingBackend = PerRegionRenderingBackend<XxxUploadData, XxxRenderState>

// Plugin's GPU renderer extends GpuPerRegionRenderingBackend, implements uploadRegion + renderBlocks:
export class GpuXxxRenderer extends GpuPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  constructor(hal: GpuHal) { super(hal, XXX_UNIFORM_BYTE_SIZE) }
  uploadRegion(idx, data) { … }
  renderBlocks(blocks, regions, state) { … }
}

// Plugin's Canvas2D renderer extends Canvas2DPerRegionRenderingBackend, implements renderBlocks only:
export class Canvas2DXxxRenderer extends Canvas2DPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  renderBlocks(blocks, regions, state) { … }
}
```

The bases own everything that's truly shared:

- `Canvas2DPerRegionRenderingBackend` — owns `canvas` + `ctx` (constructor throws
  if 2D context unavailable), stubs `uploadRegion` / `pruneRegions` /
  `dispose` as no-ops since the source of truth is the `regions` map.
- `GpuPerRegionRenderingBackend` — owns the `hal` reference and a pre-allocated
  uniform scratch `ArrayBuffer`. Default `pruneRegions(active)` delegates
  to `hal.pruneRegions(active)`; default `dispose()` calls `hal.dispose()`.

Two invariants make the renderer implementations small and uniform:

- `renderBlocks` receives the model's data map as its second argument — the
  renderer holds no `Map<number, ...>` field of its own. GPU buffer lifecycle
  delegates to `hal.pruneRegions(active)`; Canvas2D backends inherit no-op
  upload/prune and read everything from `regions` at render time.
- `hal.drawPass` short-circuits when the region has no buffer for that pass,
  so GPU renderers issue draws unconditionally — no per-region flag cache.

For MAF, the upload payload (`MafUploadPayload`) wraps a pre-encoded GPU
buffer AND the raw `MafRegionData`; only the latter is needed at render
time. `PerRegionRenderingBackend` has an optional fourth type param `RenderData`
(defaults to `UploadData`) to support this split.

Whole-map synced (alignments, multi-LGV-synteny) and monolithic (HiC, LD,
multi-variant-matrix, dotplot) plugins still define their own backend
interfaces because their upload shapes differ — see "Three upload patterns".

### Wiggle-family contract

Wiggle-style per-position GPU displays (wiggle, multi-wiggle, Manhattan)
share types and scale utilities. Two packages split the surface:

`@jbrowse/wiggle-core` — the cross-plugin contract. Import types and pure
utilities from here so new plugins don't drag in the wiggle plugin's MST
factories or RPC methods:

- `renderingBackendTypes.ts` — `WiggleRenderingBackend`, `WiggleGPURenderState`, `SourceRenderData`
- `dataTypes.ts` — `WiggleDataResult`, `WiggleSourceData`, `WiggleFeatureArrays`
- `normalize.ts` — `SCALE_TYPE_LOG`/`LINEAR`, `scaleTypeFromString`, `makeScoreNormalizer`
- `displayModel.ts` — `WiggleGpuDisplayModel<TRenderingBackend>`: model↔component contract
- `scale.ts` / `autoscale.ts` — `getNiceDomain`, `getScale`, autoscale helpers

`@jbrowse/plugin-wiggle` — composable model pieces. These live in the plugin
because they depend on `BaseDisplay` / `MultiRegionDisplayMixin` and wire up
RPC methods:

- `linearWiggleDisplayConfigSchema` / `linearWiggleDisplayModelFactory` — used
  by GWAS's `LinearManhattanDisplay` as the base for config + model
- `rendererMenuItems(self, {extraScoreItems})` — shared Score + cross-hatch
  menu items composed by every wiggle-family display

GWAS's Manhattan composes `linearWiggleDisplayModelFactory` for the shared
score-domain / cross-hatch / color machinery, but ships its own
`GetManhattanData` RPC (Manhattan returns per-feature points, not pre-binned
density), implements `WiggleRenderingBackend` with its own pass, and overrides
`isCacheValid` to `() => true` since Manhattan data is zoom-independent.

### Three upload patterns

Per-LGV displays use one of three upload shapes; pick the one that matches
the data shape, not the one your neighbour copied:

| Pattern | Upload methods | Render | Use when | Examples |
|---|---|---|---|---|
| **Per-region streamed** | `uploadRegion(idx, data)` + `pruneRegions(active)` | `renderBlocks(blocks, state)` | each region's data is independent across regions, reactive per-region updates | canvas, wiggle, multi-wiggle, **MAF**, manhattan, multi-variant |
| **Whole-map synced** | `sync(sources)` | `renderBlocks(blocks, state)` | per-region streams must rebuild coherently (e.g. main-thread cross-region Y layout), or encoder settings drive packing | alignments, multi-LGV synteny |
| **Monolithic** (base class `GlobalRenderingBackend` / `GpuGlobalRenderingBackend`, mixin `GlobalDataDisplayMixin`) | `uploadX(data)` | `render(state)` (no blocks) | display has no region partitioning (heatmaps spanning the whole view) | HiC, LD, multi-variant matrix, dotplot |

MAF is **per-region streamed** (like canvas/wiggle), not whole-map synced like
alignments. MAF blocks are independent — no main-thread Y-layout couples
adjacent regions — so each region's upload re-encodes in isolation via
`installPerRegionLifecycle`. Alignments' whole-map sync exists *only*
because pileup Y-rows must be assigned consistently across multiple
`displayedRegions` (a read spanning a region boundary needs the same Y row in
both regions), forcing the upload to rebuild the whole map whenever any
region's input changes. If a future MAF feature added cross-region coupling
(e.g. main-thread re-clustering of rows based on combined data), it would
move to whole-map synced — until then, per-region streamed is the right
shape.

All three patterns expose the same lifecycle (`attachRenderingBackend({ upload,
render })`); the difference is how the upload callback shovels bytes.

#### Per-region streamed: per-key autoruns (`installPerRegionLifecycle`)

**Plain English:** The naive implementation re-uploads every chromosome to the
GPU each time any chromosome finishes loading — 300 uploads instead of 24 for
a whole-genome wiggle track. The fix gives each chromosome its own tiny MobX
watcher. When chromosome 5 arrives, only chromosome 5's watcher fires and
uploads. When the user changes a color setting, all 24 watchers fire and all
24 re-upload — which is the right behavior.

Naive per-region upload iterates the full `rpcDataMap` inside the upload
callback. Because `for (const [k, v] of rpcDataMap)` makes MobX track the
entire map, every `rpcDataMap.set(key, data)` call re-fires the autorun and
re-uploads all N regions — O(N²) total GPU uploads when N regions arrive
sequentially.

**The fix lives in `@jbrowse/core/gpu/installPerRegionLifecycle`** and is
used by every per-region plugin (wiggle, multi-wiggle, manhattan, MAF,
multi-variant, multi-variant-matrix). Each plugin's `startRenderingBackend`
action collapses to a single call:

```ts
startRenderingBackend(backend: XxxRenderingBackend) {
  installPerRegionLifecycle(
    self,
    self.rpcDataMap,
    backend,
    data => encode(data, self.gpuProps()),       // optional encode step
    (b, encoded) => {                            // render callback
      const state = self.xxxRenderState
      if (!state) return false
      b.renderBlocks(self.renderBlocks, /* rpcDataMap or `encoded` */, state)
      return true
    },
  )
}
```

The helper spawns one autorun per `rpcDataMap` key. When a new key arrives
only its autorun fires (O(1) upload). When an encoder-tracked observable
changes (theme, color, scale), all per-key autoruns fire (O(N) re-encode) —
which is the right behavior.

Key MobX fact: `ObservableMap.get(existingKey)` tracks `hasMap_.get(key)`
(per-key existence atom), not `keysAtom_`. Adding a new key fires
`keysAtom_` (waking the key-manager only) and that new key's `hasMap_`
entry. Existing per-key autoruns are **not** re-fired.

The helper also caches successful encode outputs in a `Map<number, Encoded>`
and passes it to the render callback — wiggle's renderer reads from this
map because its renderer is stateless; other callers ignore the arg and
read `rpcDataMap` directly. Cleanup is automatic via `addDisposer(self, …)`.

**Plain English on why the helper doesn't apply to canvas / alignments:**
Wiggle uploads each chromosome independently — chromosome 5's data has
nothing to do with chromosome 1's. Canvas and alignments lay out features
into Y-rows across all loaded regions together (so a gene spanning two
adjacent regions ends up on the same row in both). That means any new
arrival could in principle change the layout of everything already loaded,
so the code recomputes and re-uploads everything. Cross-region coupling is
load-bearing in practice — collapsed-intron views split a single chromosome
into many small displayed regions, and a long gene spanning those chunks
must hold the same Y-row in each one. The same view pattern is also why
the layout step runs on the main thread instead of inside the worker: row
assignment needs the union of all visible regions' features, which only
the main thread sees.

**Canvas and alignments both route through a whole-map MobX computed**
(`laidOutDataMap` / `laidOutPileupMap`) that invalidates whenever any
`rpcDataMap` entry changes, causing the upload autorun to re-fire and iterate
all N entries. Per-key autoruns cannot help here: reading
`laidOutDataMap.get(key)` or `laidOutPileupMap.get(key)` in a per-key autorun
still tracks the whole-map computed as a dependency, so all per-key autoruns
re-fire on every new arrival.

- **Canvas** is commonly shown as a whole-genome gene track with N=24
  chromosomes (or many more in collapsed-intron views), so the naive form is
  O(N²). This is fixed: `createIncrementalLayout` (in
  `plugins/canvas/src/LinearBasicDisplay/layout.ts`) memoizes the pure
  `computeLaidOutData` **per ref-group** (`assembly:refName`). Layout is
  independent across chromosomes, so when one chromosome's data arrives only
  its group relays out; unchanged groups return their previous output objects
  *by reference*. The upload autorun then compares each region's reference
  against a per-region `uploaded` map and re-uploads only the ones that
  changed (still pruning against the full active set, and resetting on backend
  swap so context-loss recovery re-uploads everything). Net: O(N) layout +
  GPU uploads as N chromosomes stream in. The memo is a per-instance volatile;
  mutating its internal cache is invisible to MobX, so reading it inside the
  `laidOutDataMap` computed stays pure. Stability unit is the ref-group, not
  the region, because collapsed-intron views split one chromosome into many
  displayed regions and a spanning feature must hold the same Y row in each —
  so adding a region to an existing group relays out that whole group.
- **Alignments/synteny** keep the whole-map form. They are never shown at
  whole-genome scale (data density forces gene-level zoom, or synteny is
  pairwise), so N is typically 4–8 buffered regions (more in collapsed-intron).
  The same per-group memo would apply if the perceived cost grew; the extra
  wrinkle there is `laidOutPileupMap`'s cross-region chain-mode coupling
  (connecting lines / Flatbush), which would need to participate in the
  group-signature.

---

## SVG export pipeline (single source of truth)

SVG export and on-screen rendering share the same pure draw function(s) per
plugin. Two shapes, picked by **whether there's a non-trivial builder step
between fetched data and paint**:

- **Direct** — `drawXxxBlocks(ctx, regions, blocks, state)` is the only entry
  point; `regions` IS the fetched data (or a 1:1 derived map like
  `laidOutDataMap`). Both the on-screen `Canvas2DXxxRenderer.renderBlocks`
  and `renderSvg.tsx` call it directly.
  Plugins: canvas, MAF, HiC, LD, multi-variant-matrix, sequence, manhattan,
  dotplot.
- **With builder wrapper** — fetched data needs transformation
  (encode/filter/merge) before painting:
  - `drawXxxBlocks(ctx, regions, blocks, state)` — paints a pre-built map
    (the on-screen renderer accumulates regions and calls this).
  - `drawXxxToCtx(ctx, sources, blocks, state)` — one-shot wrapper used by
    `renderSvg.tsx`: builds the regions map from observable sources, then
    calls `drawXxxBlocks`. The wrapper is what the on-screen
    `uploadRegion` (per-region) accumulates over time.
  Plugins: alignments (merge pileup + arcs), wiggle / multi-wiggle (per-region
  encode), multi-variant (Record→Map + filter), multi-LGV-synteny (merge into
  layout map). Alignments goes one step further and exports a named
  `buildAlignmentsRegionMap` because the on-screen `sync(sources)` reuses it.

All entry points take any 2D-context-shaped surface: real
`CanvasRenderingContext2D` for on-screen, `SvgCanvas` for vector export.
`Canvas2DXxxRenderer` is bound (canvas required at construction) — SVG
export does *not* instantiate the renderer. It calls the pure functions
directly.

**Per-block vs monolithic is an upload/data-shape question, not a draw-API
question.** Canvas, wiggle, MAF, manhattan, multi-variant are per-region
streamed (uploadRegion + renderBlocks); alignments + multi-LGV-synteny are
whole-map synced (sync(sources) + renderBlocks); HiC, LD, variants-matrix,
dotplot are monolithic (uploadX + render). Whether a plugin needs a
`drawXxxToCtx` wrapper depends only on whether there's transformation
between raw data and paint, not on its upload pattern.

SVG export in `renderSvg.tsx` follows this recipe:

```tsx
await when(() => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge)
if (model.error) return <SVGErrorBox …/>
const renderBlocks = buildRenderBlocks(view.visibleRegions)
const node = paintLayer(totalWidth, height, opts, ctx => {
  drawXxxBlocks(ctx, model.rpcDataMap, renderBlocks, state)
  // OR, for multi-source: drawXxxToCtx(ctx, sources, renderBlocks, state)
})
```

`paintLayer` (in `@jbrowse/core/util/paintLayer`) decides between a 2× DPR
raster canvas (when `opts.rasterizeLayers`) or an `SvgCanvas`, and returns
one `ReactNode` (`<image xlinkHref=…>` or `<g dangerouslySetInnerHTML=…>`).
Raster mode bakes the 2× DPR scaling into the embedded PNG; vector mode
serializes the SvgCanvas call log to SVG markup. Either way the caller
draws to `Ctx2D` in CSS pixels — no manual DPR.

**Avoid hand-rolled JSX-SVG inside `renderSvg.tsx`**. Anything draw-shaped
(rects, paths, fills, strokes) should go through `paintLayer` so both raster
and vector modes work and the on-screen draw code can be shared. Hand-rolled
`<rect>`/`<path>`/`<line>` inside `renderSvg.tsx` is a red flag — it can't
rasterize, drifts from on-screen output, and locks in vector output.

**Permitted exception classes** (only these — anything else is a regression):

1. **Trivial chrome**: scalebars, single separator lines, clipPath wrappers,
   transform `<g>` for offsetting an already-paintLayer'd block. Use
   `<SvgClipRect>` from `@jbrowse/plugin-linear-genome-view` for the
   clipPath+rect pair so every plugin shares one shape.
2. **Bezier-arc overlays** (sashimi in `plugins/alignments`, paired arcs in
   `plugins/alignments` and `plugins/arc`): low element count, native SVG
   `<path>` gives hover/tooltip behavior raster cannot match. Math comes from
   a shared `computeXxxArcs(opts) → Arc[]` so on-screen overlay and SVG
   export consume identical geometry. Don't add a new "vector by design"
   exception just because something is "interactive" — bezier-arc displays
   already render this way on-screen, so the JSX path *is* the on-screen
   path.
3. **Shared React-SVG overlays** that the on-screen view also uses (e.g.
   `VariantLabels`, `LinesConnectingMatrixToGenomicPosition`,
   `RecombinationTrack` in `plugins/variants/LDDisplay`,
   `SvgRowLabels`/`SvgTreePath` from `@jbrowse/tree-sidebar`). Same
   component renders on-screen + in export with an `exportSVG` prop. The
   heavy raster-friendly fill path (the matrix itself) **must** still go
   through `paintLayer`; only the overlays stay JSX.

Everything else — every "regular" draw path (fills, glyphs, mismatches,
coverage bins, score bars, ribbons, dot lines, sequence text) — goes
through `paintLayer(width, height, opts, ctx => drawXxx{Blocks,ToCtx}(ctx,
…))` using whichever entry point the plugin exposes (see "Direct" vs "With
builder wrapper" above).

This kills the older "SVG-only `renderToCtx`" pattern that drifted out of
sync with the on-screen renderer (different bicolor handling, different
Y-axis offsets, different bezier curves, different palettes — each plugin
had its own flavor of drift). The canonical reference for the
builder-wrapper shape is
`plugins/alignments/src/LinearAlignmentsDisplay/components/Canvas2DAlignmentsRenderer.ts`
(`buildAlignmentsRegionMap` + `drawAlignmentsToCtx` + `drawAlignmentBlocks`);
for the direct shape see
`plugins/maf/src/LinearMafRenderer/drawMafBlocks.ts`.

**Shared utilities** (in `@jbrowse/core/util/`):
- `createSvgRasterCanvas(width, height, opts)` — the 2× DPR canvas + `opts.createCanvas` fallback ritual.
- `paintLayer(width, height, opts, paint) → ReactNode` — raster-vs-vector dispatch.
- `svgExport` — `SVGErrorBox` (red error banner) and `SvgClipRect` (clipPath wrapper) for every renderSvg.tsx.
- `Ctx2D = CanvasRenderingContext2D | SvgCanvas` — shared type alias used by every `drawXxxBlocks` signature.

---

## `rpcProps()` / `gpuProps()` pattern

Domain-named methods that enumerate **what affects rendering output**. Both
are MST view methods (not getters) so subclasses extend them via the standard
`super` capture pattern, mirroring `renderProps`.

| Method             | Consumer                                                          | Invalidation route                                                                              |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `rpcProps()`       | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | Mixin `SettingsInvalidate` autorun reads `void self.rpcProps()` → `clearAllRpcData` → refetch   |
| `gpuProps()`       | `buildSourceRenderData(data, self.gpuProps())` — encoder input    | Upload callback reads it — MobX re-uploads without an RPC roundtrip                             |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap`          | Upload autorun reads it — MobX re-uploads without an RPC roundtrip                              |
| `renderState`      | `backend.render(state)` per frame                                 | Render callback reads it — re-fires when deps shift                                             |

`rpcProps()` returns **user-controlled settings only**. Structural args
(`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `sessionId`,
`stopToken`) are spread in at the RPC call site, not from `rpcProps()` —
keeping `rpcProps()` focused on its purpose: cache keys for
`SettingsInvalidate`. Every display follows the same call shape:

```ts
rpcManager.call(sessionId, 'RenderXxxData', {
  sessionId,
  adapterConfig: self.adapterConfig,  // inherited from BaseDisplayModel
  regions, bpPerPx,                    // per-call values
  ...self.rpcProps(),                  // user settings (cache keys)
  stopToken, statusCallback,
})
```

`adapterConfig` is provided by `BaseDisplayModel` (via
`getConf(this.parentTrack, 'adapter')`) — no display redefines it.

`rpcProps()` is the **only** extension point for the RPC payload. Each display
defines its own typed shape; subclasses that need to layer on additional
fields capture `super` and spread:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      const base = superRpcProps()
      return {
        ...base,
        displayConfig: { ...base.displayConfig, geneGlyphMode: self.effectiveGeneGlyphMode },
        showOnlyGenes: self.showOnlyGenes,
      }
    },
  }
})
```

`MultiRegionDisplayMixin` does **not** provide a base default — declaring one
would widen the typed return through MST's `.views()` chain and force consumers
to re-spread named fields. The mixin's `SettingsInvalidate` autorun looks up
`rpcProps` dynamically (`(self as { rpcProps?: () => unknown }).rpcProps`) so
displays without settings-driven refetch (HiC, LD) can simply not define it.

`gpuProps()` exists wherever the main thread encodes the GPU buffer (wiggle,
multi-wiggle, multi-LGV synteny). Canvas's worker pre-builds the buffer, so
canvas has only `rpcProps()`. This splits refetch from re-upload: wiggle color
change → re-encode only; `bicolorPivot` change → worker output differs →
`rpcProps()` → refetch.

Derived region maps apply when upload needs whole fresh per-region payloads,
not just encoder parameters. Alignments' `laidOutPileupMap` returns shallow
clones of `rpcDataMap` entries with freshly-allocated Y arrays from
main-thread layout (+ connecting-line / Flatbush in chain mode). Raw
`rpcDataMap` is never mutated. Use derived maps when settings change the
shape/contents of per-region data; use `gpuProps()` for scalars fed to an
encoder.

---

## Per-region zoom-staleness

All worker position output is **absolute genomic uint32** — no pixel
coordinates cross the worker boundary, so data stays valid under zoom. Two
exceptions for zoom-dependent *content* (not coords):

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based on
  `bpPerPx / resolution`. `isCacheValid` uses strict equality
  (`view.bpPerPx === loadedBpPerPx`) — any zoom change refetches all visible
  regions together. See `architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md`.
- **Canvas**: the amino-acid overlay is the only `bpPerPx`-dependent worker
  decision. `isCacheValid` returns `false` (refetch) when `rpcDataMap` has no
  entry for the region (pruned off-screen or never loaded), and otherwise
  refetches only when the viewport crosses `shouldRenderPeptideBackground`'s
  discrete threshold. Density-blocked regions are held back by the
  `regionTooLarge` gate in `FetchVisibleRegions`, not inside `isCacheValid`.
  `laidOutDataMap` uses `coarseBpPerPx` (debounced 500ms) so Y-row packing
  doesn't recompute on every animation frame during smooth zoom.

All other plugins leave the default `() => true`.

`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the override
per region and refetches stale ones.

---

## HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/core/src/gpu/hal/`.

```
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  ?renderer=canvas2d     → return null
  else                   → try WebGPU → fallback WebGL2 → fallback null
```

**Key methods:** `uploadBuffer(regionKey, passId, data, count)`,
`getBufferCount(regionKey, passId)`, `drawPass(passId, regionKey, bufferPassId?)`,
`writeUniforms(data)`, `setScissor`, `setViewport`, `deleteRegion(key)`,
`pruneRegions(active)`, `dispose()`.

`drawPass` short-circuits when the region has no buffer for that pass (or
count is zero), so callers can issue draws unconditionally without tracking
which regions have data — HAL already knows.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery),
`WebGL2Hal` (`antialias: true`, VAO + UBO, context-loss recovery),
`MockHal` (tests).

### Renderers stay stateless

GPU renderer classes own only what is intrinsically per-instance:

- the `GpuHal` reference
- pre-allocated uniform scratch buffers (`ArrayBuffer` + typed views) reused
  across frames to avoid per-frame GC churn
- save/restore UBO scratch where a pass mutates uniforms (alignments arc/overlay)

What does NOT belong as renderer instance state:

- **Region-lifecycle bookkeeping** — call `hal.pruneRegions(active)` instead
  of mirroring HAL's region map in a renderer-side `Map<number, ...>`. HAL
  is the authoritative owner of "which regions have GPU buffers."
- **Per-region metadata derivable from `rpcDataMap`** — `hasRects` /
  `hasLines` / `outlineColor` style fields. `drawPass` skips missing buffers
  so the boolean flags aren't needed; per-region scalars used in uniforms
  should be passed into `renderBlocks` from the MST model rather than cached
  on the renderer. See `GpuCanvasFeatureRenderer` for the canonical shape:
  `renderBlocks(blocks, regions, state)` where `regions` is the model's
  `laidOutDataMap` / `rpcDataMap` passed through verbatim.
- **Write-only mirror copies of upload data** — if a value lives in
  `rpcDataMap[idx].foo`, do not also store it as `LocalRegion.foo` "just in
  case." Read it from the upload data path that needs it.

The rule of thumb: anything the upload callback already knows from observable
inputs can be looked up at render time too — don't snapshot it onto the
renderer instance. Less local state means fewer divergence points when the
source of truth shifts.

**RenderingBackend override** (query param `?renderer=`): `webgpu` / `webgl` /
`canvas2d` / `canvas`; omitted → auto-detect WebGPU → WebGL2 → Canvas 2D.

---

## Shaders (Slang codegen)

Production draw shaders are authored as `.slang`, compiled to WGSL (WebGPU)
and GLSL ES 3.00 (WebGL2) by `scripts/build-shaders.ts`. See ADR-005.

**Layout:** display-specific shaders in
`plugins/<plugin>/src/<display>/shaders/<name>.slang`; per-plugin shared in
`plugins/<plugin>/src/shared/shaders/`; cross-plugin modules
(`hpmath.slang`, `colorPack.slang`) in `packages/core/src/gpu/shaders/`.
Codegen emits `<name>.generated.ts`.

**What's auto-derived from Slang reflection (not hand-coded):** the
`.generated.ts` file exports shader source strings (`WGSL_SOURCE`,
`GLSL_VERTEX`, `GLSL_FRAGMENT`), per-field byte offsets (`FIELD_OFFSET_BYTES`,
`FIELD_OFFSET_F32`), strides (`INSTANCE_STRIDE_BYTES`, `INSTANCE_STRIDE_F32`),
`UNIFORMS_SIZE_BYTES` + `UniformOffsets`, typed TS interfaces for instance and
uniform structs, a typed `writeUniforms()` uniform packer, a typed
`packInstances()` struct-of-arrays instance packer (one input array per field;
the u32/i32/f32 destination view per field is derived from the shader struct,
so a field-type change can't desync the packer), and the
`GL_ATTRIBUTES: GlAttributeLayout[]` array consumed by `PassDescriptor`. TS
code imports these constants by name from the generated module — stride and
field-offset drift between the TS packer and the shader struct is impossible
by construction. CI runs `pnpm gen:shaders && git diff --exit-code` to catch
stale generated outputs.

**Wire-up:** `slangPass()` turns a generated module into a `PassDescriptor`,
with overrides for `topology`, `blendState`, `textures`, and buffer sharing.

Authoring conventions and gotchas: ADR-005.

---

## BP precision: why both uint32 storage AND hi/lo float math

Genomic positions exceed 3×10⁹ on T2T assemblies; float32's 24-bit mantissa
can't represent every integer past 2²⁴ ≈ 16.7 Mbp, causing ~256 bp precision
loss at 3 Gbp. GPU clip-space is unavoidably float32, so the question is
*where* precision loss happens without corrupting output.

The answer is a **two-stage representation**:

### Stage 1 — storage as uint32

Absolute genomic positions are stored as `uint32` vertex attributes. Uint32 is
exact for `[0, 2³²)` = 4.29 Gbp.

### Stage 2 — conversion to clip-space via hi/lo split

In the shader the uint32 is split into a **high** half (bits 12..31, aligned
to 4096-bp boundaries) and a **low** half (bits 0..11, values 0..4095):

```wgsl
uint lo = value & 0xFFFu;
uint hi = value - lo;
float2 split = float2(float(hi), float(lo));
```

Both halves are exact in float32 — `hi` is always an exact multiple of 4096;
`lo` is always in `[0, 4096)`.

`clippedBpStart` is split the same way on the CPU (`splitPositionWithFrac`)
and uploaded as `bpHi`/`bpLo`. The shader subtracts hi-from-hi and
lo-from-lo separately:

```wgsl
float dHi = split.x - u.bpHi;  // exact: large-large = small
float dLo = split.y - u.bpLo;  // exact: small-small = small
float clipX = (dHi + dLo) / bpLen * 2.0 - 1.0;
```

### Why we need both representations

- **uint32 only (no split)**: shader would convert uint32 → float directly,
  losing precision at 3 Gbp. Works only below ~16 Mbp.
- **float hi/lo pre-split (no uint32)**: doubles per-vertex memory (8 vs 4
  bytes) and pushes split logic onto every CPU packer.
- **uint32, split in shader (current)**: 4 bytes per vertex, precision
  preserved, CPU packers copy absolute positions unchanged. Split is 2 integer
  ops in the shader.

`hpmath.slang` provides `hpSplitUint`, `hpToClipX`, `hpScaleLinear`.
`blockClipUtils.clipBlock` emits `[bpStartHi, bpStartLo]` for the visible
window; `splitPositionWithFrac` is the CPU equivalent for UBO fields.

### Synteny: pre-split Float32 hi/lo cumulative-bp

Synteny corner storage takes a different shape than the LGV-family uint32
attributes above. A synteny ribbon connects two views with independent
`bpPerPx` and independent inter-region paddings; per-corner positions are
**cumulative-bp across all regions of the corner's view**, not single-region
absolute bp. So:

- The vertex attribute is `(bpHi, bpLo)` Float32 pairs, pre-split on the CPU
  via `splitPositionWithFrac` against 4096-bp buckets — same hi/lo math as
  the LGV path, just split up-front instead of in the shader.
- The view origin uniform `viewBp = offsetPx * bpPerPx` is also hi/lo split
  (`viewBp{0,1}{Hi,Lo}`). This is **padded-bp at canvas left** — not pure
  cumulative genomic bp; it includes the padding-as-bp contribution, which
  is what lets the per-instance `pad` cancel out the padding-at-canvas-left
  term in the shader formula `(cumBp − viewBp)/bpPerPx + pad`. No companion
  `viewPad` uniform is needed.
- Inter-region padding pixels stay as a per-instance Float32 attribute
  (`padTop`, `padBottom`), accumulated up to the corner's region.

Storing as cumBp instead of regional bp + region index avoids the
per-region uniform table / per-(region-pair) draw call concerns that ruled
out earlier hp-math attempts; padding per-instance plus a single per-view
origin uniform handles inter-region offsets without any `MAX_REGIONS` cap.
See ADR-010 for the rejected per-region-table alternatives, ADR-018 for
why this shape works.

Dotplot currently stays on pre-projected Float32 pixel offsets per
ADR-010. Its geometry-buffer layout (line endpoints) differs from
synteny's parallelogram corners and would need its own migration.

---

## Coordinate convention (alignments and wiggle data)

**Every** position array emitted by the alignments or wiggle worker is
**absolute genomic uint32** — reads, gaps, mismatches, interbase (ins/soft/
hardclip), softclip bases, modifications, SNP/noncov/indicator/modCov
segments, sashimi junctions, chain connecting lines, `coverageStartPos`,
`readNextPositions`, and wiggle `featurePositions`.

**Why absolute, not regionStart-relative:**

1. Region boundaries change on zoom-out. Anything keyed to `regionStart` is
   silently invalidated when the anchor shifts.
2. No signed offsets needed — genomic positions are always ≥0.
3. Reversed regions are transformed by the drawing layer (`bpToX` on Canvas2D,
   `flipX` on GPU), not the coord convention. Reversal is orthogonal.
4. All consumers (SVG export, Canvas2D, hit testing, tooltips,
   `findFeatureInRpcData`, main-thread layout) compare against absolute bp
   values. No `regionStart +` arithmetic anywhere.

**Precision across the GPU boundary:**

Every shader consumes absolute uint32 positions and converts to clip space via
hp-math.

| Shader group | Attribute | Precision technique |
|---|---|---|
| Point/edge shaders (read, gap, mismatch, insertion, modification, clip, connectingLine, arcLine, coverage, snpCoverage, noncovHistogram, indicator, modCoverage) | `uint position` | `hpClipX(hpSplitUint(absPos), u)` — hi/lo split against `bpHi`/`bpLo`. Exact at 3 Gbp. |
| arc (paired-end bezier curves) | `uint x1, x2` | `hpLinear(hpSplitUint(absPos), u)` → normalized [0,1]; bezier runs on small floats. Same precision floor. |

The alignments UBO has **no `regionStart`**, **no `domainStart`/`domainEnd`**.

**Reversed regions:** Both shader families call `flipX(sx, u)` after
computing clip-space x. `flipX(x) = lerp(x, -x, u.reversed)` maps
left-edge=`region.end`, right-edge=`region.start`.

---

## Canvas scaling & hi-DPI

**GPU canvases (HAL-managed)**: shader uniforms are in CSS pixels; HAL sets the
backing store to `css × dpr`, so `N / canvas_width` in clip space = `N` CSS
pixels at any DPR. Do not manually scale by `devicePixelRatio`.

**2D overlay canvases (`VisibleLabelsOverlay`, `MsaHighlightOverlay`, etc.)**:
caller owns DPR. Set `canvas.width = w * dpr` + `canvas.height = h * dpr` in
the effect, call `ctx.scale(dpr, dpr)`, then put CSS `width`/`height` in the
style block. Skipping this renders blurry on Retina displays. `prepareCanvas`
(in `packages/core/src/gpu/canvas2dUtils.ts`) does this for the on-screen
Canvas2D backend path; standalone overlay components must replicate it.

---

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions`. Stable unless regions are
added, removed, or reordered. **Not** an index into
`dynamicBlocks.contentBlocks` — one displayedRegion can produce multiple
render blocks that share one GPU buffer and draw with different scissor clips.

The join key across `model.rpcDataMap`, `hal.uploadBuffer(regionKey, ...)`,
and `RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot, synteny)
key on a tuple of two displayedRegion indices.

---

## Adding a new GPU display type

- **Types** — `MyData`, `MyRenderState`, `MyRenderingBackend`.
- **Shader** — author `my.slang`; `pnpm gen:shaders` emits `my.generated.ts`.
- **Renderers + factory** — `createRenderingBackend<MyRenderingBackend>` from
  `packages/core/src/gpu/createRenderingBackend.ts`. Use `slangPass()` to build
  the `PassDescriptor`.
- **MST model:**
  - Compose `MultiRegionDisplayMixin()` for LGV-family per-region displays
    (brings in `RenderLifecycleMixin`, `FetchMixin`,
    `RegionTooLargeMixin`, the four fetch autoruns, and `rpcProps()`→refetch
    wiring).
  - Compose `GlobalDataDisplayMixin()` for displays that hold a single
    non-regional dataset (HiC contact matrix, LD triangle, variant matrix).
    Same slot mixin + `FetchMixin` + `RegionTooLargeMixin` plumbing, but
    **no** fetch autoruns — each display installs its own `afterAttach`
    autorun expressing its trigger conditions (e.g. HiC: viewport change;
    LD: viewport + `showLDTriangle` + …).
  - Compose `RenderLifecycleMixin()` directly only when neither
    fetch surface is needed (rare — most GPU displays fetch something).
  - Add a cached `renderState` view.
  - Define `startRenderingBackend(backend)` calling
    `self.attachRenderingBackend(backend, { upload, render })`.
  - Expose `rpcProps()`; add `gpuProps()` only when main thread encodes GPU
    buffers from settings.
- **React component** — `observer()`. Render the canvas through the shared
  `DisplayChrome` (from `@jbrowse/plugin-linear-genome-view`), passing the model
  and the renderer `factory`. `DisplayChrome` calls `useRenderingBackend`
  internally and owns the render-error / region-too-large / error-bar / loading
  overlays (all read off the model), so the component only lays out its own
  canvas(es) via the render-prop child:
  ```tsx
  return (
    <DisplayChrome
      model={model}
      factory={MyRenderer}
      testid="my-display"
      style={{ width, height }}
    >
      {({ canvasRef }) => <canvas ref={canvasRef} />}
    </DisplayChrome>
  )
  ```
- **Wiggle-style displays** — compose `linearWiggleDisplayModelFactory` from
  `@jbrowse/plugin-wiggle` and implement `WiggleRenderingBackend` (typed from
  `@jbrowse/wiggle-core`). Override `isCacheValid` to `() => true` if the
  display is zoom-independent. See plugins/gwas.
- **Tests** — unit (`MockHal`); browser (Puppeteer, `--backend=webgl|webgpu|canvas2d`).

---

## What NOT to do

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` —
  it belongs in the MST autorun pair spawned by `attachRenderingBackend`.
- Don't destructure model methods; call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't cache per-region data on a renderer class (`private regions = new Map<number, ...>()`).
  The model's `rpcDataMap` / `laidOutDataMap` is the single source of truth;
  pass it into `renderBlocks(blocks, regions, state)` instead. For GPU buffer
  lifecycle delegate to `hal.pruneRegions(active)` rather than mirroring HAL's
  region map. See `PerRegionRenderingBackend` in `@jbrowse/core/gpu/perRegionRenderingBackend`.
- Don't add or redefine volatiles/actions owned by the slot mixin
  (`canvasDrawn`, `renderTick`, `currentRenderingBackend`, `markCanvasDrawn`,
  `resetCanvasDrawn`, `renderNow`, `stopRenderingBackend`, etc.) or the
  `isReady` view owned by `MultiRegionDisplayMixin`.
- Don't hand-edit `*.generated.ts` or hand-maintain WGSL/GLSL/offset tables
  next to generated modules. Edit `.slang` source and run `pnpm gen:shaders`;
  CI's `git diff --exit-code` catches stale outputs. Consume generated
  constants (`FIELD_OFFSET_F32.x`, `INSTANCE_STRIDE_BYTES`, `UniformOffsets.y`,
  etc.) by name from TS — never copy a literal offset into a renderer.
- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps()` — `SettingsInvalidate` watches `rpcProps()` and calls
  `clearAllRpcData`, which clears the very data `rpcProps()` just read, creating
  an infinite fetch loop.
