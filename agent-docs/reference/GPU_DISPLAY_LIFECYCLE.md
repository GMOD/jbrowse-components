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
hand. The mixin spawns two autoruns tied to the model's lifetime, one running the
upload callback and one the render callback. MobX tracks every observable read
inside each, so no dependency is declared by hand. React components are thin
bridges: create a canvas, hand the backend to the model via
`useRenderingBackend`, render JSX.

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

`RenderLifecycleMixin` holds `canvasDrawn` (true only after `render()` returns
true with real data), `renderTick`, `autorunsInstalled` (makes
`attachRenderingBackend` idempotent), `renderError`, and the overridable
`canRender` view (while false BOTH autoruns skip). `MultiRegionDisplayMixin`
adds `viewportWithinLoadedData` and `displayPhase`.

**`canRender` exists because view geometry throws before the view is measured**
(`view.width`, so `visibleRegions` and `trackWidthPx` too), and the render
autorun routes a throw to `renderError` — "not measured yet" would surface as the
GPU error banner. The LGV mixins gate it once, so a display's `renderState` stays
a resolved getter and its render callback gates only on its own data.

`attachRenderingBackend(setup)` takes a thunk run once per attach, so
callback-local state rebuilds with the backend on context-loss recovery.

**The activity phase is one expression, `computeActivityPhase`**
(`@jbrowse/render-core/displayPhase`), evaluated by every foundation. Customize
through the `fetchInert` hook, never by overriding `displayPhase`.
`viewportCurrent` is a **thunk** because it is the only input reading the
containing view. Parity is pinned in `displayPhase.test.ts` and
`displayPhaseWiring.test.ts`.

- The `!canvasDrawn` clause covers the window before `isLoading` flips (HiC
  cannot fetch until `CoreGetInfo` resolves).
- `viewportWithinLoadedData` re-shows the scrim when the viewport extends past
  loaded data. It is a separate getter for tracking reasons
  (`packages/display-kit/CLAUDE.md`).
- The global family has no staleness axis: it keeps the last frame up during a
  refetch, since worker output is genomic and draws correctly under the live view
  transform.
- `rendersCanvas` is overridable so a display showing a static non-canvas
  placeholder does not sit under the scrim. Rendering the placeholder outside
  `DisplayChrome` was rejected because it disposes and re-initializes the backend
  on every toggle
  ([ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md)).
- `stopRenderingBackend` resets `canvasDrawn` so the scrim recovers after context
  loss.

