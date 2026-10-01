---
name: gpu-rendering
description: The GPU render lifecycle in depth — RenderLifecycleMixin, the upload/render autoruns, per-plugin backends, the four upload patterns, the HAL, and Slang shaders. Read when touching a rendering backend, an upload path, or a shader.
kind: spec
---

# GPU rendering architecture

How a display gets bytes onto the GPU and pixels onto the screen.
[ARCHITECTURE.md](../ARCHITECTURE.md) is the front door: read its **Display
stacks** and **Data fetching pipeline** first. This doc picks up where the model
has data and needs to draw it.

Everything here applies to displays that draw to a canvas. A display that paints
JSX SVG on both the on-screen and export paths composes none of it.

## Package layout

`@jbrowse/render-core` (`packages/render-core`) holds the HAL,
`RenderLifecycleMixin`, the backend base classes, the React backend hooks and the
clip/canvas/hp-math utilities. It is a leaf package (no `@jbrowse/core`), so a
third-party display can depend on it directly.

Shader codegen lives in `packages/shader-tools/src/build-shaders.ts` plus
`slangPass` in render-core. The display-integration layer
(`MultiRegionDisplayMixin`, `GlobalFetchMixin`, `DisplayChrome`) lives in
`packages/display-kit/src/`. Per-display shaders and passes live under
`plugins/<plugin>/src/<display>/{shaders,passes}`. The host serves the GPU API
to runtime plugins like every bundled `@jbrowse` package
([ADR-128](../architecture-decision-records/adr-128-the-runtime-abi-is-the-exports-maps.md)).

The HAL is the hardware abstraction layer (WebGL2 vs WebGPU). Vocabulary and a
Canvas2D-to-GPU primer: [GPU_GLOSSARY.md](GPU_GLOSSARY.md).

## The core contract

Each GPU display is an MST model that composes `RenderLifecycleMixin` and, in
`startRenderingBackend(backend)`, calls render-core's one upload installer,
`installUpload` (ADR-088). The installer calls the mixin's
`attachRenderingBackend`; `noHandRolledAttach` errors on a display calling it by
hand. The mixin spawns two autoruns tied to the model's lifetime, one running
the upload callback and one the render callback. MobX tracks every observable
read inside each, so no dependency is declared by hand. React components are
thin bridges: create a canvas, hand the backend to the model via
`useRenderingBackend`, render JSX.

```ts
startRenderingBackend(backend: RenderingBackend) {
  installUpload(self, backend, {
    cells: () => self.rpcDataMap,
    render: (b, dataMap) =>
      b.renderBlocks(self.renderBlocks, dataMap, self.renderState),
  })
}
```

- `renderState` is a plain resolved getter, never `undefined`. "The view isn't
  measured yet" is the mixin's `canRender` gate.
- **Forward `renderBlocks`' answer; don't re-derive it** (`rpcDataMap.size === 0`
  and friends). The backend holds the regions map and owns "did real content
  reach the canvas" (ADR-009). Add a guard only for something the backend cannot
  see (alignments' zero-group fetch, MAF's first-paint gate).
- On `true` the mixin calls `markCanvasDrawn()`, and `isReady` follows once
  `isLoading` clears.

