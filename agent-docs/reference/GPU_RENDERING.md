---
name: gpu-rendering
description: The GPU render lifecycle in depth — RenderLifecycleMixin, the upload/render autoruns, per-plugin backends, the three upload patterns, the HAL, and Slang shaders. Read when touching a rendering backend, an upload path, or a shader.
---

# GPU rendering architecture

How a display gets bytes onto the GPU and pixels onto the screen. Split out of
[ARCHITECTURE.md](../ARCHITECTURE.md), which remains the front door: read its
overview, **Display stacks**, and **Data fetching pipeline** first for how a
display is composed and how data reaches the main thread. This doc picks up at
the point where the model has data and needs to draw it.

Everything here applies to displays that draw to a canvas. Arc — the one display
class that paints JSX SVG on both the on-screen and export paths — composes none
of it; see ARCHITECTURE.md "Display stacks".

## TL;DR

- `attachRenderingBackend(backend, { upload, render })` spawns **two autoruns**
  tied to the model's lifetime. MobX tracks whatever each callback reads — you
  never declare a dependency or call an invalidate.
- `render` returns `true` **only when real content was drawn**. That flips
  `canvasDrawn`, which is what dismisses the loading scrim.
- Pick an **upload pattern** by data shape: per-region streamed (independent
  regions), whole-map synced (cross-region Y layout), or monolithic (no region
  partitioning). Getting this wrong is how you get O(N²) uploads.
- Iterating `rpcDataMap` inside an upload callback tracks the **whole map**.
  `installPerRegionLifecycle` gives each key its own autorun; use it unless
  layout couples regions.
- Renderers are **stateless** — no region maps, no mirrored upload data. HAL owns
  which regions have buffers (`hal.pruneRegions`).
- Shaders are `.slang`; `pnpm gen:shaders` emits typed packers, offsets, and
  constants. Import generated constants by name — never retype a literal.
- A dual-path display must keep Canvas2D and the shader in parity, **except** for
  deliberate AA compensation (fudge factors, stroke-vs-fill), which must not be
  ported into a shader.

## Package layout

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
[ADR-030](../architecture-decision-records/adr-030-render-core-package-static-import-only.md).

HAL is the hardware abstraction layer (WebGL2 vs WebGPU). Full vocabulary +
Canvas2D→GPU primer: [GPU_GLOSSARY.md](GPU_GLOSSARY.md).

## The core contract

Each GPU display is an MST model that composes `RenderLifecycleMixin` and calls
`self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied to
the model's lifetime — one runs `upload(backend)`, one runs `render(backend)`.
MobX auto-tracks every observable read inside each callback, so changes re-fire
the right autorun with no manual dependency declarations. React components are
thin bridges: create a canvas, hand the backend to the model via
`useRenderingBackend`, render JSX.

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
      // isReady becomes true once isLoading also clears
    },
  })
}
```

## What the mixin owns

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

Every canvas-drawing display renders through the shared `DisplayChrome`, which calls
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

`rendersCanvas` is an overridable hook, not inlined, on purpose: the pre-paint
scrim needs both "nothing painted yet" (`!canvasDrawn`) and "not a deliberate
empty placeholder", and only the display knows the second. The one alternative
that removes the hook — render LD's placeholder *outside* `DisplayChrome`, so
there is no scrim to gate — was rejected because it disposes/re-inits the GPU
backend on every triangle toggle and moves a render path out of the shared chrome
([ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md)). So LD's `rendersCanvas` override is the single override by design;
deleting it as "dead single-use code" regresses a stuck spinner over the
triangle-off placeholder.

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

## Life of a frame

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

## RenderingBackend interfaces per plugin

