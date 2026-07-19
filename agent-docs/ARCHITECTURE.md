---
name: architecture
description: GPU render lifecycle, HAL, Slang shaders, and the worker→main fetch pipeline. Read when touching a display, rendering backend, or shader.
---

# Architecture

The canonical reference for how JBrowse renders a track. Read the overview first
for the mental model, then jump to the section for whatever you're touching. Deep
subsystems that come up only on a specific task live in their own docs, collected
under [See also](#see-also) at the end.

## Overview

A **display** is the object that draws one track inside a view — the pileup in an
alignments track, the bars in a wiggle track, the matrix in a Hi-C track. Every
display, whatever it draws, follows the same three-part shape:

- **Workers fetch, the main thread renders.** Data is loaded and parsed in an RPC
  worker, off the UI thread. The worker returns feature data as **absolute
  genomic coordinates** — uint32 base positions, never pixels and never
  region-relative offsets — so the same data stays valid as the user pans and
  zooms.
- **The main thread uploads once, then redraws every frame.** An MST model holds
  the worker's output in an observable map. Two MobX autoruns watch it: one
  *uploads* the bytes to the GPU when the data changes, one *renders* a frame
  when anything visible changes. Pan and zoom become a cheap redraw of buffers
  already on the GPU, not a refetch.
- **Three interchangeable backends.** Rendering targets WebGPU first, falls back
  to WebGL2, then to Canvas2D, chosen at runtime behind a hardware abstraction
  layer (HAL). Every display **must** provide a Canvas2D draw function; the GPU
  shader path is an optional accelerator layered on top. **SVG export runs the
  Canvas2D path**, so on-screen and exported pixels can't drift.

```
worker:  adapter → features            (absolute uint32 bp)
                     │  RPC, off the UI thread
                     ▼
main:    model.rpcDataMap              (MST node, observable)
                     │  upload autorun — fires when the data changes
                     ▼
         GPU buffers                   (HAL: WebGPU → WebGL2 → Canvas2D)
                     │  render autorun — fires every frame
                     ▼
         <canvas> on screen

         SVG export reuses the same Canvas2D draw fn — never the shader.
```

That inversion — the worker ships coordinates, not rendered images — is the whole
point of the GPU pipeline.

## Vocabulary

Terms used throughout this doc:

- **Display** — draws one track in one view. Composed from MST mixins that supply
  its behavior (fetch, render lifecycle, height). The subject of most of this doc.
- **Backend** — the per-display object that actually draws, either GPU
  (`GpuXxxRenderer`) or Canvas2D (`Canvas2DXxxRenderer`), produced by a factory
  that picks one at runtime.
- **Region / block** — the visible genome is split into regions
  (`view.displayedRegions`) and finer render blocks; a display fetches and draws
  per region. `displayedRegionIndex` is the join key between the model's data map
  and the GPU buffers.
- **HAL** — hardware abstraction layer; hides the WebGPU-vs-WebGL2 difference.
- **RPC / worker** — the off-thread context where adapters fetch and parse data.
- **MST model / autorun** — a display is a `mobx-state-tree` node; `autorun` is
  the MobX primitive that re-runs a function whenever the observables it read
  change.

## How this doc is organized

- **Display stacks** — which foundation mixins a display composes.
- **Data fetching pipeline** — the fetch autoruns, the region-too-large gate, and
  the refetch-loop traps.
- **GPU rendering architecture** — the lifecycle in depth: the mixin, the
  upload/render autoruns, the per-plugin backends, the three upload patterns, the
  HAL, and shaders.
- **Adding a new GPU display type** — the checklist.
- **What NOT to do** — the invariants, as a quick-scan list.

**Public developer guides mirror this spec.** The hand-written walkthroughs at
[website/docs/developer_guides/plotting_features.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/plotting_features.md)
(Canvas2D),
[creating_gpu_display.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
(GPU), and
[data_fetching.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
turn the sections below into step-by-step tutorials and link back to them. When
the lifecycle, mixins, or upload patterns here change, update those guides in
the same pass — `pnpm check-doc-imports` validates the cross-links both ways but
not the prose.

---

## Display stacks

**What this section answers: which mixins do I compose to build a display, and
why?** Linear-genome-view displays are built from a small set of **foundation
mixins** on `BaseDisplay` (they all share `baseLinearDisplayConfigSchema` as their
config base). Which mixins a display composes is the primary axis of code
sharing; *how* it renders (GPU vs Canvas2D) is a separate axis layered on top.
Two fetch foundations — per-region (`MultiRegionDisplayMixin`) and single-global
(`GlobalFetchMixin`) — cover every in-tree display:

| Foundation (composed on `BaseDisplay`) | Brings | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RenderLifecycleMixin` + `FetchMixin` + `RegionTooLargeMixin` + the five fetch autoruns + `rpcProps()`→refetch wiring | `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `LinearManhattanDisplay`, `LinearAlignmentsDisplay`, both multi-sample variant displays, `LinearReferenceSequenceDisplay`, plus the canvas displays (via `LinearCanvasBaseDisplay` — see below) |
| `GlobalDataDisplayMixin()` = `GlobalFetchMixin()` + `RenderLifecycleMixin` | the single-global fetch foundation **plus** GPU render lifecycle + `displayPhase`; **no** fetch autoruns (each display installs its own `afterAttach` autorun via `installGlobalFetchAutorun`) | HiC (`LinearHicDisplay`), LD (`plugins/variants/src/LDDisplay`) |
| `GlobalFetchMixin()` bare (via arc's `ArcFetchModel`) + main-thread SVG render | the same fetch foundation (`RegionTooLargeMixin` + `FetchMixin` + `reloadCounter`) with **no** `RenderLifecycleMixin` — a non-GPU display shouldn't drag in the render lifecycle to get fetch/cancel/too-large/reload | `LinearArcDisplay`, `LinearPairedArcDisplay` |

`GlobalFetchMixin` is the rendering-agnostic fetch foundation shared by the last
two rows: GPU global displays layer `RenderLifecycleMixin` on top of it
(`GlobalDataDisplayMixin`), while arc composes it bare and paints main-thread SVG.
`displayPhase` lives in `GlobalDataDisplayMixin`, not `GlobalFetchMixin`, because
it reads `renderError` — the one genuinely GPU-only piece. `RegionTooLargeMixin`'s
gate is derived and opt-in; arc's `ArcFetchModel` enables it like every other
byte-gated display (see "The derived region-too-large gate").

`LinearCanvasBaseDisplay` (plugins/canvas) is **not** a peer of these. It is a
canvas-feature *specialization layered on `MultiRegionDisplayMixin`*, and only
`LinearBasicDisplay` + `LinearVariantDisplay` extend it. Wiggle, Manhattan, and
alignments compose `MultiRegionDisplayMixin` directly; they render on the GPU but
share no state model with canvas.

**Render path is a separate axis.** GPU-canvas vs Canvas2D is chosen per frame at
the backend factory (see "RenderingBackend interfaces per plugin"), not by which
foundation a display composes.

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally, matching
BED/BAM. Worker output is **absolute genomic uint32** — no regionStart-relative
arithmetic crosses the worker boundary. The precision machinery that makes this
work on a float32 GPU is in [reference/BP_PRECISION.md](reference/BP_PRECISION.md).

---

## Data fetching pipeline

The public
[data fetching pipeline guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
is the tutorial version of this section (the `fetchNeeded` → `fetchEachRegion`
wrapper, `rpcProps`, cancellation, byte gate).

`MultiRegionDisplayMixin` (in
`plugins/linear-genome-view/src/BaseLinearDisplay/`) drives RPC fetches for all
LGV displays (alignments, canvas, wiggle, variants) via five autoruns:

| Autorun | Trigger | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` change | `clearAllRpcData()` |
| `FetchVisibleRegions` | viewport / `fetchGeneration` (600ms debounce) | `fetchNeeded(needed)` for uncovered buffered regions; gated by `error`/`regionTooLarge` |
| `SettingsInvalidate` | `rpcProps()` change | `clearAllRpcData()` |
| `ClearBlockingStateOnViewportChange` | viewport change while `error` or `fetchCanceled` is set | `clearAllRpcData()` to unblock retry (the derived `regionTooLarge` self-releases, so it's not part of this) |
| `ClearHoverOnRegionTooLarge` | `regionTooLarge` becomes true | fires the overridable `onRegionTooLarge()` hook (no-op base; alignments clears its hover) |

Subclasses override `fetchNeeded` to call `self.fetchRegions(needed, work)`.
`fetchRegions` runs an optional pre-flight byte estimate (via
`getByteEstimateConfig` → `checkByteEstimate` → the `CoreGetFeatureDensityStats`
RPC) before invoking the work callback. Oversize regions surface a banner:
`DisplayChrome` renders `TooLargeMessage` from the model's
`regionTooLargeReason`.

The `error`/`fetchCanceled` reads in `ClearBlockingStateOnViewportChange` are
`untracked` for correctness — tracking either would let `set…` re-fire the
autorun and wipe the flag before any viewport change.

### The byte gate, and why canvas folds it into the fetch

**Canvas opts out of the pre-flight** (`getByteEstimateConfig` returns `null`).
A second estimate RPC racing the per-region feature fetch is exactly the
two-call coordination we avoid. Instead canvas folds the byte check into the
feature-fetch RPC: `executeRenderFeatureData` calls the adapter's
`getRegionByteSize` (an index-only estimate, no feature download — default
`undefined` on `BaseFeatureDataAdapter`, overridden by tabix adapters) and
short-circuits an over-budget region *before* `getFeaturesArray`, returning
`{ regionTooLarge, bytes }`.

This makes the byte gate symmetric with the density gate, which already
short-circuits in-RPC returning `{ regionTooLarge, featureCount }`. A
whole-genome fan-out then costs one cheap index read per chromosome instead of
downloading every chromosome's features.

`applyFetchResults` records the per-region `bytes` **max**, not the sum, into
`featureDensityStats`. Each region is gated against the same per-region budget,
so a multi-region view where every region individually fits is never blanked just
because the cross-region total exceeds one region's budget. The budget comes from
the display's `byteSizeLimit()` (`userByteSizeLimit ?? fetchSizeLimit`, only in
the force-load zone).

### The derived region-too-large gate

`regionTooLarge` raises the "region too large" banner and holds off the fetch.
It's a **derived** getter on `RegionTooLargeMixin` — a pure function of the
cached byte estimate scaled to the current viewport — so it self-releases on
zoom-in without an imperative clear and doesn't flicker on pan. The old
`setRegionTooLarge` volatile-flag path was removed once every byte-gated display
went derived; the mixin now owns the whole gate, and displays opt in through
hooks rather than shadowing the getter per display.

A byte-gated display opts in by overriding hooks on `RegionTooLargeMixin`:

- `derivedRegionTooLargeEnabled` → `true`. Left false (wiggle, Manhattan,
  sequence, synteny, HiC), `regionTooLarge` is a literal `false` and the LGV-only
  `tooLargeStatus` getters below are never evaluated — so a non-byte or non-LGV
  consumer of the mixin never reads `view.visibleBp`.
- `configuredFetchSizeLimit` → `getConf(self, 'fetchSizeLimit')` (the mixin owns
  no `configuration`).
- `densityTooLargeForDerivedGate` → a second gating axis, if any. Canvas folds
  its feature-density gate in here; byte-only displays (alignments, maf, LD, arc,
  multi-sample-variant) leave it false.

How the verdict is built (all in `RegionTooLargeMixin`):

- `setFeatureDensityStats(stats)` commits the estimate AND records the span it was
  measured at (`byteEstimateVisibleBp = view.visibleBp`). The estimate arrives
  from the `fetchRegions` pre-flight (maf/alignments/multi-sample-variant, via
  `getByteEstimateConfig` → `checkByteEstimate`) or, for canvas, from
  `applyFetchResults` folding the byte check into the feature RPC (per-region
  `bytes` **max**, not sum, so a multi-region view where each region fits isn't
  blanked by the cross-region total).
- `estimatedVisibleBytes` rescales the captured estimate to the current span
  (`bytes × view.visibleBp / byteEstimateVisibleBp`), so the byte gate is a pure
  function of the view and self-releases on zoom-in. Gate on this, never raw
  `bytes` — a raw read never shrinks on zoom-in, so the banner would never clear.
  Guarded on `view.initialized`: a bare getter must never throw, and `visibleBp`
  reads `view.width`, which throws pre-init.
- `tooLargeStatus` feeds the scaled estimate + `densityTooLargeForDerivedGate` to
  the shared `evaluateRegionTooLarge` verdict; `regionTooLarge` /
  `regionTooLargeReason` read it.
- `fetchRegions` short-circuits on `self.regionTooLarge` immediately after
  `setFeatureDensityStats` — the capture span *is* the current viewport, so the
  derived verdict already reflects the just-captured estimate. No imperative flag,
  and `FetchVisibleRegions` re-fires (it reads `regionTooLarge`) the moment a
  zoom-in flips it false, opening the gate.

The estimate survives `clearAllRpcData()` (it isn't in `clearDisplaySpecificData`),
so a viewport-change clear doesn't flicker the banner — `ClearBlockingStateOnViewportChange`
no longer touches `regionTooLarge` at all (self-release replaces it). Only
chromosome navigation drops the estimate, via each display's
`onDisplayedRegionsChange(self, () => self.setFeatureDensityStats(undefined))` —
`displayedRegionIndex` is reused across chromosomes, so a stale estimate would
gate the new region against the wrong stats. (Canvas also clears its
`densityStatsPerRegion` there; `laidOutDataMap` returns empty while
`regionTooLarge`, so the GPU upload pushes nothing — no stale-feature flash.)

`regionTooLarge` becoming true fires the overridable `onRegionTooLarge()` hook
(via the `ClearHoverOnRegionTooLarge` autorun); alignments overrides it to clear
its hover, since the banner replaces the pileup.
`regionCannotBeRenderedText()` reads through `self.regionTooLarge`, so the banner
UI and SVG-export text stay in agreement.

### Shared decision primitives

The derived gate and canvas's in-RPC byte short-circuit diverge only in *how*
they measure bytes/density. The verdict, threshold, and banner text are unified
in `shared/featureDensityUtils.ts` so they can't drift:

- `resolveByteLimit({ userByteSizeLimit, adapterFetchSizeLimit, configFetchSizeLimit })`
  — the one byte-budget resolution. A non-positive adapter limit means "no
  opinion" and is skipped (guards both `0` and a negative sentinel).
- `bytesTooLargeReason(bytes)` / `TOO_MANY_FEATURES_REASON` — the one source for
  the two banner strings.
- `evaluateRegionTooLarge({ visibleBp, bytes, byteLimit, densityTooLarge, alwaysRender })`
  — the canonical verdict + reason. An `alwaysRender` adapter never gates
  (checked first); below `AUTO_FORCE_LOAD_BP` nothing gates; else bytes-over-limit
  takes precedence over density. `densityTooLarge` is **opt-in**, so byte-only
  displays (alignments, LD) pass only bytes and never gate on density.
  `alwaysRender` is the self-summarizing-adapter escape hatch: adapters that cap
  returned data at screen resolution (BigWig, HiC, BigMaf, MultiWiggle) report
  `{ alwaysRender: true }` from `getMultiRegionFeatureDensityStats`, so no region is ever too
  large no matter how wide the view.

Variants are monolithic: `MultiSampleVariantGetCellData` returns one batched
payload covering all visible regions, so variants' `fetchNeeded` expands `needed`
to all `bufferedVisibleRegions` and marks them all loaded together when the work
callback returns.

### Terminal states early-return their own root

`DisplayChrome` branches on `model.displayPhase`. For the `renderError` /
`tooLarge` banners it **early-`return`s** the banner as its *entire* output,
replacing the display subtree — rather than keeping the container `<div>` mounted
and swapping the banner in beside the canvas. This looks like a leak (the caller's
`className`/`ref`/mouse handlers are absent in those two states) but the leak is
benign: a too-large region has no canvas to interact with, and the ref
re-attaches on force-load. Three things make this the right shape:

- **Clean GPU dispose/re-init.** Early-`return` unmounts the canvas subtree,
  which fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
  `stopRenderingBackend()`; force-load remounts and re-inits via the callback
  ref. Nesting the banner beside a still-mounted canvas would skip that cycle.
  Unmounting is safe precisely because that full dispose→re-init cycle runs.
- **The loading term stays lazy.** `computeDisplayPhase(self, loading)` takes
  `loading` as a **thunk** and calls it only after ruling out the terminal flags,
  so when a banner is up the chrome's observer tracks only that flag — not the
  view's churning `visibleRegions`/`loadedRegions`.
- **React Compiler opt-out.** `DisplayChromeInner` carries `'use no memo'`, so
  babel-plugin-react-compiler doesn't compile it and can't memoize a MobX read on
  `model`'s stable identity. Full analysis:
  `COMPILER_TERNARY_FINDING.md`.

### `rpcProps()` loop trap and how to break it

Including any fetch-result derivative in `rpcProps()` creates an infinite loop:

```
setCellData → <derived value> changes → rpcProps() changes
  → SettingsInvalidate → clearAllRpcData → cellData cleared
  → <derived value> changes → rpcProps() changes → …
```

The fix is to split the computation: `rpcProps()` gets a cache-key version
computed from user-controlled inputs only; any part that needs fetch-result data
is kept in a separate view used only for rendering or passed directly to the
server.

In the variant case, `rpcProps().sources` calls `getSources` with
`renderingMode: 'alleleCount'` internally so haplotype expansion (which needs
`sampleInfo`) is never triggered. The client's `sources` view still reads
`sampleInfo` for rendering — safe because it is not in `rpcProps()`. The server
receives the unexpanded sources and expands them after computing `sampleInfo`
from features; sources from clustering already carry `HP` and pass through
unchanged.

**Rule:** `rpcProps()` must contain only user-controlled settings. Never include
`cellData`, `sampleInfo`, or any getter that reads them. See
`plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` for the overridable
hook list and test-file mapping.

### Sequence-adapter injection is instance-primed and order-dependent

BAM/CRAM decode against the reference (CRAM to reconstruct bases, BAM to compute
mismatches without an MD tag), but a track's adapter config doesn't carry the
reference — it belongs to the assembly. So the assembly's sequence adapter config
rides **alongside** `adapterConfig` as a sibling RPC arg (never spliced into it)
and is stashed on the resolved adapter instance via `setSequenceAdapterConfig`;
the adapter lazily builds it through `getSubAdapter` on first
`getSequenceAdapter()`. Client side, `getSequenceAdapterConfig(assembly)` (in
`assemblyManager/assembly.ts`) produces the snapshot; worker side,
`getFeatureAdapter()` (in `data_adapters/getFeatureAdapter.ts`) is the shared
prologue that resolves the feature adapter and primes it in one step.

The subtlety: **the adapter cache (`dataAdapterCache`) keys on `adapterConfig`
alone, not on the sequence adapter.** So the *first* RPC to resolve a given
adapter primes its sequence config for the lifetime of that cached instance
(`setSequenceAdapterConfig` is set-once). This is why `CoreGetRefNames` — usually
the first call for a track — passes it, and why every reference-needing fetch also
passes it rather than relying on ordering. A fetch that legitimately doesn't need
the reference (e.g. `PileupGetGlobalValueForTag`, which reads BAM tags directly)
omits it.

**Invariant: any feature RPC that decodes against the reference must pass
`sequenceAdapter`.** Don't assume a prior call primed the instance. Note that
`setSequenceAdapterConfig` does **not** propagate through wrapper adapters (there
is no wrapper-over-BAM/CRAM today; if one is reintroduced, plumb inheritance
through `getSubAdapter`).

## Status / progress reporting

Loading status travels from workers to the loading UI over one out-of-band
channel (`statusCallback`), with helpers for determinate bars, concurrent-fetch
aggregation, and durable cancel. Full detail:
[reference/PROGRESS_REPORTING.md](reference/PROGRESS_REPORTING.md).

---

## GPU rendering architecture

### Package layout

The rendering primitives live in **`@jbrowse/render-core`**
(`packages/render-core`): the HAL, `RenderLifecycleMixin`, the backend base
classes, the React backend hooks, and the clip/canvas/hp-math utilities. It is a
leaf package (deps: `mobx` + `@jbrowse/mobx-state-tree` + `react` peer; **no**
`@jbrowse/core`), so a third-party display can depend on it directly.

Shader codegen (`packages/shader-tools/src/build-shaders.ts`, plus `slangPass` in
render-core) and the display-integration layer (`MultiRegionDisplayMixin` /
`GlobalDataDisplayMixin` / `DisplayChrome`, in the LGV plugin) stay where they
are. Per-display shaders/passes live per-plugin under
`plugins/<plugin>/src/<display>/{shaders,passes}`. The GPU API is
**static-import-only** — never exposed via the runtime `ReExports` registry. See
ADR-030.

HAL is the hardware abstraction layer (WebGL2 vs WebGPU). Full vocabulary +
Canvas2D→GPU primer: [reference/GPU_GLOSSARY.md](reference/GPU_GLOSSARY.md).

### The core contract

Each GPU display is an MST model that composes `RenderLifecycleMixin` and calls
`self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied to
the model's lifetime — one runs `upload(backend)`, one runs `render(backend)`.
MobX auto-tracks every observable read inside each callback, so changes re-fire
the right autorun with no manual dependency declarations. React components are
thin bridges: create a canvas, hand the backend to the model via
`useRenderingBackend`, render JSX.

### The API

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
      // isReady becomes true once isLoading also clears
    },
  })
}
```

### What the mixin owns

```
RenderLifecycleMixin
  .volatile
    canvasDrawn: boolean          set true only after render() returns true with real data
    currentRenderingBackend       stored backend; autoruns read it each tick
    renderTick: number            bumped by renderNow() and after every upload
    autorunsInstalled: boolean    guards attachRenderingBackend (idempotent)
    renderError: unknown          render-backend init / context-loss error; single source for the 'renderError' terminal phase
  .actions
    markCanvasDrawn()             idempotent flip to true
    resetCanvasDrawn()            flip to false (called by clearAllRpcData)
    stopRenderingBackend()        clears currentRenderingBackend + resets canvasDrawn → autoruns idle
    renderNow()                   bumps renderTick → render autorun re-fires
    setRenderError(error)         set/clear renderError
    attachRenderingBackend(b, cbs) spawns upload + render autoruns (once)

MultiRegionDisplayMixin  (composes RenderLifecycleMixin)
  .views
    isReady: boolean              canvasDrawn && !isLoading
    viewportWithinLoadedData      every visible block ⊆ a loaded region
    displayPhase                  'renderError' | 'tooLarge' | 'error' | 'loading' | 'ready'
                                  computeDisplayPhase(self, () => !isReady || !viewportWithinLoadedData)
```

Loading-scrim visibility is derived once by `DisplayChrome` as `displayPhase ===
'loading'` and passed to `DisplayLoadingOverlay` as a `visible` prop — not
re-encoded per model.

Every display renders its canvas through the shared `DisplayChrome`, which calls
`useRenderingBackend(factory, model)` internally — the backend hook lives in
exactly one place, so a display can't bury it where the chrome can't see it. The
chrome owns every terminal state via the single `displayPhase` getter (precedence
single-sourced in `computeDisplayPhase`, `@jbrowse/render-core/displayPhase`):
`renderError` and `tooLarge` early-`return` their own component; `error` +
`loading` are overlays drawn over the still-mounted canvas. It takes a render-prop
child `({ canvasRef, canvas }) => ReactNode`, so it's agnostic to how many
canvases a display draws; pass a `testid` base and the chrome appends `-done`
once `canvasDrawn` flips.

The `loading` phase folds in both fetch- and paint-readiness. `isReady` covers
track-open through the fetch cycle (hiding once the first frame paints);
`viewportWithinLoadedData` re-shows the overlay when the viewport extends past
loaded data — e.g. the pre-refetch debounce after a zoom-out, where `isReady` is
already true but stale data is still on screen (separate getter for tracking
reasons — see BaseLinearDisplay/CLAUDE.md). `stopRenderingBackend` resets
`canvasDrawn` so the overlay recovers after WebGL context loss.

`GlobalDataDisplayMixin`'s `loading` term is
`isLoading || fetchCanceled || (rendersCanvas && !canvasDrawn)`. The last clause is
the global-display equivalent of MultiRegion's `!isReady`, covering the window
between component mount and `isLoading` flipping true. On HiC that window is real:
the fetch can't start until `CoreGetInfo` resolves the file's resolution list
(that RPC is also what makes the resolution/norm overlay panel appear before
anything else), so `isLoading` is false with nothing painted for the length of
that round-trip — without `!canvasDrawn` the track reads as blank there. It does
NOT fold in a `dataLoaded`/`viewportWithinLoadedData` staleness axis the way
MultiRegion does — global displays keep the last frame up during a refetch
(StaleViewportRescaleMixin rescales it), so a pan/zoom shows no scrim beyond the
existing `isLoading` window. `rendersCanvas` (default true) gates the clause so a
display showing a static non-canvas placeholder (LD with `showLDTriangle` off →
EmptyState, no canvas) doesn't sit permanently under the scrim.

`installGlobalFetchAutorun` schedules **leading-edge**: the first fetch fires
immediately, and only subsequent (zoom/pan/settings) refetches debounce by
`delay`. MobX's built-in `{ delay }` is trailing-only — it defers even the
initial run via `setTimeout`, so on cold open the first data (and `isLoading`)
would wait a full `delay` for no interaction to coalesce, stacking on top of the
`CoreGetInfo` RTT. A `primed` flag (flipped once a fetch actually runs) drives a
custom `scheduler` that runs immediately until then; matters for cold-open
latency and render benchmarks.

All backend-specific plumbing lives in the plugin; all reactivity plumbing lives
in the mixin.

### Life of a frame

- React hook (`useRenderingBackend`) mounts, creates the HAL, resolves a backend,
  calls `model.startRenderingBackend(backend)`.
- Mixin sets `currentRenderingBackend = backend`, spawns two autoruns via
  `addDisposer(self, autorun(...))`.
- Upload autorun fires: reads `currentRenderingBackend`, calls `cbs.upload(b)`,
  bumps `renderTick` so render re-fires after any upload.
- Render autorun fires: reads `currentRenderingBackend` + `renderTick`, calls
  `cbs.render(b)`. If it returns `true`, flips `canvasDrawn` to `true`.
  `clearAllRpcData` resets `canvasDrawn = false` so the flag is only set after the
  canvas has real content.
- Any observable touched by `upload` or `render` becomes a dep — when it changes,
  MobX re-fires that autorun. No manual invalidation.

**Context-loss recovery.** GPU contexts can be lost. `useRenderingBackend` listens
for `webglcontextlost`/`restored` and `device.lost`, rebuilds the backend, and
calls `model.startRenderingBackend(newBackend)`. The mixin sees
`autorunsInstalled === true`, skips re-installation, and just reassigns
`currentRenderingBackend`. Both autoruns re-fire against the new backend. No
special code path.

**Tab visibility.** `useTabVisibilityRerender` calls `model.renderNow()` on
`visibilitychange`, bumping `renderTick`. WebGPU swap-chain textures are reissued
by the `render` callback.

### RenderingBackend interfaces per plugin

Each plugin defines its own `RenderingBackend` type and a factory that produces
either a GPU or a Canvas2D implementation:

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

`createRenderingBackend` calls `createGpuHal`; if a HAL is returned the GPU
backend is constructed, otherwise Canvas2D.

#### Canvas2D is the floor; GPU is the optional accelerator

Every display **must** ship a Canvas2D draw function regardless — SVG export goes
through it (see [reference/SVG_EXPORT.md](reference/SVG_EXPORT.md)). The GPU shader
path is an *optional accelerator* for displays whose feature counts demand it
(≳100K features/frame — RFC-001 §3a). So a display whose data is always
gene-scale / low-density / text can be **Canvas2D-only**: it writes no `.slang`,
no `GpuXxxRenderer`, no pass list. Its factory skips the HAL ladder and returns
the Canvas2D backend directly:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DXxxRenderer(c))
}
```

The backend plugs into the same `RenderLifecycleMixin` / `DisplayChrome`
machinery — the lifecycle is backend-agnostic, so nothing downstream knows
there's no HAL. Reference: `plugins/sequence`'s `SequenceRenderer`. Start here for
any new display; promote to the dual-path `createRenderingBackend` only when a
profile shows Canvas2D can't hold 60fps at the display's real feature counts.

#### Keeping the two backends in parity

A dual-path display renders the same pixels two ways (`.slang` shader vs a
Canvas2D draw fn), and SVG export runs the Canvas2D path — so a shader-only tweak
silently diverges the export. Parity is kept by construction, not vigilance. When
touching either path, preserve whichever of these the display uses:

- **Constants live in the shader, TS re-exports them.** `//! export-consts:` in a
  `.slang` emits the value into its `*.generated.ts`; the Canvas2D side imports it
  (e.g. `sharedRendererConstants.ts` pulls `MIN_RECT_WIDTH_PX`, `CHEVRON_*`,
  `MIN_DENSITY_ALPHA`). Never retype a shader constant as a TS literal.
- **One draw helper, both consumers.** Marker/glyph geometry and color math that
  both paths (or the on-screen overlay + SVG export) need lives in one function:
  `drawMafInsertionMarker`, `appendPointMarker` (wiggle scatter + Manhattan),
  `mapHicCount`, synteny's `syntenyPickEngine` geometry. Change the shared fn,
  not one caller.
- **One registry, exhaustively keyed.** Multi-layer displays list
  layers/z-order/gating once and map each id to a per-backend mechanism through a
  `Record<LayerId, …>` in *both* renderers (alignments' `PILEUP_LAYERS` →
  `GPU_PILEUP_PASS` and a Canvas2D draw-fn map). The exhaustive Record makes a
  half-added layer a compile error; `coverageParity.test.ts` cross-checks output.
- **`SYNC:` comments anchor formulas.** Where a value must match across files
  (synteny's `WIDTH_FADE_FLOOR`, the 0.7-darken / ×5-cap-0.35 hover shade), a
  `SYNC:`/`mirrors` comment names the counterpart. Grep the tag before editing
  either side.

**Intentional divergences — do NOT "fix" these into parity.** The two backends
legitimately differ where GPU rasterization is watertight but Canvas2D
antialiases each primitive independently. Canvas2D adds a sub-pixel *overdraw* to
close seams the GPU never produces (`WIGGLE_FUDGE_FACTOR` 0.8px, the
variant-matrix `f2`), and swaps a thin fill for a 1px centerline stroke (synteny
sub-pixel ribbons); the shader instead scales coverage alpha. These are
per-backend AA compensation, not drift — a shader has no equivalent to a Canvas2D
fudge factor, and porting one in over-widens GPU glyphs. Min-width floors, by
contrast, *are* mirrored (both clamp to the same px) — those keep sub-pixel
features visible and must stay in step.

#### Shared per-region streamed contract

Per-region streamed plugins (canvas, manhattan, MAF, multi-variant, wiggle)
specialize one generic type and inherit from one of two abstract base classes in
`@jbrowse/render-core/perRegionRenderingBackend`:

```ts
// Plugin specializes the interface (used in model + React code):
export type XxxRenderingBackend = PerRegionRenderingBackend<XxxUploadData, XxxRenderState>

// GPU renderer implements uploadRegion + renderBlocks:
export class GpuXxxRenderer extends GpuPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  constructor(hal: GpuHal) { super(hal, XXX_UNIFORM_BYTE_SIZE) }
  uploadRegion(idx, data) { … }
  renderBlocks(blocks, regions, state) { … }
}

// Canvas2D renderer implements renderBlocks only:
export class Canvas2DXxxRenderer extends Canvas2DPerRegionRenderingBackend<XxxUploadData, XxxRenderState> {
  renderBlocks(blocks, regions, state) { … }
}
```

The bases own everything that's truly shared:

- `Canvas2DPerRegionRenderingBackend` owns `canvas` + `ctx` (constructor throws if
  no 2D context) and stubs `uploadRegion` / `pruneRegions` / `dispose` as no-ops,
  since the source of truth is the `regions` map.
- `GpuPerRegionRenderingBackend` owns the `hal` reference and a pre-allocated
  uniform scratch `ArrayBuffer`. Default `pruneRegions(active)` delegates to
  `hal.pruneRegions(active)`; default `dispose()` calls `hal.dispose()`.

Two invariants keep the renderer implementations small and uniform:

- `renderBlocks` receives the model's data map as its second argument — the
  renderer holds no `Map<number, ...>` field of its own. GPU buffer lifecycle
  delegates to `hal.pruneRegions(active)`; Canvas2D backends read everything from
  `regions` at render time.
- `hal.drawPass` short-circuits when the region has no buffer for that pass, so
  GPU renderers issue draws unconditionally — no per-region flag cache.

For MAF, `UploadData` and `RenderData` diverge. The upload payload
(`MafUploadPayload`) carries only the pre-encoded GPU buffer (`{ instanceBuffer,
instanceCount }`); the render side reads the raw `MafRegionData` from the model's
`rpcDataMap` (so Canvas2D can draw it and the GPU path can check presence).
`PerRegionRenderingBackend`'s optional fourth type param `RenderData` (defaults to
`UploadData`) expresses this split — shared with `LinearMultiRowFeatureDisplay`;
most per-region plugins keep the default.

Whole-map synced (alignments, multi-LGV synteny) and monolithic (HiC, LD,
multi-variant-matrix, dotplot) plugins define their own backend interfaces
because their upload shapes differ — see "Three upload patterns."

#### Wiggle-family contract

Wiggle-style per-position GPU displays (wiggle, multi-wiggle, Manhattan) share
types and scale utilities across two packages:

`@jbrowse/wiggle-core` — the cross-plugin contract. Import types and pure
utilities from here so new plugins don't drag in the wiggle plugin's MST
factories or RPC methods:

- `renderingBackendTypes.ts` — `WiggleRenderingBackend`, `WiggleGPURenderState`, `SourceRenderData`
- `dataTypes.ts` — `WiggleDataResult`, `WiggleSourceData`, `WiggleFeatureArrays`
- `normalize.ts` — `SCALE_TYPE_LOG`/`LINEAR`, `scaleTypeFromString`, `makeScoreNormalizer`
- `displayModel.ts` — `WiggleGpuDisplayModel<TRenderingBackend>`: model↔component contract
- `scale.ts` / `autoscale.ts` — `getNiceDomain`, `getScale`, autoscale helpers
- `scoreMenuItems.ts` — `makeScoreSubMenu(self, opts)` + `ScoreScaleModel`: the shared Score submenu

`@jbrowse/plugin-wiggle` — composable model pieces. These live in the plugin
because they depend on `BaseDisplay` / `MultiRegionDisplayMixin` and wire up RPC
methods:

- `linearWiggleDisplayConfigSchema` / `linearWiggleDisplayModelFactory` — the full
  LinearWiggleDisplay config + model. Composed **wholesale** by GC-content's
  `LinearGCContentDisplay`. The config schema is reused more widely (Manhattan
  extends it); the model factory is not.
- `WiggleScoreConfigMixin([...slots])` / `WiggleCommonMixin` — score/color config
  pieces composed à la carte by displays that build their own model.

GWAS's Manhattan does **not** compose `linearWiggleDisplayModelFactory`. It builds
its own model — `BaseDisplay` + `TrackHeightMixin()` + `MultiRegionDisplayMixin()`
+ `WiggleScoreConfigMixin()` (no args) — pulls score utilities and
`makeScoreSubMenu` from `@jbrowse/wiggle-core`, and extends
`linearWiggleDisplayConfigSchema` as its `baseConfiguration`. It ships its own
`GetManhattanData` RPC (per-feature points, not pre-binned density), implements
its own `ManhattanRenderingBackend` with its own pass, and is zoom-independent by
**never setting `loadedBpPerPx`** — the `isCacheValid` it inherits from
`WiggleScoreConfigMixin` short-circuits to `true` whenever `loadedBpPerPx` is
`undefined`, rather than by overriding `isCacheValid`. (The first fetch still
fires: `FetchVisibleRegions` gates it on `isBlockCovered` — empty `loadedRegions`
⇒ not covered ⇒ fetch — and only consults `isCacheValid` for covered blocks, so
an always-`true` `isCacheValid` suppresses only *re*-fetches.)

#### Three upload patterns

Per-LGV displays use one of three upload shapes. Pick the one that matches the
data shape, not the one your neighbour copied:

| Pattern | Upload methods | Render | Use when | Examples |
|---|---|---|---|---|
| **Per-region streamed** | `uploadRegion(idx, data)` + `pruneRegions(active)` | `renderBlocks(blocks, regions, state)` | each region's data is independent, reactive per-region updates | canvas, wiggle, multi-wiggle, MAF, manhattan, multi-variant |
| **Whole-map synced** | `sync(sources)` | `renderBlocks(blocks, state)` | per-region streams must rebuild coherently (main-thread cross-region Y layout), or encoder settings drive packing | alignments, multi-LGV synteny |
| **Monolithic** (base `GlobalRenderingBackend` / `GpuGlobalRenderingBackend`) | `uploadX(data)` | `render(state)` (no blocks) | display has no region partitioning (heatmaps spanning the whole view) | HiC, LD (both `GlobalDataDisplayMixin`); multi-variant matrix (monolithic backend but `MultiRegionDisplayMixin` fetch); dotplot (view-level `RenderLifecycleMixin`) |

MAF is **per-region streamed** (like canvas/wiggle), not whole-map synced. MAF
blocks are independent — no main-thread Y-layout couples adjacent regions — so
each region's upload re-encodes in isolation via `installPerRegionLifecycle`.
Alignments' whole-map sync exists *only* because pileup Y-rows must be assigned
consistently across multiple `displayedRegions` (a read spanning a region boundary
needs the same Y row in both), forcing the upload to rebuild the whole map
whenever any region's input changes. If a future MAF feature added cross-region
coupling it would move to whole-map synced — until then, per-region streamed is
the right shape.

All three patterns expose the same lifecycle (`attachRenderingBackend({ upload,
render })`); the difference is how the upload callback shovels bytes.

##### Per-region streamed: per-key autoruns (`installPerRegionLifecycle`)

**Plain English:** The naive implementation re-uploads every chromosome to the
GPU each time any chromosome finishes loading — 300 uploads instead of 24 for a
whole-genome wiggle track. The fix gives each chromosome its own tiny MobX
watcher. When chromosome 5 arrives, only chromosome 5's watcher fires and
uploads. When the user changes a color setting, all 24 watchers fire and all 24
re-upload — which is the right behavior.

Naive per-region upload iterates the full `rpcDataMap` inside the upload callback.
Because `for (const [k, v] of rpcDataMap)` makes MobX track the entire map, every
`rpcDataMap.set(key, data)` re-fires the autorun and re-uploads all N regions —
O(N²) total GPU uploads when N regions arrive sequentially.

**The fix lives in `@jbrowse/render-core/installPerRegionLifecycle`** and is used
by wiggle, multi-wiggle, manhattan, MAF, sequence, and canvas's
`LinearMultiRowFeatureDisplay` — **not** the canvas plugin's other display,
`LinearBasicDisplay`, whose whole-map Y-layout keeps it on the computed-map form
described below. ("canvas" in this doc names the plugin; its two displays sit on
opposite upload strategies, so they're always spelled out where they diverge.)
(The multi-variant displays are per-region
streamed too but hand-roll their upload loop.) Each plugin's
`startRenderingBackend` collapses to a single call:

```ts
startRenderingBackend(backend: XxxRenderingBackend) {
  installPerRegionLifecycle(
    self,
    self.rpcDataMap,
    backend,
    data => encode(data, self.gpuProps()),       // optional encode step
    (b, encoded) => {                             // render callback
      const state = self.xxxRenderState
      if (!state) return false
      b.renderBlocks(self.renderBlocks, /* rpcDataMap or `encoded` */, state)
      return true
    },
  )
}
```

The helper spawns one autorun per `rpcDataMap` key. When a new key arrives only
its autorun fires (O(1) upload). When an encoder-tracked observable changes
(theme, color, scale), all per-key autoruns fire (O(N) re-encode).

Key MobX fact: `ObservableMap.get(existingKey)` tracks `hasMap_.get(key)` (per-key
existence atom), not `keysAtom_`. Adding a new key fires `keysAtom_` (waking the
key-manager only) and that new key's `hasMap_` entry. Existing per-key autoruns
are **not** re-fired.

The helper also caches successful encode outputs in a `Map<number, Encoded>` and
passes it to the render callback — wiggle's renderer reads from this map because
its renderer is stateless; other callers ignore the arg and read `rpcDataMap`
directly. Cleanup is automatic via `addDisposer(self, …)`.

**Why the helper doesn't apply to `LinearBasicDisplay` / alignments:** Wiggle
uploads each chromosome independently. `LinearBasicDisplay` and alignments lay out
features into Y-rows across all loaded regions together (so a gene spanning two
adjacent regions ends
up on the same row in both). Any new arrival could in principle change the layout
of everything already loaded, so those paths route through a whole-map MobX
computed (`laidOutDataMap` / `laidOutPileupMap`) that invalidates whenever any
`rpcDataMap` entry changes. Per-key autoruns can't help: reading
`laidOutDataMap.get(key)` in a per-key autorun still tracks the whole-map computed
as a dependency, so all per-key autoruns re-fire on every arrival. (Cross-region
coupling is load-bearing: collapsed-intron views split one chromosome into many
small displayed regions, and a long gene spanning those chunks must hold the same
Y row in each. That's also why layout runs on the main thread — row assignment
needs the union of all visible regions' features, which only the main thread
sees.)

- **`LinearBasicDisplay`** is commonly a whole-genome gene track with N=24
  chromosomes (many more in collapsed-intron views), so the naive form is O(N²).
  This is fixed:
  `createIncrementalLayout` (`plugins/canvas/src/LinearBasicDisplay/layout.ts`)
  memoizes the pure `computeLaidOutData` **per ref-group** (`assembly:refName`).
  Layout is independent across chromosomes, so when one chromosome's data arrives
  only its group relays out; unchanged groups return their previous output objects
  *by reference*. The upload autorun compares each region's reference against a
  per-region `uploaded` map and re-uploads only the changed ones (still pruning
  against the full active set, resetting on backend swap so context-loss recovery
  re-uploads everything). Net: O(N) layout + GPU uploads as N chromosomes stream
  in. The memo is a per-instance volatile; mutating its internal cache is invisible
  to MobX, so reading it inside the `laidOutDataMap` computed stays pure. The
  stability unit is the ref-group, not the region, because collapsed-intron views
  split one chromosome into many displayed regions.
- **Alignments/synteny** keep the whole-map form. They are never shown at
  whole-genome scale (data density forces gene-level zoom, or synteny is
  pairwise), so N is typically 4–8 buffered regions. The same per-group memo would
  apply if the perceived cost grew; the extra wrinkle there is `laidOutPileupMap`'s
  cross-region chain-mode coupling (connecting lines / Flatbush), which would need
  to participate in the group-signature.

### SVG export

SVG export and on-screen rendering share the same pure Canvas2D draw functions,
so a shader-only tweak can't silently diverge the export. Every display's
`renderSvg.tsx` follows one shape: `await awaitSvgReady(model)`, then mount
`SvgChrome` (the single terminal-state gate) around a sync body that paints via
`paintLayer`. The full contract — the `svgReady`/`settled` freshness gates, the
one permitted TypeScript narrow, `paintLayer`'s raster-vs-vector dispatch, the
JSX-SVG exception classes, and model-scoped clip ids — is in
[reference/SVG_EXPORT.md](reference/SVG_EXPORT.md).

### `rpcProps()` / `gpuProps()` pattern

Domain-named methods that enumerate **what affects rendering output**. Both are
MST view methods (not getters), so subclasses extend them via the standard `super`
capture pattern, mirroring `renderProps`.

| Method | Consumer | Invalidation route |
| --- | --- | --- |
| `rpcProps()` | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | Mixin `SettingsInvalidate` autorun reads `void self.rpcProps()` → `clearAllRpcData` → refetch |
| `gpuProps()` | `buildSourceRenderData(data, self.gpuProps())` — encoder input | Upload callback reads it — MobX re-uploads without an RPC roundtrip |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap` | Upload autorun reads it — MobX re-uploads without an RPC roundtrip |
| `renderState` | `backend.render(state)` per frame | Render callback reads it — re-fires when deps shift |

`rpcProps()` returns **user-controlled settings only**. Structural args
(`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `sessionId`,
`stopToken`) are spread in at the RPC call site, keeping `rpcProps()` focused on
its purpose: cache keys for `SettingsInvalidate`. Every display follows the same
call shape:

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
defines its own typed shape; subclasses that layer on fields capture `super` and
spread:

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
would widen the typed return through MST's `.views()` chain and force consumers to
re-spread named fields. The mixin's `SettingsInvalidate` autorun looks up
`rpcProps` dynamically and is installed only when the method exists, so a
per-region display with no settings-driven refetch (e.g.
`LinearReferenceSequenceDisplay`) can simply not define it. (HiC/LD compose
`GlobalDataDisplayMixin`, not MultiRegion, and both *do* define `rpcProps()`;
`installGlobalFetchAutorun` reads it directly.)

`gpuProps()` exists wherever the main thread encodes the GPU buffer (wiggle,
multi-wiggle, multi-LGV synteny). Canvas's worker pre-builds the buffer, so canvas
has only `rpcProps()`. This splits refetch from re-upload: wiggle color change →
re-encode only; `bicolorPivot` change → worker output differs → `rpcProps()` →
refetch.

Derived region maps apply when upload needs whole fresh per-region payloads, not
just encoder parameters. Alignments' `laidOutPileupMap` returns shallow clones of
`rpcDataMap` entries with freshly-allocated Y arrays from main-thread layout (+
connecting-line / Flatbush in chain mode). Raw `rpcDataMap` is never mutated. Use
derived maps when settings change the shape/contents of per-region data; use
`gpuProps()` for scalars fed to an encoder.

#### Theme-derived render inputs are session getters, not pushed volatiles

Color palettes are a pure function of the active theme, so derive them in a model
getter — `buildColorPaletteFromTheme(getSession(self).theme)` — that `gpuProps()`
/ `renderState` read directly. Do **not** stage them in a volatile that a React
`useEffect` pushes in via a `setColorPalette` action: the effect runs only on
mount, so SVG export and RPC (no component) saw a null palette and rendered blank.
As a getter the value is always present and MobX recomputes it only when the theme
changes — same re-encode invalidation, no mount dependency. `session.theme` is the
resolved MUI `Theme` (required on `AbstractSessionModel`); embedded products
without `ThemeManagerSessionMixin` supply a minimal `get theme()` =
`createJBrowseTheme(getConf(self, 'theme'))`. SVG export still overrides the
palette with the *export* theme (`opts.theme`). (Applies equally to alignments,
MAF, and the reference sequence display.)

### Per-region zoom-staleness

All worker position output is **absolute genomic uint32**, so data stays valid
under zoom. Two exceptions for zoom-dependent *content* (not coords):

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based on
  `bpPerPx / resolution`. `isCacheValid` uses strict equality (`view.bpPerPx ===
  loadedBpPerPx`) — any zoom change refetches all visible regions together. See
  ADR-008.
- **Canvas**: the amino-acid overlay is the only `bpPerPx`-dependent worker
  decision. `isCacheValid` returns `false` when `rpcDataMap` has no entry for the
  region, and otherwise refetches only when the viewport crosses
  `shouldRenderPeptideBackground`'s discrete threshold. `laidOutDataMap` uses
  `coarseBpPerPx` (debounced 500ms) so Y-row packing doesn't recompute on every
  animation frame during smooth zoom.

All other plugins leave the default `() => true`.
`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the override per
region and refetches stale ones.

### HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/render-core/src/hal/`.

```
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  ?renderer=canvas2d     → return null
  else                   → try WebGPU → fallback WebGL2 → fallback null
```

**Key methods:** `uploadBuffer(regionKey, passId, data, count)`,
`getBufferCount(regionKey, passId)`, `drawPass(passId, regionKey,
bufferPassId?)`, `writeUniforms(data)`, `setScissor`, `setViewport`,
`deleteRegion(key)`, `pruneRegions(active)`, `dispose()`.

`drawPass` short-circuits when the region has no buffer for that pass (or count is
zero), so callers issue draws unconditionally without tracking which regions have
data.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery), `WebGL2Hal`
(`antialias: true`, VAO + UBO, context-loss recovery), `MockHal` (tests).

