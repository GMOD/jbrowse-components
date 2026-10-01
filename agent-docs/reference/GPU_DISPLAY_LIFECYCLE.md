---
name: gpu-display-lifecycle
description: How does a GPU display wire to its model — what RenderLifecycleMixin owns, the activity phase, context-loss recovery, the installUpload cell contract and the upload patterns by map key?
kind: spec
---

# GPU display lifecycle and uploads

How a display's MST model drives its backend: the two autoruns, the activity
phase that raises the scrim, recovery from a lost context, and the one upload
installer. [GPU_RENDERING.md](GPU_RENDERING.md) is the hub and lists the sibling
docs for backends, the HAL and shaders.

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

## Context-loss recovery


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
  display canvas takes one (see [GPU_HAL.md](GPU_HAL.md) §"WebGL2 contexts are a page-level budget"). The
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

## Upload patterns


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

### Every backend extends a base, and the reason is the error channel

`GpuRenderingBackendBase` / `Canvas2DRenderingBackendBase` hold `hal` + uniform
scratch (or `canvas` + 2D context), `dispose` and `setErrorHandler`, which routes
a HAL over-limit allocation to `renderError` and raises the "too much data to
render on this GPU — zoom in" banner. `setErrorHandler` is **required** on
`RenderingBackend`, so a backend that skips a base is a compile error. It used to
be optional (`r.setErrorHandler?.()`), and the three largest vertex-buffer
allocators were exactly the three whose OOMs reached nobody: the console got a
line and the view painted blank. `?.` on a capability every implementer needs
reads as tolerance and spends as silence.

### One autorun and a diff (`installUpload`)

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

### Whole-map synced: skipping a region without leaving stale buffers


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