The two views whose canvas is **shared by several displays** (dotplot, the
synteny level) repaint unconditionally, because nothing else repaints that
canvas and an empty frame is what erases a hidden track. Synteny's `render`
returns `true`; dotplot answers off the blocks it drew and says "a plot with no
tracks has finished" through `paintInert`. See ADR-009's scope clause and
[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md#the-empty-frame-is-load-bearing).

## What the mixin owns

```
RenderLifecycleMixin
  .volatile
    canvasDrawn         true only after render() returns true with real data
    currentRenderingBackend
    renderTick          bumped by renderNow() and after an upload that changed a buffer
    autorunsInstalled   makes attachRenderingBackend idempotent
    renderError         init / context-loss error; source of the 'renderError' phase
  .views
    canRender           overridable, default true; while false BOTH autoruns skip
  .actions
    markCanvasDrawn / resetCanvasDrawn / stopRenderingBackend / renderNow /
    setRenderError / attachRenderingBackend(setup)

MultiRegionDisplayMixin  (composes RenderLifecycleMixin)
  .views
    canRender               view.initialized
    viewportWithinLoadedData  every visible block is inside a loaded region
    displayPhase            'renderError' | 'tooLarge' | 'error' | 'canceled' | 'loading' | 'ready'
```

**`canRender` exists because view geometry throws before the view is measured**
(`view.width`, so `visibleRegions` and `trackWidthPx` too), and the render
autorun routes a throw to `renderError` — "not measured yet" would surface as
the GPU error banner. The LGV mixins gate it once, so a display's `renderState`
stays a resolved getter and its render callback gates only on its own data.
`GlobalFetchMixin` overrides it through the same `foundationCanRender`.

`attachRenderingBackend(setup)` takes a thunk run once per attach, so
callback-local state rebuilds with the backend on context-loss recovery.
Each autorun is recorded by name for `reactionDependencies`
(`namedReactions.ts`).

**The activity phase is one expression, `computeActivityPhase`**
(`@jbrowse/render-core/displayPhase`), evaluated by every foundation:

```
isMinimized || fetchInert || viewportEmpty ? 'ready'
  : fetchCanceled ? 'canceled'
  : isLoading || awaitingDependentData ||
      (rendersCanvas && hostMounted() && !canvasDrawn) ||
      !viewportCurrent() ? 'loading'
  : 'ready'
```

Each family constants out the axis it lacks. Per-region passes
`viewportCurrent = () => viewportWithinLoadedData`; global passes
`() => true`; both read `rendersCanvas` as `!fetchInert`. Customize through the
`fetchInert` hook, never by overriding `displayPhase`. `viewportCurrent` is a
**thunk** because it is the only input reading the containing view. Parity is
pinned in `displayPhase.test.ts` and `displayPhaseWiring.test.ts`.

- `isLoading` and `rendersCanvas && !canvasDrawn` cover track-open through the
  fetch cycle, hiding once the first frame paints. The `!canvasDrawn` clause
  also covers the window before `isLoading` flips (HiC cannot fetch until
  `CoreGetInfo` resolves).
- `viewportWithinLoadedData` re-shows the scrim when the viewport extends past
  loaded data, such as the debounce after a zoom-out. It is a separate getter
  for tracking reasons (`packages/display-kit/CLAUDE.md`).
- The global family has no staleness axis: it keeps the last frame up during a
  refetch, since worker output is genomic and draws correctly under the live
  view transform.
- `rendersCanvas` is overridable so a display showing a static non-canvas
  placeholder (sequence, zoomed out) does not sit under the scrim. Rendering the
  placeholder outside `DisplayChrome` was rejected because it disposes and
  re-initializes the backend on every toggle
  ([ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md)).
- `stopRenderingBackend` resets `canvasDrawn` so the scrim recovers after
  context loss.

`DisplayChrome` derives scrim visibility from `displayPhase` (`loading` or
`canceled`). It calls `useRenderingBackend(factory, model)` itself, so a display
cannot bury the hook. `renderError` and `tooLarge` early-return their own
component; `error`, `canceled` and `loading` are overlays over the mounted
canvas. It takes a render-prop child `({ canvasRef, canvas }) => ReactNode` and
a required `testid` base ([DISPLAYCHROME.md](DISPLAYCHROME.md) §"One element per
display").

`installGlobalFetchAutorun` schedules **leading-edge**: the first fetch fires
immediately and later refetches debounce by `delay`. MobX's `{ delay }` is
trailing-only and would stall cold open, so a `primed` flag drives a custom
`scheduler`.

## Life of a frame

- `useRenderingBackend` mounts, creates the HAL, resolves a backend and calls
  `model.startRenderingBackend(backend)`.
- The mixin sets `currentRenderingBackend` and spawns two autoruns.
- The upload autorun reads the backend, uploads, and bumps `renderTick`.
- The render autorun reads the backend and `renderTick`, calls `render`, and
  flips `canvasDrawn` on `true`. `clearAllRpcData` resets it.
- Any observable an autorun touches becomes a dependency.

### Context-loss recovery

`useRenderingBackend` listens for `webglcontextlost`/`restored` and
`device.lost`, rebuilds the backend and calls `startRenderingBackend` again. The
mixin sees `autorunsInstalled`, skips installation and reassigns
`currentRenderingBackend`; both autoruns re-fire.

- **A WebGL loss is silent and unfixable in place.** Calls on a lost context are
  no-ops that never throw, and `getContext('webgl2')` keeps returning the lost
  context. The hook waits a grace window for `webglcontextrestored`, then reports
  `createGpuContextLostError()` into `renderError`, which unmounts the canvas and
  frees the context.
- **The recovery budget is windowed** (`RecoveryBudget`, 2 within 60 s). The cap
  targets a context that recovers and re-loses within seconds; a lifetime counter
  would spend a second loss an hour later on the first. A successful re-init does
  not reset it, since every flap contains one; a real `webglcontextrestored` or
  manual Retry does.
- **A WebGPU device loss shares the budget** and needs it more: that path
  re-inits invisibly and reports nothing, so uncapped it re-initializes against a
  dying device for the life of the tab. On give-up it sets
  `createGpuDeviceLostError()`.
- `pagehide` tears the backend down and drops any pending report, since a bfcache
  thaw fires the timer after `pageshow` rebuilt the backend. A loss while merely
  hidden reports and recovers in the background.
- The cause is usually page-wide: Chrome allows ~16 live WebGL contexts and each
  display canvas takes one (see §"WebGL2 contexts are a page-level budget"). The
  `renderError` banner offers `setGpuOverride('canvas2d')`, the switch
  `?renderer=canvas2d` sets. `isGpuRenderingDisabled()` is the one read for "GPU
  is off page-wide", and the button is scoped to context-loss errors.

**Every re-init needs a canvas element that never held a context.**
`getContext('webgl2')` returns the same lost context, and `getContext('2d')`
returns `null` on any element that once had WebGL. **A canvas's context kind is
permanent**, so a re-init whose HAL ladder lands on a different rung is stuck.

- Three re-init paths bump `canvasKey` and set no `renderError`
  (`webglcontextrestored`, WebGPU `onDeviceLost`, bfcache `pageshow`), so
  `renderError`'s unmount does not cover them. `DisplayChromeBase` keys the
  render-prop body (`<Fragment key={canvasKey}>`) and leaves the overlays outside
  the key, since remounting the loading scrim resets its 250 ms anti-flash delay.
  `DisplayChrome.test.tsx` pins this.
- Drop-to-primitive consumers keep their canvas mounted through an error
  (ADR-025), so they render `RenderCanvas` (`@jbrowse/render-core/RenderCanvas`),
  which owns `key={canvasKey}` and publishes `data-display-drawn` as a required
  prop. Their readiness flag is `settled`, not `canvasDrawn`, because a shared
  canvas repaints unconditionally; ADR-065 retired the `-done`/`_done` spellings.
- `getContext` returns one undifferentiated `null` for every failure.
  `canvasContext.ts` records the kind each canvas committed to (a `WeakMap`) and
  turns the `null` into a reason. Every acquisition goes through it
  (`acquireCanvas2D`).
- A ladder that fails at every rung throws an `AggregateError` carrying each
  rung's reason, which `formatErrorStack` walks into the stack-trace dialog. A
  lone Canvas2D failure is rethrown bare.
- `useTabVisibilityRerender` calls `model.renderNow()` on `visibilitychange`;
  WebGPU swap-chain textures are reissued by the `render` callback.

## RenderingBackend interfaces per plugin

Each plugin specializes `PerRegionRenderingBackend` on its payload and render
state, declares what it draws as a mark list, and builds the backend from it:

```ts
export type XxxRenderingBackend = PerRegionRenderingBackend<XxxData, XxxRenderState>

export const XXX_MARKS = [
  defineMark({ shape: xxxShape, channels: d => …, params: s => … }),
]

// in the lazily loaded component, the one import that reaches the HAL
const createXxxBackend = (canvas: HTMLCanvasElement) =>
  createMarkBackend(canvas, XXX_MARKS)
```

`createMarkBackend` is `createRenderingBackend` over `GpuMarkBackend` and
`Canvas2DMarkBackend`, which walk the same list. `createRenderingBackend` calls
`createGpuHal` and builds the GPU backend if a HAL comes back, else Canvas2D.
A mark's shape is `spanMark`, `pointMark`, or the display's own `MarkShape`
beside its shader; `example-plugins/score-example` is the worked third-party
form. Alignments still calls `createRenderingBackend` with renderer classes of
its own, for the sectioned frame scaffold its pileup needs.

### Canvas2D is the floor; GPU is the optional accelerator

Every canvas-drawing display **must** ship a Canvas2D painter, because SVG export
goes through it ([SVG_EXPORT.md](SVG_EXPORT.md)). A shape's `paintBlock` is that
painter, so a mark-layer display has it by construction. A drawing that is not
instances of a shape (the reference sequence's letters) is **Canvas2D-only**: a
hand-written `Canvas2DPerRegionRenderingBackend` subclass and a factory that
skips the HAL ladder, `createCanvas2DBackend(canvas, c => new Canvas2DXxxRenderer(c))`.
The lifecycle is backend-agnostic, so nothing downstream notices.
`plugins/sequence`'s `SequenceRenderer` is the last hand-written one.

### Keeping the two backends in parity

A dual-path display renders the same pixels two ways, and SVG export runs the
Canvas2D path, so a shader-only tweak silently diverges the export. Parity is
kept by construction. Preserve whichever of these the display uses:

- **Constants live in the shader, TS re-exports them.** `//! export-consts:`
  emits the value into the `*.generated.ts`; the Canvas2D side imports it
  (`sharedRendererConstants.ts`). Never retype a shader constant as a TS literal.
- **Scalar decisions live in the shader too.** `//! js-export: fnA, fnB` emits
  `<base>.js.generated.ts`, TypeScript twins transliterated from slangc's WGSL,
  so Canvas2D and SVG run the shader's math. The subset is **scalar only** (no
  vectors, swizzles, loops or indexing); any gap an export reaches throws at
  `pnpm gen:shaders`. Author the scalar core pure and wrap the colour or struct
  conversion around it. Retire a hand-written twin only behind a differential
  sweep (`alphaShaderParity.test.ts`).
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  says why it stops at scalars; [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) says
  how to add an export.
- **A hit test consumes those scalars too**, rather than being a third
  description of the mark. The pileup strand arrowhead picks through
  `chevronContains` under the same generated `showChevron` gate the painters use;
  the dotplot pick measures with `capsuleDistPx`. Hover slack is a named
  tolerance against the shader's own distance. A Canvas2D-vs-GPU pixel diff
  cannot see a divergent hit shape, since it draws nothing. A predicate no draw
  path reaches must live in a `module` shader, or slangc eliminates it.
- **One draw helper, both consumers.** Geometry and colour math both paths (or
  overlay and SVG export) need lives in one function: `drawMafInsertionMarker`,
  `appendPointMarker`, `normalizeScore`, `syntenyRibbonPath`, `canvasEdgeFlags`.
  Change the shared function, not one caller.
- **One registry, exhaustively keyed.** Multi-layer displays list layers,
  z-order and gating once and map each id per backend through a
  `Record<LayerId, …>`, so a half-added layer is a compile error. "The layers
  aren't 1:1" is no reason to skip it: a registry shares the list, not the calls,
  and what it prevents is a layer existing in one backend only, which also loses
  it from SVG export. Alignments' three bands are three mark lists
  (`PILEUP_MARKS`, `ALIGNMENTS_COVERAGE_MARKS`, `ARC_BAND_MARKS`); two bands with
  different draw signatures warrant a second list, never a second backend
  registry.

  **A pass drawn but never uploaded fails silently and on the GPU only**, since
  Canvas2D still paints it and the result reads as a GPU bug. Make the pass and
  its packer one object, `{ ...slangPass({…}), pack }` (`InstancePass`,
  `@jbrowse/render-core/instancePass`), so registration is not a wiring point and
  `ALIGNMENTS_PASSES` is derived. **The instance count comes with it:**
  `uploadPass` derives it as `buf.byteLength / pass.instanceStride`, because a
  separate count is a second expression for a number the buffer states, and a
  count past the bytes reads off the end with no throw. Where a worker packs the
  buffer and the main thread counts a parallel array, pin the two where they are
  joined (`packCoverageArea.test.ts`).

  **Use this at the scale that needs it.** `LinearBasicDisplay`'s five passes
  are one mark list (`CANVAS_FEATURE_MARKS`; `bufferOf` marks the two that borrow
  a buffer). Don't add registries to a renderer you can check by reading.

  **A pass `id` names a slot**: the descriptor a draw uses, the buffer in
  `RegionRegistry` and the pass's texture. Two passes sharing one collide in all
  three. The id does not key the compile, so a second id over one shader
  (`withPassId`, a ring view's eight rings) costs a descriptor and no pipeline.
  `assertUniquePassIds` runs in `createRenderingBackend` and `MockHal`.
- **A per-instance vertex budget is a cap the other backend lacks.** Where one
  instance draws an unbounded number of marks (canvas's chevron pass), the
  pipeline's `verticesPerInstance` fixes how many the shader can address and
  every instance pays for every slot. Raise it and all pay; leave it and a large
  input silently loses marks past it while Canvas2D keeps drawing them. No other
  mechanism here catches this, so state **the input range the budget covers where
  the number is**, measured. `MAX_VISIBLE_CHEVRONS_PER_LINE`
  (`sharedRendererConstants.ts`) is the worked example; read its figures there.
- **`SYNC:` comments are the fallback.** Where a value must match across files
  and none of the above applies, a `SYNC:`/`mirrors` comment names the
  counterpart. First check whether the thing mirrored is a constant
  (`export-consts`), a scalar decision (`js-export`), or an equivalence two
  implementations must preserve while differing (a numeric oracle test, as
  `syntenyShaderParity.test.ts`). **The tag means an unshared duplication and only
  that**: grepping it is meant to find where we gave up, so a tag on a shared
  function or self-tested threshold is over-reporting. Grep the counterpart
  before trusting a tag. Count with `grep -rn 'SYNC:' --include='*.ts' packages
  plugins products`; [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) §"The two
  sweeps" says how to re-run the survey.

**Intentional divergences — do NOT "fix" these into parity.** GPU rasterization
is watertight while Canvas2D antialiases each primitive independently.

- Canvas2D adds a sub-pixel *overdraw* to close seams (`CANVAS_SEAM_PX`, the
  variant-matrix `f2`) and swaps a thin fill for a 1px centerline stroke
  (synteny sub-pixel ribbons); the shader scales coverage alpha instead.
  Porting a Canvas2D fudge factor into a shader over-widens GPU glyphs.
  Min-width floors, by contrast, are mirrored and must stay in step.
- A `band` on `defineMark` differs at the sub-device-pixel edge: the GPU scissor
  rounds each edge to a device row independently and skips the mark when both
  land on one, where Canvas2D's clip paints an antialiased sliver
  (`{top: 10.6, height: 0.3}` at dpr 1). Every other band edge agrees.
- Synteny: `perpCoverage` measures a per-fragment width from the two edges'
  foreshortenings where `ribbonPerpWidth` measures the whole ribbon from its
  corners, each right for its own decision. The clicked outline is **GPU-only as
  a mark**: `drawSyntenyTrack` strokes it inside its own loop, so the
  `edgeStraight`/`edgeCurve` marks paint nothing on Canvas2D.

### Shared per-region streamed contract

Per-region streamed plugins (canvas, manhattan, MAF, multi-variant, wiggle), the
whole-view ones over one canvas-wide block (hic, LD, the variant matrix) and the
shared-canvas ones over a block per cell (dotplot, both synteny displays) all
declare a mark list that `createMarkBackend` turns into both backends.

A display whose x axis is not the block's bp span builds blocks with
`canvasWideBlock` / `canvasWideBlocks` (`render-core/renderBlock`). Its marks read
screen x off the payload's own coordinates through the display's own transform
(`panPx` fold for dotplot and synteny; `viewScale`/`viewOffsetX` for hic and LD),
so the block carries only its key and the identity bp span that keeps `clipBlock`
well-formed. The multi-way stack mixes both: gutters take a canvas-wide block,
glyph lanes a bp-span one off `glyphBlockRange`.

**Hit testing.** A box-instance shape declares `ink(channels, block, frame,
params, i)`, the rect its painter fills (undefined when culled), and
`defineMark` derives `hitNearest` from it (`shapeHitNearest` in
`render-core/marks/hit`; only a strictly nearer candidate replaces the best, so
back-to-front candidates give the top mark). The same `ink` drives the chrome's
highlight (`inkOfInstances`, ADR-110). `nearestMarkHit` is the hover walk over
the candidates the display names per mark; `valueWindow` bounds `bar` and
`point`. A shape whose ink is not a box keeps its own `hitNearest`: synteny
ribbons, arcs, dotplot's capsule, the pileup marks (bp containment), and `point`
(nearest glyph centre).

Both halves extend abstract bases in
`@jbrowse/render-core/perRegionRenderingBackend`:

- `Canvas2DPerRegionRenderingBackend` owns `canvas` + `ctx`, the concrete
  `renderBlocks` (hi-DPI `prepareCanvas` sizing and the `painted` answer around
  the subclass's abstract `draw`; **overriding `renderBlocks` silently drops
  both**), and no-op `upload`/`release`/`dispose`.
- `GpuPerRegionRenderingBackend` owns `hal`, a uniform scratch `ArrayBuffer`,
  `release` via `hal.deleteRegion`, `dispose` via `hal.dispose`, and `upload` over
  the `regionPasses` the subclass declares. A pass that draws off a sibling's
  buffer (wiggle's density, canvas's chevron) is absent from `regionPasses`;
  `createMarkBackend` derives it from the marks with no `bufferOf`.

Two invariants keep renderers small: `renderBlocks` receives the model's data
map as its second argument and the renderer holds no map of its own; and
`hal.drawPass` short-circuits when a region has no buffer, so renderers draw
unconditionally. The optional fourth type parameter `RenderData` lets the upload
and render payloads diverge; nothing uses it today.

Whole-map synced plugins (alignments) define their own backend interface; see
§"Upload patterns".

#### Whole-map synced: skipping a region without leaving stale buffers

`sync(sources)` is a full rebuild by contract. Two `deleteRegion` calls make that
safe with no HAL-side transaction: a key absent this sync is swept, and a key
whose payload changed is wiped whole before its unconditional re-uploads, so a
pass whose data went empty cannot leave stale bytes. The wipe is cost-neutral
because `uploadBuffer` destroys and recreates each buffer anyway. The skip
exists because the upload autorun fires on far more than new data (a band-resize
drag frame re-derives `sourceSections`).

- **The wipe, like the skip, is whole-region.** A per-pass decision would need
  each caller to enumerate its passes.
- **Forget a key when it leaves**: delete the HAL buffers and the memo entry
  together, or a returning region with an identical payload skips an upload onto
  destroyed buffers.
- The memo lives on the renderer (`GpuAlignmentsRenderer.uploaded`), so it drops
  exactly when the buffers do on context loss. It stores array identities only,
  so an evicted region is not held alive.
- **The one sub-region exception is the recolor.** `readYs` identity means "same
  layout run" (layout allocates it fresh; the colour tier spreads over it), so
  same bytes except the two per-read colour arrays rewrites the read pass alone.
  This needs the model to bake colour in its own computed downstream of layout
  (`laidOutByGroupUncolored` → `laidOutByGroupFramed` → `laidOutByGroup`); see
  `syntenyInstanceCache` in FETCH_KEYS.md, "`gpuProps()` and derived region maps".

Synteny's level-of-detail axis is a fetch concern: [SYNTENY_LOD.md](SYNTENY_LOD.md).

### Wiggle-family contract

Displays with a score axis (wiggle, Manhattan, marks) share types, scale
utilities and score-plot pieces across two packages.

`@jbrowse/wiggle-core` is the cross-plugin contract; importing it avoids a
dependency on the wiggle plugin's MST factories or RPC methods. It holds
`renderingBackendTypes.ts`, `dataTypes.ts`, `normalize.ts` (scale-type codes,
`makeScoreNormalizer` re-exported from `@jbrowse/render-core/scoreScale`),
`displayModel.ts`, `scale.ts`/`autoscale.ts`, `scoreMenuItems.ts`
(`makeScoreSubMenu`), `pointMarker.ts`, `resolveRenderState.ts`,
`transferables.ts`, `WiggleScoreConfigMixin` / `ScoreFieldConfigMixin`
(`ScoreFieldConfigMixin` adds `scoreField`; the mark display uses the base), and
the subpaths `ScorePlotChrome` / `ScorePlotSvgFrame`. **Chrome and SVG frame are
subpaths, not the barrel**: a config schema imports the barrel at plugin install,
and `index.eager.test.ts` fails if the barrel reaches them.

`@jbrowse/plugin-wiggle` holds the wiggle displays' own pieces.
`linearWiggleDisplayConfigSchema` comes off the barrel; the model factory
**cannot**, because the display registers a state model loader and a value edge
from the eager barrel would undo it. Import
`@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel` from inside the
composing display's own lazy loader. `WiggleCommonMixin()` adds palette,
rendering type, summary mode and resolution; its zoom rule is the adapter's
`zoomRange`
([ADR-125](../architecture-decision-records/adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md)).

GWAS's Manhattan is the mark display with a default plot
([ADR-178](../architecture-decision-records/adr-178-manhattan-is-the-mark-display-with-a-default-plot.md)).
It is zoom-independent: the same `rpcProps` at every zoom and no `zoomRange` on
the payload.

### Upload patterns

**One installer, one contract.** A display's wiring is one call,
`installUpload(self, backend, { cells, inputs?, encode?, render })`
([ADR-088](../architecture-decision-records/adr-088-one-upload-installer-over-one-cell-contract.md)).
`cells` is a map of immutable payloads. The installer diffs it by reference on
every commit, encodes and uploads what moved, releases what left, and re-uploads
everything into a fresh backend after context loss. Every backend implements
`upload(key, data)` and `release(key)`, so what remains per display is **what its
map is keyed by**:

| Key | Contract | Use when | Examples |
|---|---|---|---|
| `displayedRegionIndex` | `PerRegionRenderingBackend` | each region's data is independent, or a whole-map computed hands back per-region payloads | canvas, wiggle, MAF, manhattan, sequence, multi-variant |
| a slot name, via `oneCell` | same, over one canvas-wide block | one payload for the whole view | HiC, LD, variant matrix; alignments' `sources` |
| a sibling's `sharedBackendKey`, one canvas-wide block each | same | one canvas paints several displays | dotplot, the synteny level, multi-way synteny |

- **A cell keyed on a value reads it from its own computed.** The diff is by
  reference, so a cell built from a per-frame render-state getter re-uploads per
  frame. Synteny's clicked-outline cell once read `clickedFeatureId` off
  `renderParams` and re-packed on every pan frame. **No rendering gate sees this**
  (the picture is identical); a test that pans with a selection live and counts
  `upload` calls does (`outlineUploadSchedule.test.ts`).
- **Release is per key, never an active-set prune.** The diff knows which keys
  departed, and a prune computed from one display's map would wipe its siblings'
  buffers on a shared canvas (the HAL's old `pruneRegions(active)`). That is why
  the three installers (ADR-079) collapsed to one.
- **A display with two cells of different kinds** keys them by name; `encode`
  sees the key (`encode(data, props, key)`) and the backend's `upload` tells them
  apart by type.
- **Absence is absence.** A whole-view display with nothing fetched leaves the
  key out (`oneCell(0, self.rpcData)` does), so the key is released and the frame
  clears. A fetch that came back *empty* must stay in the map, so `renderBlocks`
  answers true and `canvasDrawn` flips; otherwise the scrim never lifts.
- `sharedBackendKey(self.id)` rides on `displayedRegionIndex`, the key a block
  was uploaded under. The multi-way stack keys its named layers through the same
  hash so gutters and lanes share one map. A dotplot or synteny corner's screen x
  is a `panPx` fold, so a canvas-wide block per cell is an identity clip.
- MAF is **per-region**: its blocks are independent, so each upload re-encodes in
  isolation. Alignments' whole-map `sources` cell exists only because pileup Y
  rows must be consistent across `displayedRegions` (a read spanning a boundary
  needs one row in both); its renderer holds the memo of what it last sent.

#### Every backend extends a base, and the reason is the error channel

`GpuRenderingBackendBase` / `Canvas2DRenderingBackendBase` hold `hal` + uniform
scratch (or `canvas` + 2D context), `dispose` and `setErrorHandler`, which routes
a HAL over-limit allocation to `renderError` and raises the "too much data to
render on this GPU — zoom in" banner. `setErrorHandler` is **required** on
`RenderingBackend`, so a backend that skips a base is a compile error. It used to
be optional (`r.setErrorHandler?.()`), and the three largest vertex-buffer
allocators were exactly the three whose OOMs reached nobody: the console got a
line and the view painted blank. `?.` on a capability every implementer needs
reads as tolerance and spends as silence.

#### One autorun and a diff (`installUpload`)

The helper remembers what it last sent per key, so chromosome 5 arriving uploads
chromosome 5, not all 24. A settings change re-encodes and re-uploads all of
them, which is why a display must *declare* what its encode depends on.

```ts
installUpload(self, backend, {
  cells: () => self.rpcDataMap,
  inputs: () => self.gpuProps(),                 // omit if encode needs nothing
  encode: (data, props) => encode(data, props),  // omit if payload == backend input
  render: (b, encodedOrMap) => b.renderBlocks(self.renderBlocks, encodedOrMap, self.renderState),
})
```

- **Omit `encode` when the held payload is what the backend takes.** The helper
  then skips the step and allocates neither mirror map; `render` receives the
  display's own map.
- A cell re-encodes when its own entry is replaced or `inputs` changes identity,
  and re-uploads when its encoded payload changes.
  [ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md)
  has the reasoning.
- **`inputs` is the whole contract.** `encode`'s own reads wake the autorun but
  invalidate nothing, so a wide read there re-runs the diff and encodes nothing.
  Anything a settings change must reach the buffer through goes in `inputs`,
  which the helper memoizes as a computed.
- **This fixes uploads and encodes only. Draws stay O(N²)**: `renderBlocks`
  clears and redraws every loaded region. Read
  [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data)
  before chasing the rest.

**Why `LinearBasicDisplay` and alignments are whole-map rather than streamed:**
they lay features into Y rows across all loaded regions, so any arrival can
change everything already loaded. A whole-map computed (`laidOutDataMap` /
`laidOutPileupMap`) is the upload payload, with no encode step, handed to the
same installer (`cells: () => self.renderDataMap`). Layout therefore stays on the
main thread; ADR-053 settles that for alignments and says what to attack
instead. `LinearBasicDisplay` recovers O(N) through `createIncrementalLayout`
(`plugins/canvas/src/LinearBasicDisplay/layout.ts`), which memoizes per
ref-group ([ADR-017](../architecture-decision-records/adr-017-wiggle-per-key-autoruns.md),
[ADR-011](../architecture-decision-records/adr-011-canvas-flatbush-immutable-offsets.md)).

**A shared-canvas backend wants the memo one level down: the colour-lane
patch.** A recolor yields a fresh `colors` array over the same coordinate
arrays. Both synteny mark lists hold a `createInstanceCache`
(`@jbrowse/render-core/instanceCache`) inside the shape's `pack`, memoizing on
`(geometry identity, colors identity)` and patching the colour lane in place.
The GPU re-upload still happens (no partial-buffer update in the HAL), but the
CPU interleave, which dominates at 10⁵–10⁶ instances, does not. A plugin
supplies `InstanceCacheOpts` (geometry token, colour accessor, stride, colour
offset). The model-side half is
[FETCH_KEYS.md](FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).

## HAL (Hardware Abstraction Layer)

The HAL hides the WebGPU/WebGL2 difference and lives in
`packages/render-core/src/hal/`. The full interface is `hal/types.ts`.

### The remaining "pass" names mean the pipeline, not WebGPU's render pass

**`PipelineDescriptor` is a pipeline state object.** It carries shader source,
vertex layout, blend state, topology and texture bindings, and compiles to one
`GPURenderPipeline` (`resolvePipelines`, `webgpuHal.ts`) or one linked program +
VAO (`link`, `webgl2Hal.ts`). **The identifiers around it still say "pass"**
(`passId`, `drawPass`, `slangPass`, `InstancePass`, `*_PASSES`); read each as
"pipeline". The rename stopped at the type because `passId` is a join key spelled
identically across hundreds of call sites.

**WebGPU's render pass is the `beginFrame`/`endFrame` bracket**: exactly one per
frame, with the MSAA attachment and resolve target. Batching the frame into one
pass resolves MSAA once instead of per draw.

| Reads like | Actually is |
|---|---|
| `drawPass(passId, regionKey)` | bind PSO `passId`, bind that region's vertex buffer, issue **one instanced draw**; does not begin a pass |
| `beginFrame` / `endFrame` | open and close **the** render pass, plus command encoder and submit |

**The two HALs build pipelines at opposite times.** WebGL2 builds on first
*draw* (`getPass`), keeping one canary link in the constructor so a GL stack that
cannot compile our shaders falls to Canvas2D. WebGPU resolves the whole declared
list before `WebGPUHal.create` returns, so first paint waits on every pass;
measured, that is cheap (concurrent, off the main thread), and
`hal/deviceGpuCache.ts` memoizes pipelines per device so displays share them.
Why going lazy would cost more:
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md#every-webgpu-display-resolves-its-whole-pass-list-before-it-can-paint).

**Both HALs key a compile by what it compiles, never by the pass id.** WebGPU
keys a `PipelineRecipe` (WGSL, vertex layout, blend, topology, textured, sample
count), so the key cannot miss an input. WebGL2 keeps a per-context map (a
program belongs to its context) keyed on vertex source, fragment source,
attribute names and sampler unit. `deviceGpuCache.test.ts` and
`webgl2HalPrograms.test.ts` pin both.

```
createGpuHal(canvas, { passes, sampleCount }): Promise<GpuHal | null>
  ?renderer=canvas2d|canvas  → null                     (Canvas2D backend)
  ?renderer=webgl            → skip WebGPU, try WebGL2 → null on failure
  ?renderer=webgpu           → WebGPU only, error on failure
  otherwise                  → WebGPU → WebGL2 (not on a software rasterizer) → null
```

**`?renderer=webgpu` pins that rung and does not fall past it.** A pinned
renderer that silently substitutes another makes every comparison wrong, so
`createGpuHal` raises a `renderError` naming the pin, with "use Canvas2D" as the
way out. Prove which backend ran by asserting on the HAL, not the URL.

`bufferPassId` on `drawPass` lets one pass draw off another's instance buffer
(chevron off line's, continuation off rect's). Each pair declares one shared
struct (`lineInstance.slang`, `rectInstance.slang`) and
`sharedInstanceBuffers.test.ts` pins the layout. No unit test sees whether each
HAL binds the offsets it was handed (`vertexAttribPointer` for WebGL2,
`vertex.buffers` for WebGPU); that shows only as garbled geometry on a GPU
machine, and `browser-tests/probe-continuation-strand.ts` checks it.

**An empty upload IS the release.** Every HAL deletes the pass's prior buffer
before looking at the count, so `uploadBuffer(key, pass, data, 0)` means "nothing
this time", and `uploadPass` passes an empty pack through. Skipping the call to
save an upload leaves the previous frame's bytes on the GPU.

**Replacing a buffer mid-frame is legal because WebGPU defers the release.**
`destroy()` is validated against `queue.submit`, so freeing a buffer an open pass
already drew from fails the **whole** command buffer, blanking every track in the
frame with only a console validation error. `WebGPUHal` pushes every release onto
`pendingDestroy` while `currentEncoder` is non-null and drains it after submit in
`endFrame` (also on the throwing path, and in `dispose`), through the
`RegionRegistry` destroy hook. WebGL2 is immediate-mode and needs none of this.
`MockHal.replacedWhileDrawn()` is where a renderer test says which shape it has.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery), `WebGL2Hal`
(`antialias` above one sample, VAO + UBO, context-loss recovery), `MockHal`
(tests). Both real HALs take the display's sample count, 1 where every pass
declares `//! coverage: analytic`. All three extend `GpuHalBase`, which owns the
descriptor map, the `RegionRegistry`, the `uploadBuffer`/`uploadTexture` shells
with their over-limit refusals, `setErrorHandler` and the once-only `dispose`. A
leaf supplies `limits()`, `createBuffer`, `destroyBuffer`, `createTexture` and
`releaseResources`. `MockHal` overrides the shells to log and then calls
`super`. `gpuHalBase.test.ts` pins the refusals.

### WebGL2 contexts are a page-level budget, one per display

`WebGL2Hal` takes its own `getContext('webgl2')` with no pooling, and each
display owns one backend canvas. The count to watch is **open GPU tracks**;
chromosomes are free (a whole-genome view is one canvas, one buffer per
`displayedRegionIndex`, drawn as scissored blocks). `WebGPUHal` has no cap, since
every display shares the `gpuDevice.ts` singleton, **a primary reason the GPU
path targets WebGPU.**

- `stopRenderingBackend` + `dispose()` on unmount returns a context. Views
  lazy-mount (`useViewVisibility.ts`); tracks within a view do not yet.
- `?renderer=canvas2d` allocates none.

The cap, what happens past it and the mitigations:
[GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) and
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"One WebGL2 context per
display canvas". Don't restate the numbers here.

**A failed device acquisition is cached, except after a loss.** `getGpuDevice()`
memoizes its promise, so null normally means "no WebGPU here". But the re-init
after `device.lost` asks for an adapter within a frame of the loss, when
`requestAdapter` still declines on sleep/wake or a driver reset, and caching that
pins the page to WebGL2 until reload. `gpuDevice.ts` tracks `hadDevice` and past
that point retries (3 × 700 ms) and never caches a failure.

### A WebGPU canvas's configuration belongs to the element, not to the HAL

`canvas.getContext('webgpu')` returns the **same** `GPUCanvasContext` every time,
so the swap chain is per-element state. Two HALs can share one (a `model` prop
swap, an init overlapping a cancelled one), and `WebGPUHal.dispose()`'s
`unconfigure()` then releases the live HAL's. Firefox answers every later frame
with `InvalidStateError: ... Canvas not configured`, and there is **no
context-lost event** for it, so recovery never runs and the raw DOMException
banners until reload. `unconfigure()` is the only thing that drops the
configuration; `device.destroy()`, detach/reattach, resize, `display: none` and
a hidden tab do not.

Two guards in `webgpuHal.ts`: `canvasConfiguredBy` (`canvasContext.ts`) lets
`dispose()` release only its own configuration, and a frame that finds the swap
chain gone rebuilds it and paints. A rebuild that fails is reported once through
the error handler, not retried. Reproduce with
`products/jbrowse-web/browser-tests/swapchain-steal-probe.ts`.

### Renderers stay stateless

A GPU renderer owns only the `GpuHal` reference, pre-allocated uniform scratch,
and save/restore UBO scratch where a pass mutates uniforms. Do NOT keep:

- **Region-lifecycle bookkeeping.** `installUpload` releases each departed key
  through `hal.deleteRegion(key)`; the HAL is the authority on which regions
  have buffers.
- **Per-region metadata derivable from `rpcDataMap`** (`hasRects`, `outlineColor`).
  `drawPass` skips missing buffers, and per-region scalars reach uniforms through
  a mark's `params(state, region)` (`outlineColor` in `canvasFeatureMarks.ts`).
- **Write-only mirror copies** of upload data.

Anything the upload callback knows from observable inputs can be looked up at
render time too, and less local state means fewer divergence points.

**The one legal renderer-held region map** is a private `regions` map written
**exclusively by the upload callback** and never mutated in place:
`RenderLifecycleMixin` bumps `renderTick` after every upload, so the cache cannot
stale. Alignments is the one display built that way. Still forbidden: a cache
populated elsewhere, entries patched in place, and mirroring the HAL's region map.

## Shaders (Slang codegen)

Production draw shaders are `.slang`, compiled to WGSL (WebGPU) and GLSL ES 3.00
(WebGL2) by `packages/shader-tools/src/build-shaders.ts`. slangc has no GLSL ES
target (desktop `glsl_110`–`glsl_460` only), so `-target glsl` yields
Vulkan-flavoured desktop GLSL and `vulkanGlslToWebgl2.ts` is the adapter down to
ES 3.00. The SPIRV-Cross alternative was declined in
[ADR-061](../architecture-decision-records/adr-061-webgl2-glsl-comes-from-the-regex-adapter.md).
Authoring conventions: [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md).

**Never hand-edit `*.generated.ts`.** Edit the `.slang` and run `pnpm
gen:shaders` (check its exit code). The generated module exports byte offsets,
strides, typed uniform/instance structs, `writeUniforms()`, `packInstances()`,
`VERTEX_ATTRIBUTES` and `SOURCE`, so packer/shader drift is impossible by
construction. CI runs `pnpm gen:shaders && git diff --exit-code`, and the build
refuses a `.generated.ts` no `.slang` produces any more (a renamed shader leaves
one frozen, the staleness a diff cannot see).

**A shader's text is not on the module a consumer imports.** It lives in
`<base>.wgsl.generated.ts` and `<base>.glsl.generated.ts`; `SOURCE` is one
`import()` of each, awaited by each HAL while it is built, before the canvas
context is claimed. The RPC worker evaluates no shader text, a WebGPU session
never evaluates GLSL, Canvas2D neither
([EAGER_BUNDLE.md](EAGER_BUNDLE.md) §"Shader text loads when a HAL is built").
Held by `shaderSources.test.ts`, the `noShaderTextImport` lint rule and
`measureRegistryBundle.ts`.

**Binding tables are generated.** `BINDINGS` is the reflected `@binding` list
(`{ index, kind, name, stages }`). The WebGPU HAL builds bind-group layouts from
it (`bindGroupLayoutEntries`, `hal/deviceGpuCache.ts`), each binding visible to
exactly its `stages`, as does `computePipeline.ts`. `pnpm gen:shaders` refuses a
render shader whose table the HALs cannot bind: uniform block at 1, optional
`Sampler2D` at 2/3, a second at 4/5.

- **Which stage reads a binding is the shader's answer, not the HAL's.** A
  hand-set layout hid the ramp from the vertex stage and WebGPU rejected both
  pipelines, so those displays silently drew on WebGL2. The build compiles each
  entry point alone (slangc marks `used` only then), and
  `assertStageReadsMatchWgsl` holds it to the emitted WGSL.
  `webgpuHalBindingVisibility.test.ts` builds every pass through the real
  `WebGPUHal` against a recording device.
- **Reflection and emitted WGSL are cross-checked** (`assertBindingsMatchWgsl`):
  they come from different slangc passes and only the WGSL runs. It is
  one-directional because slangc drops a binding the body never reads. A
  `SLANG_VERSION` bump trips it if the sampler expansion (`index + 1`) changes.
- **A sampler's filter comes from the module whose math needs it.**
  `//! texture-filter: [sampler] nearest | linear` has no default and is
  **inherited through `import`**. `colorRampLut` declares `linear`; `rowTable`
  declares `nearest`, because `(x + 0.5) / w` at a non-power-of-two width does not
  round-trip through a linear tap and silently lands a row on the wrong lane. A
  shader declaring a sampler with nothing in scope, or two modules wanting
  different filters, is refused.

**One suffix, one meaning: `_BYTES` / `_WORDS` are units; `_F32` / `_U32` /
`_I32` are typed-array views.** The layout surface is `INSTANCE_STRIDE_BYTES`,
`INSTANCE_STRIDE_WORDS` and `INSTANCE_OFFSET_F32` / `_U32` / `_I32`, each map
holding only fields of that Slang type, matching `UNIFORM_OFFSET_*`. A flat
offset map once let `f32[o + F.position]` on a `uint` field compile and write a
float bit pattern the shader read as an enormous integer; the flat map and
`INSTANCE_STRIDE_F32` are gone. A hand-written packer names the view it writes
through, and the wrong one does not compile. A package that cannot import the
plugin owning the `.slang` (`alignments-core`) gets typed layouts through
`layout-out` rather than a prose restatement of the struct.

**Layout.** Display shaders live in `plugins/<plugin>/src/<display>/shaders/`,
per-plugin shared ones in `plugins/<plugin>/src/shared/shaders/`, cross-plugin
modules in `packages/render-core/src/shaders/`: the atoms (`hpmath.slang`,
`antialias.slang`, `colorPack.slang`) and shared *shapes* (`pointGlyph`,
`diagonalGrid`, `rowRect`, `capsule`). A shape earns a module on the
`pointGlyph` bar, two real consumers with a live drift hazard, not surface
similarity ([ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)).
[SHADER_SHAPE_LIBRARY.md](SHADER_SHAPE_LIBRARY.md) says what each shape draws and
the two splits that keep the set from becoming a framework; read it before
pointing a second consumer at one.

**The coverage band is the one shared *pass set*.** `coverageBand.slang` declares
the band's uniform struct, geometry and depth normalizer and the five entry
points (`coverageBar`, `coverageSnp`, `coverageMod`, `coverageInterbase`,
`coverageIndicator`). The pileup band and the MAF band both declare them through
`@jbrowse/alignments-core`'s `coverageBandMarks`, because a mark's height rule is
shared with the buffer layout and Canvas2D painter it must land on. The display
owns where the band sits: MAF declares the mark's `band`; alignments scissors per
section.

`slangPass()` turns a generated module into a `PipelineDescriptor`; its overrides
are `topology` and `blendState`.

### WGSL validates what GLSL waves through

A shader can pass `pnpm gen:shaders`, run on WebGL2, and fail
`createShaderModule` on WebGPU. The only signal is a `[GPU] UNCAPTURED ERROR` /
`GPUPipelineError` in a WebGPU browser.

- **Derivatives (`ddx`/`ddy`/`fwidth`) must sit in uniform control flow.**
  Branching on a varying and taking a derivative inside the branch fails. Each
  branch picks only its SDF and the derivative + AA ramp run once after it
  (`pointMark.slang`), or compute every alpha before the branch
  (`wiggle.slang`). Reconvergence restores uniformity; `discard` does not demote
  it.
- **A `max` blend takes no factors.** `BlendState` makes `{ op: 'max' }` a variant
  with no factor fields.

To check every shader at once, drive puppeteer at a **secure origin**
(`navigator.gpu` is undefined on `about:blank`) with a WebGPU-capable Chrome,
import each `*.generated.ts`, read `createShaderModule(...).getCompilationInfo()`,
and wrap `createRenderPipeline` in `pushErrorScope('validation')`.

## Canvas scaling & hi-DPI

**GPU canvases (HAL-managed):** uniforms are in CSS pixels and the HAL sets the
backing store to `css × dpr`. Do not scale by `devicePixelRatio`.

**2D overlay canvases** (`VisibleLabelsOverlay` and the like): the caller owns
DPR. Set `canvas.width = w * dpr` and `canvas.height = h * dpr`, call
`ctx.scale(dpr, dpr)`, and put CSS `width`/`height` in the style. Skipping this
blurs on Retina. `prepareCanvas` (`packages/render-core/src/canvas2dUtils.ts`)
does it for the on-screen Canvas2D path; standalone overlays must replicate it.

## Antialiasing ramps: how wide, and where the width comes from

**`packages/render-core/src/shaders/antialias.slang` is the rule.** It holds both
ramp widths, the one ramp shape and `glyphEdgeAlpha`, and its header says which
width a shader gets.

The recurring bug is an **AA ramp whose width was measured with `fwidth`, and/or
whose geometry had no room for it.** `fwidth` is `|ddx| + |ddy|`, overshooting a
true gradient by up to √2, worst on diagonals. A too-wide *linear* ramp does not
thicken a mark, it dilutes it (the half-max contour does not move), so look for
dilution, not a fat line. Sweep with `grep -rn 'fwidth(' --include='*.slang'
packages plugins example-plugins`; the one hit is `continuation.slang`'s
barycentric wireframe estimator, whose comment says why it stays. A second call
site is what would justify a `//! fwidth-ok:` directive.

The right width depends on what the SDF is measured in:

- **Distance already in pixels** (synteny `perpCoverage`, dotplot capsule,
  wiggle's capsule, the xyplot bar's horizontal cuts): `|∇d| = 1`, so the full
  width is `aaPx(dpr)`. Call `edgeCoverage(signedInkCssPx, dpr)`, the only
  spelling the build can see; a shader reaching it without a `devicePixelRatio`
  uniform fails `pnpm gen:shaders`
  ([ADR-098](../architecture-decision-records/adr-098-one-ramp-one-unit-and-the-build-checks-it.md)).
  **A varying set from the same screen y the vertex converts to clip is in this
  case**: it is affine with unit slope (`vertCoverage`, `barInkPx`).
- **Not a perpendicular distance in known units** (quad-local SDFs whose scale
  differs per shape, as in `pointGlyph` and manhattan; or chevron's foreshortened
  `dist`): measure with `aaGradient`, taken as the **full** width. It is also the
  only option for a shader with no `devicePixelRatio` uniform.
- **Tiled cells** (hi-C bins): no per-quad AA at all, deliberately. Bins share
  exact edges, so antialiasing each produces seams. The same refusal covers marks
  that STACK (wiggle step-line quads, the coverage band's SNP/modification
  segments), which keep hard edges. See §"What the coverage band cannot
  antialias".

**There is one ramp shape, the linear `aaRamp`.** `scripts/aa_ramp_coverage_study.ts`
scores linear and cubic against exact pixel coverage of a straight edge: linear
is closer at every angle, so the cubic's "softer" look is extra ink on both sides
of the half-max contour. A band built as `ramp(d) - ramp(d - W)` is exact at
every width with linear, where cubic paints a half-pixel band at 0.688 instead of
0.500. `aaSmoothRamp` is deleted, not deprecated: an uncalled shader function is
dead-code-eliminated and `pnpm gen:shaders` then fails its js-skip check. The
linear form takes the FULL ramp width where smoothstep took the half, so
`aaSmoothRamp(d, halfPx)` becomes `aaRamp(d, 2.0 * halfPx)`; getting it wrong
still compiles at half or double width.

The predicted cross-backend drift from the cubic-to-linear conversion was never
measured and no longer can be; see
[CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) § "The AA ramp prediction outlived
its instrument". A ramp change and the per-display MSAA sample-count question
([ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md))
land on the same pixels, so record the commit any drift table was measured at. A
second `runner.ts` in the same worktree wedges both runs (a golden refresh
`rm -rf`s `browser-tests/__snapshots__`); check `ps -Ao command | grep runner.ts`.

**A ramp needs geometry to live in.** Widening one without padding the quad clips
it. The dotplot capsule quad is `halfWidth + aaHalfPx(dpr)` on both axes, the
reach exactly (over-padding blends alpha-0 fragments anyway), with a `discard`
for fragments the pad introduces. `dotplotCapsulePad.test.ts`,
`glyphEdgeAlpha.test.ts` and `syntenyFillPad.test.ts` mirror the shader in TS and
assert the geometry contains everything the fragment shades; they *model* the
shader, so a `SYNC` comment keeps them honest. **A model test cannot check an
agreement it models from one source**: `syntenyFillPad.test.ts` built the polygon
and the analytic clip from one `fillEdges`, so it could not catch a
corner-to-edge pairing drift. `ribbonEdges` is one pairing, so the property is
structural.

The pad costs fill (`browser-tests/probe-dotplot-pad-cost.ts` measures it). The
cost scales opposite to the area *ratio* (per-instance setup dominates thin
lines), and the `discard` is not a lever, since along a line's body the pad ring
is the outer half of the ramp. Headless Chrome's SwiftShader reports the pad as
free; measure in a headed browser.

### Which backend disagreement is evidence, and which is not

Ask whether a change moves one backend or all at once. `pnpm
test:browser:compare` diffs `webgl` / `webgpu` / `canvas2d`. For a GPU-only
change Canvas2D is an independent render of the same marks, so "closer to
Canvas2D" replaces "looks better" with a number. It is **no oracle** for a change
reaching every path together: a `//! js-export`ed function whose twin Canvas2D
and SVG call (`fillShade`), or a constant a CPU path imports from the shader
(hi-C's `MIN_VISIBLE_ALPHA`). Those agree on the new answer, right or wrong, and
need a snapshot diff or an eye. Decide which side a change falls on before
planning verification.

Hover has no suite: `browser-tests/hover-probe.ts` drives
`setHoveredInstanceIdx`, never the mouse (a miss is indistinguishable from a cue
that draws nothing), and requires a settled non-blank frame because the repaint
clears first.

### A bar's top edge is the datum, and it is measured

The xyplot bar's top is the one edge where aliasing corrupts an *encoding*: the
reader takes the score off it. `wiggle.slang` therefore computes its own coverage.
`barInkPx` carries CSS px below each horizontal cut, the fragment differences two
`aaRamp`s, and the quad grows one device px past each cut, the ramp's full width,
so rasterizer coverage never multiplies the analytic one and the bar is identical
at one sample and four. `aaHalfPx` (the capsule pad) is not enough: it uncrops
the ramp but leaves the fringe pixel partly covered. Both cuts are needed: a
single top ramp against a hard baseline paints a half-covered row under a
zero-height bar, a dotted line along the origin on a wiggle of zero bins.

**Neighbouring bars share pixel columns.** `extendToMinWidthX` floors a bin at
`MIN_FILL_WIDTH_PX`, and bbi bins are no wider than `2 * bpPerPx`, so bars overlap
two or three deep. Where tops agree (a plateau) the fringe row composites
`1 - (1 - a)^n` instead of `a`, up to 0.375 device px of apparent top error,
where MSAA's coincident coverage was exact. The change still wins: it replaces a
0.277 device px quantisation error on every column, and is a clear win wherever
neighbours differ. The baseline over-inks the same way, and multi-row multiwiggle
adds an opposite-sign case, where edge-to-edge rows composite two tiled edges to
0.75 instead of 1.0 (separator lines default off, so nothing covers it).

<!-- BEGIN GENERATED MEASUREMENT wiggle-bar-top-subpixel -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                          | mean top error (device px) | max   | columns with the top on a whole device px |
| ---------------------------- | -------------------------- | ----- | ----------------------------------------- |
| before, 4 samples (shipping) | 0.069                      | 0.102 | 179                                       |
| before, 1 sample             | **0.277**                  | 0.475 | **2,151**                                 |
| after, 4 samples             | 0.00                       | 0.00  | 179                                       |
| after, 1 sample              | 0.00                       | 0.00  | 179                                       |

<!-- END GENERATED MEASUREMENT wiggle-bar-top-subpixel -->

`shaders/barCutCoverage.test.ts` pins both properties. The independent check is
the cross-backend gate: Canvas2D antialiases that cut, so a correct shader moves
TOWARD it. Every pair that moved, fell (webgl under swiftshader here, against
WebGPU above):

<!-- BEGIN GENERATED MEASUREMENT wiggle-bar-top-backend-drift -->

_Generated by `pnpm autogen` — edit the source, not this block._

| snapshot pair                          | before | after | change |
| -------------------------------------- | ------ | ----- | ------ |
| targeted_bigwig-multibigwig-xyplot     | 0.15%  | 0.01% | -0.14% |
| targeted_bigwig-multibigwig-multirowxy | 0.11%  | 0.02% | -0.09% |
| fullpage_bigwig-multibigwig-xyplot     | 0.04%  | 0.00% | -0.04% |
| fullpage_bigwig-multibigwig-multirowxy | 0.04%  | 0.01% | -0.03% |
| targeted_additional-color-wiggle       | 0.39%  | 0.37% | -0.02% |
| targeted_bigwig-gc-skew                | 0.02%  | 0.00% | -0.02% |

<!-- END GENERATED MEASUREMENT wiggle-bar-top-backend-drift -->

### What the coverage band cannot antialias

**The same change does not go on the alignments coverage band**, because every
mark there shares a horizontal edge with another:

- `coverageSnp` / `coverageMod` segments **stack** (each accumulates `yOffset`),
  so per-fragment alpha on both sides of the shared edge composites to less than
  full ink and leaks the grey depth bar (Kilgard & Bolz's conflation, which MSAA
  avoids by keeping coverage exclusive per sample).
- The topmost segment's top **coincides** with `coverageBar.slang`'s depth-bar top
  when a position is fully mismatched. Ramping one puts a grey fringe above the
  column; ramping both puts up to 0.25 of one there. Hard edges tile exactly at
  any sample count.
- `coverageInterbase` is already `floor(… + 0.5)` on both y edges, deliberately.

The shape that would let the band go analytic is §5 of
[ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md):
draw a position's whole stack as ONE primitive and derive the segment in the
fragment.

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions`, stable unless regions are added,
removed or reordered. **Not** an index into `dynamicBlocks.contentBlocks`: one
displayed region can yield several render blocks that share one GPU buffer and
draw with different scissor clips. It joins `model.rpcDataMap`,
`hal.uploadBuffer(regionKey, ...)` and `RenderBlock.displayedRegionIndex`. A
comparative display keys on `sharedBackendKey(self.id)` instead, and dotplot
rides that hash on the block's field, so the field is the key a block was
uploaded under, not always an index.

## What this architecture deliberately does not have

Each entry is a standard real-time-rendering technique a reader with a
game-engine background will reach for. The reason it is absent is stated in
that vocabulary.

**Render graph / frame graph.** Ours has one render pass, one colour attachment,
no offscreen targets and no pass consuming another's output. Ordering is a
static z-ordered mark list (`PILEUP_MARKS`, the coverage band's) and resource
lifetime is `RegionRegistry`'s. A shared list of layer ids with z-order and gates
plus a `Record<LayerId, …>` per backend is narrower than a frame graph: no
dependencies, no targets, no scheduling. See the layer-manifest decline and its
overturn in `agent-docs/architecture-decision-records/`.

**Indirect drawing.** The instance count is already the packed buffer's
`byteLength / instanceStride`, computed CPU-side, so there is no roundtrip to
remove. **The condition:** this holds while every instance buffer is packed
CPU-side. The day a compute kernel produces a pass's instances, reopen it for
that pass.

**GPU-driven culling.** Culling stays CPU-side. Declined twice with numbers:
dotplot (quads of a few px, which the rasterizer discards as cheaply as a vertex
test) and hi-C contacts by distance from the diagonal. Synteny's `isCulled`
earns its place because its quads span the track.

**Storage buffers (SSBO) in the render path.** Every pass feeds per-instance data
through a vertex buffer with `stepMode: 'instance'`. Slang cross-compiles to GLSL
ES 3.0, which has no SSBOs, so adopting them forks every shader. And the access
pattern is one instance reading its own fixed struct sequentially, which vertex
fetch serves; the largest instance struct (`read.slang`) takes 10 attributes
against a limit of 16 ([GPU_PORTABILITY.md](GPU_PORTABILITY.md)). GenomeSpy's
generic `rect` mark needs ~28 channels, so its storage buffers follow from
generic marks; ours are specific.

**Depth buffer / early-Z.** No pass declares depth-stencil state. Every pass
blends (`premultiplied`, `max` on the wiggle centre line, `behind` on the
whiskers band), and blending composes correctly only in draw order. A depth test
rejects exactly the fragment a translucent mark behind it should show through.
Order is the correctness mechanism; early-Z would save only opaque overdraw the
rasterizer already discards cheaply.

**Persistent staging / mapped buffers.** Uploads use `queue.writeBuffer` and
`gl.bufferData`, never a `mapAsync` ring. `writeBuffer` is the browser's staging
ring, minus the `mapAsync` round trip. The uniform ring (`uniformRingBuffer`)
turns per-draw uniform writes into one frame-level copy, not to avoid allocation.

**Compute where a CPU fallback must exist anyway.** Compute is right when the CPU
fallback is "the feature does not exist", and wrong when a CPU fallback must
exist anyway. The LD kernels passed (O(n²) pairwise, parallel, a CPU version too
slow to be a fallback); `ideas/waiting-on-a-call/gpu-sample-distance-matrix.md`
applies the criterion to the next candidates. Instance packing fails it:
Canvas2D is a mandatory floor, so a compute packer would be a second packer
emitting bytes the first must match, the drift `packInstances()` exists to
prevent. The cost sits in branchy BAM/CRAM decode and row assignment anyway.
`createInstanceCache` already covers re-deriving from resident data.

**Spatial acceleration structures for culling.** Flatbush indexes
**hit-testing and picking**, never what to draw. The genome axis is 1D and
`view.displayedRegions` is already the spatial partition.

**Draw-call batching.** One instanced draw per `(pass, region)` with data. Our
analogue of GenomeSpy's sample-facet coalescing is a row inside one instance
buffer, already one draw. Measured draws per frame are in the tens, not the
thousands where a budget binds (table below), and frames are main-thread bound
([INTERACTION_PERF.md](INTERACTION_PERF.md)). Merging would have to cross region
boundaries, where scissor, viewport and per-block uniforms change.

**Buffer pooling / sub-allocation.** `uploadBuffer` destroys and recreates one
`GPUBuffer` per `(regionKey, passId)` per upload. **Measured and declined**: a
pan allocates buffers at the fetch cadence (one per pass per newly fetched block),
a pan inside loaded blocks allocates none, and time inside create calls is a
negligible share of the gesture. WebGL2 is the rung to read, since `bufferData`
allocates synchronously. What would reopen it is a display whose uploads arrive
per frame; none does (§"Upload patterns").

<!-- BEGIN GENERATED MEASUREMENT buffer-churn-pan -->

_Generated by `pnpm autogen` — edit the source, not this block._

| scenario                        | rung   | buffers created |   bytes | buffers freed | time in create | gesture wall | create share | draws/frame | draws/frame max |
| ------------------------------- | ------ | --------------: | ------: | ------------: | -------------: | -----------: | -----------: | ----------: | --------------: |
| two alignments tracks, pan      | WebGPU |          **24** | 1468 KB |            20 |     **0.40ms** |      10784ms |       0.004% |          10 |              48 |
| two alignments tracks, pan back | WebGPU |              24 | 1387 KB |            28 |         0.20ms |       6614ms |       0.003% |          14 |              62 |
| two alignments tracks, 1 px pan | WebGPU |               0 |    0 KB |             0 |         0.00ms |       7930ms |       0.000% |          10 |              20 |
| two alignments tracks, pan      | WebGL2 |          **26** | 1459 KB |            20 |     **0.90ms** |      23991ms |       0.004% |          16 |              50 |
| two alignments tracks, pan back | WebGL2 |              10 |  674 KB |            16 |         0.10ms |       5117ms |       0.002% |          16 |              52 |
| two alignments tracks, 1 px pan | WebGL2 |               0 |    0 KB |             0 |         0.00ms |       4998ms |       0.000% |          10 |              20 |
| one alignments track, pan       | WebGPU |              12 |  733 KB |            10 |         0.10ms |       6126ms |       0.002% |           5 |              24 |
| one alignments track, pan back  | WebGPU |              12 |  632 KB |            14 |         0.00ms |       4018ms |       0.000% |           7 |              28 |
| one wiggle track, pan           | WebGPU |               2 |    5 KB |             2 |         0.00ms |       3457ms |       0.000% |           1 |               3 |

<!-- END GENERATED MEASUREMENT buffer-churn-pan -->

**GPU picking (id pass plus readback).** Hit-testing is analytic and CPU-side.
Picking returns a pixel id, but every consumer needs the feature record, so it
adds a pass and a readback before the same `findRead` lookup. It would also be a
*third* hit-test implementation, since the Canvas2D floor needs an analytic one,
and `readPixels` blocks on WebGL. GenomeSpy's arbitrary SDF shapes make the pixel
id the answer there. Our one real weakness, a non-rectangular mark tested by
approximation, is fixed by deriving the predicate from the shader
(§"Keeping the two backends in parity").

**Runtime shader generation.** Shaders are `.slang` compiled ahead of time, so a
worker in a package that cannot import the plugin still packs bytes that provably
match its struct (the generated `packInstances` and `INSTANCE_OFFSET` come from
the same compile). Runtime codegen forfeits that and invites the float-bits-in-a-`uint`
bug. See ADR-051 and
[ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md);
`SESSION_SPEC_FORMAT.md` asks the same question one level up.

**Nested render scopes / group opacity.** The pass list is flat and z-ordered.
GenomeSpy has scopes because its specs are trees of views whose opacity must
composite as a group. A track is a display is a canvas, displays do not nest, and
the shared-canvas views are flat co-tenancy.

## Adding a new GPU display type

The public
[GPU displays guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
walks this checklist ([Plotting
features](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/plotting_features.md)
covers the shared-shape version); keep them in step with any change here.

- **Types** — `MyData`, `MyRenderState`, `MyRenderingBackend`.
- **Shape** — `spanMark` or `pointMark` where one fits. Otherwise a `MarkShape`
  beside `my.slang` (`pnpm gen:shaders` emits `my.generated.ts`; `slangPass()`
  builds the descriptor) with its `writeUniforms`, its `paintBlock` (also the SVG
  export) and its `ink`, held to each other by a `sweepMarkAgainstHit` test.
- **Marks + backend** — `defineMark({ shape, channels, params })` per shape, and
  `createMarkBackend(canvas, MARKS)` from `@jbrowse/render-core/marks/backend`,
  imported from the lazily loaded component and nowhere else.
- **MST model**
  - `MultiRegionDisplayMixin()` for LGV-family per-region displays (brings
    `RenderLifecycleMixin`, `FetchMixin`, `RegionTooLargeMixin`, the fetch
    autoruns and `rpcProps()` wiring).
  - `GlobalFetchMixin()` for a single non-regional dataset (HiC, LD, multi-way
    synteny). It has **no** fetch autoruns; the display installs its own in
    `afterAttach` via `installGlobalFetchAutorun(self, { prepare, run, commit,
    delay, name })`. `prepare` runs synchronously and returning `undefined` is the
    display's gate, so what it read to decline stays tracked (HiC declines until
    `effectiveResolution` lands); `run` owns every await and writes nothing;
    `commit` writes while the fetch is still current.
  - `RenderLifecycleMixin()` directly only when neither fetch surface is needed.
  - A cached `renderState` view; `startRenderingBackend` calling `installUpload`
    (never a hand-rolled `attachRenderingBackend`); `rpcProps()`; `gpuProps()`
    only when the main thread encodes buffers from settings.
- **React component** — an `observer()` rendering `DisplayChrome` (from
  `@jbrowse/display-kit/DisplayChrome`) with `model`, the backend `factory` and a
  `testid`. It owns the overlays, so the component lays out only its canvas(es)
  via the render-prop child `({ canvasRef }) => <canvas ref={canvasRef} />`.
- **Wiggle-style displays** — to reuse the whole LinearWiggleDisplay model,
  compose `stateModelFactory` from the `LinearWiggleDisplay/stateModel` subpath.
  To borrow only the score machinery, compose `WiggleScoreConfigMixin` +
  `makeScoreSubMenu` and render `ScorePlotChrome` from its subpath. One plotting
  a configured field composes `ScoreFieldConfigMixin` (`plugins/gwas`); one naming
  a field per mark keeps the base (`plugins/marks`). Implement
  `WiggleRenderingBackend`. A zoom-independent display needs no cache override:
  the adapter's `zoomRange` is the zoom rule (ADR-125).
- **Tests** — unit (`MockHal`); browser (Puppeteer,
  `--backend=webgl|webgpu|canvas2d`).