**Renderer override** (query param `?renderer=`): `webgpu` / `webgl` / `canvas2d`
/ `canvas`; omitted → auto-detect WebGPU → WebGL2 → Canvas2D.

#### Renderers stay stateless

GPU renderer classes own only what is intrinsically per-instance:

- the `GpuHal` reference
- pre-allocated uniform scratch buffers reused across frames to avoid per-frame GC
  churn
- save/restore UBO scratch where a pass mutates uniforms (alignments arc/overlay)

What does NOT belong as renderer instance state:

- **Region-lifecycle bookkeeping** — call `hal.pruneRegions(active)` instead of
  mirroring HAL's region map in a renderer-side `Map<number, ...>`. HAL is the
  authoritative owner of "which regions have GPU buffers."
- **Per-region metadata derivable from `rpcDataMap`** — `hasRects` / `hasLines` /
  `outlineColor` style fields. `drawPass` skips missing buffers so the boolean
  flags aren't needed; per-region scalars used in uniforms should be passed into
  `renderBlocks` from the MST model rather than cached on the renderer. See
  `GpuCanvasFeatureRenderer` for the canonical shape.
- **Write-only mirror copies of upload data** — if a value lives in
  `rpcDataMap[idx].foo`, don't also store it as `LocalRegion.foo`.