`DisplayChrome` derives scrim visibility from `displayPhase` and calls
`useRenderingBackend(factory, model)` itself, so a display cannot bury the hook;
it takes a required `testid` base ([DISPLAYCHROME.md](DISPLAYCHROME.md) §"One
element per display").

`installGlobalFetchAutorun` schedules **leading-edge**: MobX's `{ delay }` is
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
  `createGpuContextLostError()` into `renderError`, which unmounts the canvas.
- **The recovery budget is windowed** (`RecoveryBudget`): a lifetime counter would
  spend a second loss an hour later on the first. A successful re-init does not
  reset it, since every flap contains one; a real `webglcontextrestored` or
  manual Retry does. **A WebGPU device loss shares the budget** and needs it more:
  that path re-inits invisibly, so uncapped it re-initializes against a dying
  device for the life of the tab.
- `pagehide` tears the backend down and drops any pending report, since a bfcache
  thaw fires the timer after `pageshow` rebuilt the backend.
- The cause is usually page-wide: each display canvas takes a WebGL context (see
  [GPU_HAL.md](GPU_HAL.md) §"WebGL2 contexts are a page-level budget"). The
  `renderError` banner offers `setGpuOverride('canvas2d')`; `isGpuRenderingDisabled()`
  is the one read for "GPU is off page-wide".

**Every re-init needs a canvas element that never held a context.**
`getContext('webgl2')` returns the same lost context, and `getContext('2d')`
returns `null` on any element that once had WebGL. **A canvas's context kind is
permanent**, so a re-init whose HAL ladder lands on a different rung is stuck.

- Three re-init paths bump `canvasKey` and set no `renderError`
  (`webglcontextrestored`, WebGPU `onDeviceLost`, bfcache `pageshow`).
  `DisplayChromeBase` keys the render-prop body (`<Fragment key={canvasKey}>`) and
  leaves the overlays outside the key, since remounting the loading scrim resets
  its anti-flash delay. `DisplayChrome.test.tsx` pins this.
- Drop-to-primitive consumers keep their canvas mounted through an error
  (ADR-025), so they render `RenderCanvas` (`@jbrowse/render-core/RenderCanvas`),
  which owns `key={canvasKey}` and publishes `data-display-drawn`. Their readiness
  flag is `settled`, not `canvasDrawn`, because a shared canvas repaints
  unconditionally.
- `getContext` returns one undifferentiated `null` for every failure.
  `canvasContext.ts` records the kind each canvas committed to and turns the
  `null` into a reason. Every acquisition goes through it (`acquireCanvas2D`).
- A ladder that fails at every rung throws an `AggregateError` carrying each
  rung's reason, which `formatErrorStack` walks into the stack-trace dialog.

## Upload patterns

**One installer, one contract.** A display's wiring is one call,
`installUpload(self, backend, { cells, inputs?, encode?, render })`
([ADR-088](../architecture-decision-records/adr-088-one-upload-installer-over-one-cell-contract.md)).
`cells` is a map of immutable payloads. The installer diffs it by reference on
every commit, encodes and uploads what moved, releases what left, and re-uploads
everything into a fresh backend after context loss. Every backend implements
`upload(key, data)` and `release(key)`, so what remains per display is **what its
map is keyed by**:

| Key | Use when |
|---|---|
| `displayedRegionIndex` (`PerRegionRenderingBackend`) | each region's data is independent, or a whole-map computed hands back per-region payloads |
| a slot name, via `oneCell` | one payload for the whole view |
| a sibling's `sharedBackendKey`, one canvas-wide block each | one canvas paints several displays |

- **A cell keyed on a value reads it from its own computed.** The diff is by
  reference, so a cell built from a per-frame render-state getter re-uploads per
  frame. Synteny's clicked-outline cell once read `clickedFeatureId` off
  `renderParams` and re-packed on every pan frame. **No rendering gate sees this**
  (the picture is identical); a test that pans with a selection live and counts
  `upload` calls does (`outlineUploadSchedule.test.ts`).
- **Release is per key, never an active-set prune.** A prune computed from one
  display's map would wipe its siblings' buffers on a shared canvas (the HAL's
  old `pruneRegions(active)`). That is why the three installers (ADR-079)
  collapsed to one.
- **A display with two cells of different kinds** keys them by name; `encode`
  sees the key (`encode(data, props, key)`).
- **Absence is absence.** A whole-view display with nothing fetched leaves the key
  out (`oneCell(0, self.rpcData)` does), so the key is released and the frame
  clears. A fetch that came back *empty* must stay in the map, so `renderBlocks`
  answers true and `canvasDrawn` flips; otherwise the scrim never lifts.
- `sharedBackendKey(self.id)` rides on `displayedRegionIndex`, the key a block was
  uploaded under. A dotplot or synteny corner's screen x is a `panPx` fold, so a
  canvas-wide block per cell is an identity clip.
- Alignments' whole-map `sources` cell exists only because pileup Y rows must be
  consistent across `displayedRegions` (a read spanning a boundary needs one row
  in both); its renderer holds the memo of what it last sent.

### Every backend extends a base, and the reason is the error channel

`GpuRenderingBackendBase` / `Canvas2DRenderingBackendBase` hold `dispose` and
`setErrorHandler`, which routes a HAL over-limit allocation to `renderError` and
raises the "too much data to render on this GPU — zoom in" banner.
`setErrorHandler` is **required** on `RenderingBackend`, so a backend that skips
a base is a compile error. It used to be optional, and the three largest
vertex-buffer allocators were exactly the three whose OOMs reached nobody: the
view painted blank. `?.` on a capability every implementer needs reads as
tolerance and spends as silence.

### One autorun and a diff (`installUpload`)

The helper remembers what it last sent per key, so chromosome 5 arriving uploads
chromosome 5, not all 24. A settings change re-encodes and re-uploads all of
them, which is why a display must *declare* what its encode depends on.

- **Omit `encode` when the held payload is what the backend takes.** The helper
  then skips the step and allocates neither mirror map.
- **`inputs` is the whole contract.** `encode`'s own reads wake the autorun but
  invalidate nothing, so a wide read there re-runs the diff and encodes nothing.
  Anything a settings change must reach the buffer through goes in `inputs`.
  [ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md)
  has the reasoning.
- **This fixes uploads and encodes only. Draws stay O(N²)**: `renderBlocks`
  clears and redraws every loaded region. Read
  [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data)
  before chasing the rest.

**Why `LinearBasicDisplay` and alignments are whole-map rather than streamed:**
they lay features into Y rows across all loaded regions, so any arrival can change
everything already loaded. A whole-map computed (`laidOutDataMap` /
`laidOutPileupMap`) is the upload payload, with no encode step. Layout therefore
stays on the main thread; ADR-053 settles that for alignments and says what to
attack instead. `LinearBasicDisplay` recovers O(N) through
`createIncrementalLayout` (`plugins/canvas/src/LinearBasicDisplay/layout.ts`)
([ADR-017](../architecture-decision-records/adr-017-wiggle-per-key-autoruns.md),
[ADR-011](../architecture-decision-records/adr-011-canvas-flatbush-immutable-offsets.md)).

**A shared-canvas backend wants the memo one level down: the colour-lane patch.**
A recolor yields a fresh `colors` array over the same coordinate arrays. Both
synteny mark lists hold a `createInstanceCache`
(`@jbrowse/render-core/instanceCache`) inside the shape's `pack`, memoizing on
`(geometry identity, colors identity)` and patching the colour lane in place; the
CPU interleave dominates at 10⁵–10⁶ instances. The model-side half is
[FETCH_KEYS.md](FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).

### Whole-map synced: skipping a region without leaving stale buffers

`sync(sources)` is a full rebuild by contract. Two `deleteRegion` calls make that
safe with no HAL-side transaction: a key absent this sync is swept, and a key
whose payload changed is wiped whole before its unconditional re-uploads, so a
pass whose data went empty cannot leave stale bytes. The skip exists because the
upload autorun fires on far more than new data (a band-resize drag frame
re-derives `sourceSections`).

- **The wipe, like the skip, is whole-region.** A per-pass decision would need each
  caller to enumerate its passes.
- **Forget a key when it leaves**: delete the HAL buffers and the memo entry
  together, or a returning region with an identical payload skips an upload onto
  destroyed buffers.
- The memo lives on the renderer (`GpuAlignmentsRenderer.uploaded`), so it drops
  exactly when the buffers do on context loss.
- **The one sub-region exception is the recolor.** `readYs` identity means "same
  layout run", so same bytes except the two per-read colour arrays rewrites the
  read pass alone. This needs the model to bake colour in its own computed
  downstream of layout (`laidOutByGroupUncolored` → `laidOutByGroupFramed` →
  `laidOutByGroup`).

Synteny's level-of-detail axis is a fetch concern: [SYNTENY_LOD.md](SYNTENY_LOD.md).
