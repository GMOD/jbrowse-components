---
name: architecture
description: How JBrowse renders a track — display stacks, the worker→main fetch pipeline, SVG export, and the invariants. Read when touching a display or its data flow; the render backend itself is in reference/GPU_RENDERING.md.
---

# Architecture

The canonical reference for how JBrowse renders a track. Read the TL;DR for the
mental model, then jump to the section for whatever you're touching. Deep
subsystems that come up only on a specific task live in their own docs,
collected under [See also](#see-also) at the end.

## TL;DR

- Adapters fetch and parse in an RPC worker; the main thread renders. Worker
  output is **absolute genomic uint32** — never pixels, never region-relative.
- A display is an MST model. `attachRenderingBackend(backend, { upload,
  render })` spawns two MobX autoruns: upload bytes on data change, redraw on
  any visible change. Pan/zoom is a redraw, not a refetch.
- Rendering picks WebGPU → WebGL2 → Canvas2D at runtime behind the HAL. A
  Canvas2D draw fn is the floor for canvas-based displays because SVG export
  runs it; the shader path is an optional accelerator.
- Two fetch foundations cover everything: `MultiRegionDisplayMixin` (per region,
  its own autoruns) and `GlobalFetchMixin` (one dataset, display installs its
  own autorun).
- `DisplayChrome` owns every terminal state — loading, error, render error,
  region-too-large — via the single `displayPhase` getter.
- Shaders are `.slang` compiled by `pnpm gen:shaders`. **Never hand-edit
  `*.generated.ts`.**
- `rpcProps()` = user settings that invalidate the fetch. Putting a fetch result
  in it is an infinite loop; see
  [the trap](#rpcprops-loop-trap-and-how-to-break-it).

## Overview

A **display** is the object that draws one track inside a view — the pileup in an
alignments track, the bars in a wiggle track, the matrix in a Hi-C track. Whatever
it draws, it follows the same shape: a worker fetches and parses off the UI
thread, the main thread uploads the result once and then redraws it every frame,
and the frame goes through whichever of three interchangeable backends the
runtime picked.

```
worker:  adapter → features            (absolute uint32 bp)
                     │  RPC, off the UI thread
                     ▼
main:    model.rpcDataMap              (MST node, observable)
                     │  upload autorun — fires when the data changes
                     ▼
         GPU buffers                   (HAL: WebGPU → WebGL2 → Canvas2D)
                     │  render autorun — fires when anything visible changes
                     ▼
         <canvas> on screen

         SVG export reuses the same Canvas2D draw fn — never the shader.
```

Every canvas-drawing display **must** provide a Canvas2D draw function; the GPU
shader path is an optional accelerator layered on top. Because SVG export runs
the Canvas2D path, on-screen and exported pixels can't drift. Arc is the one
non-canvas class — it paints JSX SVG on both paths; see
[Display stacks](#display-stacks).

## Vocabulary

Terms used throughout this doc:

- **Display** — the subject of most of this doc, defined above. Composed from MST
  mixins that supply its behavior: fetch, render lifecycle, height.
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

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally, matching
BED/BAM. Worker output is **absolute genomic uint32** — no regionStart-relative
arithmetic crosses the worker boundary. The precision machinery that makes this
work on a float32 GPU is in [reference/BP_PRECISION.md](reference/BP_PRECISION.md).

## Public developer guides mirror this spec

The hand-written walkthroughs in `website/docs/developer_guides/` —
[plotting_features.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/plotting_features.md)
(Canvas2D),
[creating_gpu_display.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
(GPU), and
[data_fetching.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
— turn the sections below into step-by-step tutorials and link back to them. When
the lifecycle, mixins, or upload patterns here change, update those guides in
the same pass. `pnpm lint-docs-check` (which runs
`website/scripts/check-doc-imports.ts`) validates the cross-links both ways but
not the prose.

## Display stacks

Which mixins do you compose to build a display, and why? Linear-genome-view
displays are built from a small set of **foundation mixins** on `BaseDisplay`,
all sharing `baseLinearDisplayConfigSchema` as their config base. Which mixins a
display composes is the primary axis of code sharing; *how* it renders (GPU vs
Canvas2D) is a separate axis layered on top. Two fetch foundations — per-region
(`MultiRegionDisplayMixin`) and single-global (`GlobalFetchMixin`) — cover every
in-tree display:

| Foundation (composed on `BaseDisplay`) | Brings | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RenderLifecycleMixin` + `FetchMixin` + `RegionTooLargeMixin` + the fetch autoruns + `rpcProps()`→refetch wiring | `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `LinearManhattanDisplay`, `LinearAlignmentsDisplay`, both multi-sample variant displays, `LinearReferenceSequenceDisplay`, `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, and via `LinearCanvasBaseDisplay` the `LinearBasicDisplay` / `LinearVariantDisplay` pair |
| `GlobalDataDisplayMixin()` = `GlobalFetchMixin()` + `RenderLifecycleMixin` | the single-global fetch foundation plus GPU render lifecycle and `displayPhase`. No fetch autoruns: each display installs its own `afterAttach` autorun via `installGlobalFetchAutorun` | HiC (`LinearHicDisplay`), LD (`plugins/variants/src/LDDisplay`) |
| `GlobalFetchMixin()` bare (via arc's `ArcFetchModel`) + main-thread SVG render | the same fetch foundation (`RegionTooLargeMixin` + `FetchMixin` + `reloadCounter`) with **no** `RenderLifecycleMixin` — a non-GPU display shouldn't drag in the render lifecycle to get fetch/cancel/too-large/reload | `LinearArcDisplay`, `LinearPairedArcDisplay` |

`GlobalFetchMixin` is the rendering-agnostic fetch foundation shared by the last
two rows: GPU global displays layer `RenderLifecycleMixin` on top of it
(`GlobalDataDisplayMixin`), while arc composes it bare and paints main-thread SVG.
`displayPhase` lives in `GlobalDataDisplayMixin`, not `GlobalFetchMixin`, because
it reads `renderError` — the one genuinely GPU-only piece. `RegionTooLargeMixin`'s
gate is derived and opt-in; arc's `ArcFetchModel` enables it like every other
byte-gated display (see [the region-too-large
gate](#the-region-too-large-gate-summary)).

`LinearCanvasBaseDisplay` (plugins/canvas) is **not** a peer of these. It is a
canvas-feature *specialization layered on `MultiRegionDisplayMixin`*, and only
`LinearBasicDisplay` + `LinearVariantDisplay` extend it. Everything else —
wiggle, Manhattan, alignments, MAF, and even the canvas plugin's own
`LinearMultiRowFeatureDisplay` — composes `MultiRegionDisplayMixin` directly.

Arc is the one display class that draws **neither** GPU canvas nor Canvas2D: its
components emit JSX `<path>` elements, on screen and in SVG export alike. So it
composes no `RenderLifecycleMixin`, and instead of `DisplayChrome` it renders
`BaseDisplayComponent` (plugins/arc), which re-uses the shared
`computeDisplayPhase` precedence plus the shared `DisplayErrorBar` /
`DisplayLoadingOverlay` / `TooLargeMessage` so its chrome stays identical to a
GPU display's. `features !== undefined || !!error` is its `canvasDrawn`
analogue — the first-paint signal that gates the `-done` testid and the loading
anti-flash. The stricter, staleness-aware `svgReady` is the export gate.

### The global-fetch trigger list must be read unconditionally

`installGlobalFetchAutorun` reads the viewport, `isMinimized`, `rpcProps()` and
`reloadCounter` at the top of its body, *before* the display's `shouldFetch()`
gate, and that ordering is load-bearing. MobX rebuilds the dependency set on
every run, so a read placed inside the gate drops out of it on any run that
decides not to fetch — and can then never wake the autorun again. Arc is the
shape that exposes this: its `shouldFetch` is `!regionTooLarge && !dataLoaded`,
so it goes false on every successful fetch, and with `reloadCounter` read under
the gate `reload()` was silently dead. The display's own `shouldFetch` is the
only gate in the skeleton; each display's `fetch` re-checks `isMinimized` /
`view.initialized` / an empty viewport for its direct callers.

The general rule, which the other fetch autoruns already satisfy: **a gated
trigger read is safe only if the gate is itself an observable that flips on the
transition you want to wake up on.** `if (self.isMinimized) return` above the
tracked deps (synteny, tree-sidebar, the variant sources autorun) is fine —
un-minimizing re-runs the body and re-reads everything. A pure signal like
`reloadCounter`, whose only job is to say "go again" and which no gate consults,
is the dangerous case: nothing else will ever re-run the body on its behalf.
`installGlobalFetchAutorun.test.ts` pins this.

A global display whose `shouldFetch` gates on its own `dataLoaded` must also
invalidate that freshness signal in `reload()` — bumping `reloadCounter` alone
re-runs the autorun but leaves `shouldFetch` false. `ArcFetchModel.reload()`
clears `loadedRegionSignature` for exactly this reason (keeping `features`, so
the stale arcs stay under the loading overlay instead of blanking).

**Render path is a separate axis.** GPU-canvas vs Canvas2D is chosen per frame at
the backend factory
([GPU_RENDERING.md § RenderingBackend interfaces per plugin](reference/GPU_RENDERING.md#renderingbackend-interfaces-per-plugin)),
not by which foundation a display composes.

## Data fetching pipeline

The public
[data fetching pipeline guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
is the tutorial version of this section (the `fetchNeeded` → `fetchEachRegion`
wrapper, `rpcProps`, cancellation, byte gate).

`MultiRegionDisplayMixin` (in
`plugins/linear-genome-view/src/BaseLinearDisplay/`) drives RPC fetches for all
LGV displays (alignments, canvas, wiggle, variants) via these autoruns:

| Autorun | Trigger | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` change | `clearAllRpcData()` |
| `FetchVisibleRegions` | viewport / `fetchGeneration` (600ms debounce) | `fetchNeeded(needed)` for uncovered buffered regions; gated by `error`/`regionTooLarge`/`fetchCanceled` and skipped while the track is minimized |
| `SettingsInvalidate` | `rpcProps()` payload change | `clearAllRpcData()` |
| `ClearBlockingStateOnViewportChange` | viewport change while `error` or `fetchCanceled` is set | `clearAllRpcData()` to unblock retry (the derived `regionTooLarge` self-releases, so it's not part of this) |
| `ClearHoverOnRegionTooLarge` | `regionTooLarge` becomes true | fires the overridable `onRegionTooLarge()` hook (no-op base; alignments clears its hover) |

Subclasses override `fetchNeeded` to call `self.fetchRegions(needed, work)`.
`fetchRegions` runs an optional pre-flight byte estimate (via
`getByteEstimateConfig` → `checkByteEstimate` → the `CoreGetRegionByteEstimate`
RPC) before invoking the work callback. Oversize regions surface a banner:
`DisplayChrome` renders `TooLargeMessage` from the model's
`regionTooLargeReason`.

The `error`/`fetchCanceled` reads in `ClearBlockingStateOnViewportChange` are
`untracked` for correctness — tracking either would let `set…` re-fire the
autorun and wipe the flag before any viewport change.

Variants are the exception to per-region granularity:
`MultiSampleVariantGetCellData` returns one batched payload covering all visible
regions, so variants' `fetchNeeded` expands `needed` to all
`bufferedVisibleRegions` and marks them all loaded together when the work
callback returns.

### The region-too-large gate (summary)

`regionTooLarge` raises the "region too large" banner and holds off the fetch.
It's a **derived** getter on `RegionTooLargeMixin` — a pure function of the
cached byte estimate rescaled to the current viewport — so it self-releases on
zoom-in with no imperative clear and doesn't flicker on pan. Displays opt in by
overriding hooks (`derivedRegionTooLargeEnabled`, `configuredFetchSizeLimit`,
`densityTooLargeForDerivedGate`) rather than shadowing the getter. Canvas folds
its byte check into the feature-fetch RPC instead of a separate pre-flight
estimate, and adds the density axis, via `CanvasFeatureGateMixin`
(`plugins/canvas/src/shared/`), which both canvas feature displays compose; the
shared verdict/threshold/banner-text primitives live in
`shared/regionTooLargeUtils.ts` so the two paths can't drift.

Full detail — the byte gate, the opt-in hooks, how the verdict is built, and the
shared decision primitives: [reference/REGION_TOO_LARGE.md](reference/REGION_TOO_LARGE.md).

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

## GPU rendering architecture

This section is the summary; full detail lives in
[reference/GPU_RENDERING.md](reference/GPU_RENDERING.md).

A GPU display composes `RenderLifecycleMixin` and calls
`self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied to
the model's lifetime: `upload(backend)` pushes bytes to the GPU when the data
changes, `render(backend)` draws a frame when anything visible changes. MobX
auto-tracks every observable read inside each callback, so nothing declares
dependencies by hand. React components are thin bridges — create a canvas, hand
the backend to the model via `useRenderingBackend` (called inside
`DisplayChrome`), render JSX.

The rendering primitives live in **`@jbrowse/render-core`**
(`packages/render-core`): the HAL, `RenderLifecycleMixin`, the backend base
classes, the React backend hooks, and the clip/canvas/hp-math utilities. It is a
leaf package (deps: `mobx` + `@jbrowse/mobx-state-tree` + `react` peer; **no**
`@jbrowse/core`), so a third-party display can depend on it directly. The GPU
API is **static-import-only** — never exposed via the runtime `ReExports`
registry ([ADR-030](architecture-decision-records/adr-030-render-core-package-static-import-only.md)).

What the GPU doc covers, so you can jump straight in:

| Section | Read when |
| --- | --- |
| The core contract / The API / What the mixin owns | Wiring a new display's render lifecycle |
| Life of a frame | Debugging "why didn't it redraw", context loss, tab visibility |
| RenderingBackend interfaces per plugin | Writing a backend factory; going Canvas2D-only |
| Keeping the two backends in parity | Touching either a `.slang` or a Canvas2D draw fn |
| Three upload patterns / `installPerRegionLifecycle` | Choosing how a display shovels bytes; O(N²) upload bugs |
| HAL / Renderers stay stateless | Touching `packages/render-core/src/hal/` or renderer state |
| Shaders (Slang codegen) | Editing a `.slang` or a generated module |
| Canvas scaling & hi-DPI / `displayedRegionIndex` | Blurry canvases; region↔buffer join keys |
| Adding a new GPU display type | The end-to-end checklist |

### Terminal states early-return their own root

`DisplayChrome` branches on `model.displayPhase`. For the `renderError` /
`tooLarge` banners it early-`return`s the banner as its *entire* output,
replacing the display subtree, rather than keeping the container `<div>` mounted
and swapping the banner in beside the canvas. This looks like a leak — the
caller's `className`/`ref`/mouse handlers are absent in those two states — but a
benign one: a too-large region has no canvas to interact with, and the ref
re-attaches on force-load. What makes it the right shape:

- **Clean GPU dispose/re-init.** Early-`return` unmounts the canvas subtree,
  which fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
  `stopRenderingBackend()`; force-load remounts and re-inits via the callback
  ref. Nesting the banner beside a still-mounted canvas would skip that cycle.
  Unmounting is safe precisely because that full dispose→re-init cycle runs.
- **The loading term stays lazy.** `computeDisplayPhase(self, loading)` takes
  `loading` as a thunk and calls it only after ruling out the terminal flags, so
  when a banner is up the chrome's observer tracks only that flag, not the
  view's churning `visibleRegions`/`loadedRegions`.
- **React Compiler opt-out.** `DisplayChromeInner` carries `'use no memo'`, so
  babel-plugin-react-compiler doesn't compile it and can't memoize a MobX read on
  `model`'s stable identity. Full analysis:
  [reference/COMPILER_TERNARY_FINDING.md](reference/COMPILER_TERNARY_FINDING.md).

The rest of the shared chrome — the phase precedence, the retry affordances, the
overlay components — is in
[reference/DISPLAYCHROME.md](reference/DISPLAYCHROME.md).

## SVG export

SVG export and on-screen rendering share the same pure Canvas2D draw functions,
so a shader-only tweak can't silently diverge the export. Every display's
`renderSvg.tsx` follows one shape: `await awaitSvgReady(model)`, then mount
`SvgChrome` (the single terminal-state gate) around a sync body that paints via
`paintLayer`. The full contract — the `svgReady`/`settled` freshness gates, the
one permitted TypeScript narrow, `paintLayer`'s raster-vs-vector dispatch, the
JSX-SVG exception classes, and model-scoped clip ids — is in
[reference/SVG_EXPORT.md](reference/SVG_EXPORT.md).

## `rpcProps()` / `gpuProps()` pattern

Domain-named methods that enumerate **what affects rendering output**. Both are
MST view methods (not getters), so subclasses extend them via the standard `super`
capture pattern, mirroring `renderProps`.

| Method | Consumer | Invalidation route |
| --- | --- | --- |
| `rpcProps()` | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | Mixin `SettingsInvalidate` autorun reads `self.rpcPropsCacheKey` (the serialized payload) → `clearAllRpcData` → refetch |
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
`LinearReferenceSequenceDisplay`) can simply not define it. HiC and LD compose
`GlobalDataDisplayMixin` rather than MultiRegion, and both *do* define
`rpcProps()`; `installGlobalFetchAutorun` reads it directly.

`gpuProps()` exists wherever the main thread encodes the GPU buffer — wiggle,
multi-wiggle, MAF, HiC (and GC-content, which inherits wiggle's wholesale).
Multi-LGV synteny fills the same role without the method: its `computedColors`
getter is the re-upload-without-refetch half of the split. Canvas's worker
pre-builds the buffer, so canvas has only `rpcProps()`. This splits refetch from re-upload: wiggle color change →
re-encode only; `bicolorPivot` change → worker output differs → `rpcProps()` →
refetch.

Derived region maps apply when upload needs whole fresh per-region payloads, not
just encoder parameters. Alignments' `laidOutPileupMap` returns shallow clones of
`rpcDataMap` entries with freshly-allocated Y arrays from main-thread layout (+
connecting-line / Flatbush in chain mode). Raw `rpcDataMap` is never mutated. Use
derived maps when settings change the shape/contents of per-region data; use
`gpuProps()` for scalars fed to an encoder.

### Theme-derived render inputs are session getters, not pushed volatiles

Color palettes are a pure function of the active theme, so derive them in a model
getter — `buildColorPaletteFromTheme(getSession(self).theme)` — that `gpuProps()`
/ `renderState` read directly. Do **not** stage them in a volatile that a React
`useEffect` pushes in via a `setColorPalette` action: the effect runs only on
mount, so SVG export and RPC — neither of which has a component — see a null
palette and render blank. As a getter the value is always present and MobX
recomputes it only when the theme changes: same re-encode invalidation, no mount
dependency. This applies equally to alignments, MAF, and the reference sequence
display.

`session.theme` is the resolved MUI `Theme`, required on
`AbstractSessionModel`. Embedded products without `ThemeManagerSessionMixin`
supply a minimal `get theme()` = `createJBrowseTheme(getConf(self, 'theme'))`.
SVG export still overrides the palette with the *export* theme (`opts.theme`).

## Per-region zoom-staleness

All worker position output is **absolute genomic uint32**, so data stays valid
under zoom. The exceptions are for zoom-dependent *content*, not coords:

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based on
  `bpPerPx / resolution`. `isCacheValid` uses strict equality (`view.bpPerPx ===
  loadedBpPerPx`) — any zoom change refetches all visible regions together. See
  [ADR-008](architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md).
- **Canvas**: the amino-acid overlay is the only `bpPerPx`-dependent worker
  decision. `isCacheValid` returns `false` when `rpcDataMap` has no entry for the
  region, and otherwise refetches only when the viewport crosses
  `shouldRenderPeptideBackground`'s discrete threshold. `laidOutDataMap` uses
  `coarseBpPerPx` (debounced 500ms) so Y-row packing doesn't recompute on every
  animation frame during smooth zoom.

Those are the only two *zoom*-dependent overrides. Other displays either leave
the default `() => true` or override on presence alone (`LinearMultiRowFeatureDisplay`
returns `rpcDataMap.has(idx)`, so a too-large region — marked loaded but holding
no data — refetches the moment the gate releases).
`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the override per
region and refetches stale ones.

## What not to do

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
  `rpcProps()`; it is an infinite fetch loop. See
  [the trap](#rpcprops-loop-trap-and-how-to-break-it).
- Don't diverge the two render backends. Import shader constants into TS rather
  than retyping them, put shared glyph geometry/color math in one draw helper, and
  keep multi-layer order/gating in one exhaustively-keyed registry. And don't go
  the other way: a Canvas2D sub-pixel *overdraw* (fudge factor / `f2`) or
  stroke-vs-fill swap is deliberate AA compensation with no shader equivalent —
  don't port it into a `.slang`. See
  [GPU_RENDERING.md § Keeping the two backends in parity](reference/GPU_RENDERING.md#keeping-the-two-backends-in-parity).

## See also

Deep subsystems, each read on its own task (also linked inline where they come
up):

- [reference/GPU_RENDERING.md](reference/GPU_RENDERING.md) — the render lifecycle
  in depth: the mixin, the upload/render autoruns, per-plugin backends, the three
  upload patterns, the HAL, Slang shaders, and the new-display checklist.
- [reference/SVG_EXPORT.md](reference/SVG_EXPORT.md) — SVG export pipeline, the
  `svgReady` / `settled` readiness gates, `paintLayer`, model-scoped clip ids.
- [reference/BP_PRECISION.md](reference/BP_PRECISION.md) — the absolute-uint32
  convention, the three coordinate families (LGV bp / window-relative cumBp /
  screen space), hi/lo float math, genome-size limits.
- [reference/PROGRESS_REPORTING.md](reference/PROGRESS_REPORTING.md) — the
  worker→UI status channel, determinate bars, concurrent-fetch aggregation,
  cancel.
- [reference/REGION_TOO_LARGE.md](reference/REGION_TOO_LARGE.md) — the byte/density
  gate: the derived `regionTooLarge` getter, the opt-in hooks, and the shared
  verdict primitives.
- [reference/SYNTENY_LOD.md](reference/SYNTENY_LOD.md) — the two PIF tiers
  (fine/coarse), the profiled cost model, and why read-time binning is capped.
- [reference/HISTORICAL.md](reference/HISTORICAL.md) — the old server-side block
  system, bugs that shaped the current design, corrections to old writeups.
- [reference/GPU_GLOSSARY.md](reference/GPU_GLOSSARY.md) — plain-language GPU
  glossary and a Canvas2D→GPU primer.
- [reference/CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md) — how config reaches
  the renderer (config → MST snapshot → plain object → RPC).
- [reference/DISPLAYCHROME.md](reference/DISPLAYCHROME.md) — the shared
  loading/error/retry chrome every display renders through.