Rule of thumb: anything the upload callback already knows from observable inputs
can be looked up at render time too. Less local state means fewer divergence
points when the source of truth shifts.

### Shaders (Slang codegen)

Production draw shaders are authored as `.slang`, compiled to WGSL (WebGPU) and
GLSL ES 3.00 (WebGL2) by `packages/shader-tools/src/build-shaders.ts`. **Never
hand-edit `*.generated.ts`** — edit the `.slang` source and run `pnpm
gen:shaders`. The generated module exports source strings, per-field byte offsets,
strides, typed uniform/instance structs, a typed `writeUniforms()` /
`packInstances()`, and the `GL_ATTRIBUTES` array; TS imports these by name, so
stride/offset drift between packer and shader is impossible by construction. CI
runs `pnpm gen:shaders && git diff --exit-code` to catch stale outputs.

Layout: display-specific shaders in
`plugins/<plugin>/src/<display>/shaders/<name>.slang`; per-plugin shared in
`plugins/<plugin>/src/shared/shaders/`; cross-plugin modules (`hpmath.slang`,
`colorPack.slang`, `pointGlyph.slang`) in `packages/render-core/src/shaders/`.
`slangPass()` turns a generated module into a `PassDescriptor`, with overrides for
`topology`, `blendState`, `textures`, and buffer sharing. Authoring conventions
and gotchas: ADR-005.