Each plugin defines its own `RenderingBackend` type and a factory that produces
either a GPU or a Canvas2D implementation:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<XxxRenderingBackend>(canvas, {
    passes: XXX_PASSES,
    uniformByteSize: XXX_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuXxxRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DXxxRenderer(c),
  })
}
```

`createRenderingBackend` calls `createGpuHal`; if a HAL is returned the GPU
backend is constructed, otherwise Canvas2D. The two factories are **named
options, not positional args**, on purpose: both are single-arg
`x => new Backend(x)` lambdas, so positionally they're trivially swappable by
mistake.

### Canvas2D is the floor; GPU is the optional accelerator

Every display that draws to a canvas **must** ship a Canvas2D draw function
regardless — SVG export goes through it (see
[SVG_EXPORT.md](SVG_EXPORT.md)). The GPU shader
path is an *optional accelerator* for displays whose feature counts demand it
(≳100K features/frame — [RFC-001 §3a](RFC-001-community-plugin-api.md)). So a display whose data is always
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

### Keeping the two backends in parity

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
  not one caller. The same trick covers shared *predicates*, not just geometry —
  canvas's `canvasEdgeFlags` derives the continuation-marker edge gates for both
  backends so the 0.5px epsilon can't drift from `continuation.slang`'s.
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

### Shared per-region streamed contract

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

Synteny additionally has a level-of-detail axis upstream of all this: which PIF
tier the fetch reads from. That's a fetch/adapter concern, not a backend one —
[SYNTENY_LOD.md](SYNTENY_LOD.md).

### Wiggle-family contract

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
- `pointMarker.ts` / `resolveRenderState.ts` / `transferables.ts` / `YScaleBar` — the shared scatter glyph (wiggle + Manhattan), render-state resolution, worker transfer-list collection, and the Y-axis overlay

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

### Three upload patterns

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

#### Per-region streamed: per-key autoruns (`installPerRegionLifecycle`)

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
`LinearMultiRowFeatureDisplay`. It does **not** apply to the canvas plugin's other
display, `LinearBasicDisplay`, whose whole-map Y-layout keeps it on the
computed-map form described below. (The canvas plugin's two displays sit on
opposite upload strategies, so they're always spelled out where they diverge. The
multi-variant displays are per-region streamed too, but hand-roll their upload
loop.) Each plugin's `startRenderingBackend` collapses to a single call:

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

**Why the helper doesn't apply to `LinearBasicDisplay` / alignments:** those lay
out features into Y-rows across all loaded regions together (a gene spanning two
adjacent regions lands on the same row in both), so any new arrival can in
principle change the layout of everything already loaded. They route through a
whole-map MobX computed (`laidOutDataMap` / `laidOutPileupMap`) that invalidates
on any `rpcDataMap` change; per-key autoruns can't help, because reading
`laidOutDataMap.get(key)` still tracks the whole-map computed. This cross-region
coupling is load-bearing (collapsed-intron views split one chromosome into many
displayed regions, and a long gene must hold the same Y row in each) and is why
layout runs on the main thread — row assignment needs the union of all visible
regions' features.

`LinearBasicDisplay` recovers O(N) anyway via `createIncrementalLayout`
(`plugins/canvas/src/LinearBasicDisplay/layout.ts`), which memoizes the pure
layout **per ref-group** so unchanged chromosomes return prior output by reference
and only changed regions re-upload. Alignments/synteny keep the plain whole-map
form (N is only 4–8 buffered regions at their gene-level zoom). Full derivation of
the incremental-layout memo and its chain-mode wrinkle: [ADR-017](../architecture-decision-records/adr-017-wiggle-per-key-autoruns.md), [ADR-011](../architecture-decision-records/adr-011-canvas-flatbush-immutable-offsets.md).

## HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/render-core/src/hal/`.

```
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  ?renderer=canvas2d|canvas  → return null                 (Canvas2D backend)
  ?renderer=webgl            → skip WebGPU, try WebGL2 → null on failure
  otherwise                  → try WebGPU → WebGL2 → null
```

**Key methods** (full interface: `packages/render-core/src/hal/types.ts`):

- *Frame lifecycle* — `beginFrame(...)` / `endFrame()` bracket a render pass;
  `beginUpload()` / `endUpload()` bracket a batch of buffer writes.
- *Data* — `uploadBuffer(regionKey, passId, data, count)`,
  `getBufferCount(regionKey, passId)`, `uploadTexture(...)`,
  `writeUniforms(data)`.
- *Draw* — `drawPass(passId, regionKey, bufferPassId?)`, `setScissor` /
  `clearScissor`, `setViewport` / `clearViewport`.
- *Lifecycle* — `deleteBuffer(regionKey, passId)`, `deleteRegion(key)`,
  `pruneRegions(active)`, `resize(width, height)`, `setErrorHandler(handler)`,
  `dispose()`.

`drawPass` short-circuits when the region has no buffer for that pass (or count is
zero), so callers issue draws unconditionally without tracking which regions have
data.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery), `WebGL2Hal`
(`antialias: true`, VAO + UBO, context-loss recovery), `MockHal` (tests).

**Renderer override** (query param `?renderer=`). Only three values are
recognized (`createHal.ts` + `getGpuDevice`): `canvas2d` / `canvas` force the
Canvas2D backend, and `webgl` skips the WebGPU attempt. Omitted → auto-detect.

**There is no value that pins WebGPU.** `?renderer=webgpu` is not recognized and
behaves exactly like omitting the param — it still falls back to WebGL2 if
WebGPU init fails. When a test or a bug report needs to prove which backend
actually ran, assert on the HAL, don't infer it from the URL.

### Renderers stay stateless

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

## Shaders (Slang codegen)

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
and gotchas: [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md).

## Canvas scaling & hi-DPI

**GPU canvases (HAL-managed):** shader uniforms are in CSS pixels; HAL sets the
backing store to `css × dpr`, so `N / canvas_width` in clip space = `N` CSS pixels
at any DPR. Do not manually scale by `devicePixelRatio`.

**2D overlay canvases (`VisibleLabelsOverlay`, `MsaHighlightOverlay`, etc.):**
caller owns DPR. Set `canvas.width = w * dpr` + `canvas.height = h * dpr` in the
effect, call `ctx.scale(dpr, dpr)`, then put CSS `width`/`height` in the style
block. Skipping this renders blurry on Retina. `prepareCanvas` (in
`packages/render-core/src/canvas2dUtils.ts`) does this for the on-screen Canvas2D
backend path; standalone overlay components must replicate it.

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions`. Stable unless regions are added,
removed, or reordered. **Not** an index into `dynamicBlocks.contentBlocks` — one
displayedRegion can produce multiple render blocks that share one GPU buffer and
draw with different scissor clips.

The join key across `model.rpcDataMap`, `hal.uploadBuffer(regionKey, ...)`, and
`RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot, synteny) key on a
tuple of two displayedRegion indices.

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