### Canvas scaling & hi-DPI

**GPU canvases (HAL-managed):** shader uniforms are in CSS pixels; HAL sets the
backing store to `css × dpr`, so `N / canvas_width` in clip space = `N` CSS pixels
at any DPR. Do not manually scale by `devicePixelRatio`.

**2D overlay canvases (`VisibleLabelsOverlay`, `MsaHighlightOverlay`, etc.):**
caller owns DPR. Set `canvas.width = w * dpr` + `canvas.height = h * dpr` in the
effect, call `ctx.scale(dpr, dpr)`, then put CSS `width`/`height` in the style
block. Skipping this renders blurry on Retina. `prepareCanvas` (in
`packages/render-core/src/canvas2dUtils.ts`) does this for the on-screen Canvas2D
backend path; standalone overlay components must replicate it.

### `displayedRegionIndex`

Zero-based index into `view.displayedRegions`. Stable unless regions are added,
removed, or reordered. **Not** an index into `dynamicBlocks.contentBlocks` — one
displayedRegion can produce multiple render blocks that share one GPU buffer and
draw with different scissor clips.

The join key across `model.rpcDataMap`, `hal.uploadBuffer(regionKey, ...)`, and
`RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot, synteny) key on a
tuple of two displayedRegion indices.

---

## Adding a new GPU display type

The public
[GPU displays guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
walks this checklist step by step (and
[Plotting features](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/plotting_features.md)
does the Canvas2D-only version); keep them in step with any change here.

- **Types** — `MyData`, `MyRenderState`, `MyRenderingBackend`.
- **Shader** — author `my.slang`; `pnpm gen:shaders` emits `my.generated.ts`.
- **Renderers + factory** — `createRenderingBackend<MyRenderingBackend>` from
  `packages/render-core/src/createRenderingBackend.ts`. Use `slangPass()` to build
  the `PassDescriptor`.
- **MST model:**
  - Compose `MultiRegionDisplayMixin()` for LGV-family per-region displays (brings
    in `RenderLifecycleMixin`, `FetchMixin`, `RegionTooLargeMixin`, the five fetch
    autoruns, and `rpcProps()`→refetch wiring).
  - Compose `GlobalDataDisplayMixin()` for displays that hold a single
    non-regional dataset (HiC contact matrix, LD triangle, variant matrix). Same
    slot mixin + `FetchMixin` + `RegionTooLargeMixin` plumbing, but **no** fetch
    autoruns — the display installs its own in `afterAttach` via
    `installGlobalFetchAutorun(self, { shouldFetch, fetch, delay, name })`. The
    helper owns the skeleton every global trigger shares (skip while minimized or
    with no content blocks; track `rpcProps()` + `reloadCounter`; run through
    `autorunOnReadyView`; debounce); the display supplies only its `shouldFetch`
    gate (a pure predicate reading its display-specific fetch inputs so MobX tracks
    them — e.g. HiC `effectiveResolution !== undefined`; LD `showLDTriangle &&
    !regionTooLarge`) and its `fetch` action.
  - Compose `RenderLifecycleMixin()` directly only when neither fetch surface is
    needed (rare).
  - Add a cached `renderState` view.
  - Define `startRenderingBackend(backend)` calling
    `self.attachRenderingBackend(backend, { upload, render })`.
  - Expose `rpcProps()`; add `gpuProps()` only when the main thread encodes GPU
    buffers from settings.
- **React component** — `observer()`. Render the canvas through the shared
  `DisplayChrome` (from `@jbrowse/plugin-linear-genome-view`), passing the model
  and the renderer `factory`. `DisplayChrome` calls `useRenderingBackend`
  internally and owns the render-error / region-too-large / error-bar / loading
  overlays, so the component only lays out its own canvas(es) via the render-prop
  child:
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
- **Wiggle-style displays** — to reuse the whole LinearWiggleDisplay model, compose
  `linearWiggleDisplayModelFactory` from `@jbrowse/plugin-wiggle` (see
  `plugins/gccontent`). To borrow only the score machinery, compose
  `WiggleScoreConfigMixin` + `makeScoreSubMenu` (see `plugins/gwas` Manhattan).
  Implement `WiggleRenderingBackend` (typed from `@jbrowse/wiggle-core`); override
  `isCacheValid` to `() => true` if the display is zoom-independent.
- **Tests** — unit (`MockHal`); browser (Puppeteer,
  `--backend=webgl|webgpu|canvas2d`).

---

## What NOT to do

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` — it
  belongs in the MST autorun pair spawned by `attachRenderingBackend`.
- Don't destructure model methods; call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't cache per-region data on a renderer class (`private regions = new
  Map<number, ...>()`). The model's `rpcDataMap` / `laidOutDataMap` is the single
  source of truth; pass it into `renderBlocks(blocks, regions, state)`. For GPU
  buffer lifecycle delegate to `hal.pruneRegions(active)`.
- Don't add or redefine volatiles/actions owned by the slot mixin (`canvasDrawn`,
  `renderTick`, `currentRenderingBackend`, `renderError`, `markCanvasDrawn`,
  `resetCanvasDrawn`, `renderNow`, `setRenderError`, `stopRenderingBackend`, etc.)
  or the `isReady` view owned by `MultiRegionDisplayMixin`. `renderError` in
  particular is the single source for the `renderError` terminal phase — don't fork
  it into a display-local volatile.
- Don't hand-edit `*.generated.ts` or hand-maintain WGSL/GLSL/offset tables. Edit
  `.slang` and run `pnpm gen:shaders`; CI's `git diff --exit-code` catches stale
  outputs. Consume generated constants by name from TS — never copy a literal
  offset into a renderer.
- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps()` — `SettingsInvalidate` watches `rpcProps()` and calls
  `clearAllRpcData`, creating an infinite fetch loop.
- Don't diverge the two render backends. Import shader constants into TS rather
  than retyping them, put shared glyph geometry/color math in one draw helper, and
  keep multi-layer order/gating in one exhaustively-keyed registry. And don't go
  the other way: a Canvas2D sub-pixel *overdraw* (fudge factor / `f2`) or
  stroke-vs-fill swap is deliberate AA compensation with no shader equivalent —
  don't port it into a `.slang`. See "Keeping the two backends in parity."

---

## See also

Deep subsystems, each read on its own task (also linked inline where they come
up):

- [reference/SVG_EXPORT.md](reference/SVG_EXPORT.md) — SVG export pipeline, the
  `svgReady` / `settled` readiness gates, `paintLayer`, model-scoped clip ids.
- [reference/BP_PRECISION.md](reference/BP_PRECISION.md) — the absolute-uint32
  convention, hi/lo float math, window-relative cumBp, genome-size limits.
- [reference/PROGRESS_REPORTING.md](reference/PROGRESS_REPORTING.md) — the
  worker→UI status channel, determinate bars, concurrent-fetch aggregation,
  cancel.
- [reference/HISTORICAL.md](reference/HISTORICAL.md) — the old server-side block
  system, bugs that shaped the current design, corrections to old writeups.
- [reference/GPU_GLOSSARY.md](reference/GPU_GLOSSARY.md) — plain-language GPU
  glossary and a Canvas2D→GPU primer.
- [reference/CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md) — how config reaches
  the renderer (config → MST snapshot → plain object → RPC).
- [reference/DISPLAYCHROME.md](reference/DISPLAYCHROME.md) — the shared
  loading/error/retry chrome every display renders through.
