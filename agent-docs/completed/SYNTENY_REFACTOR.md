# Synteny Refactor — Unified Canvas (Dotplot-style)

Goal: rework `LinearSyntenyDisplay` so that **the LinearSyntenyView owns one
canvas and one GPU backend, and each synteny display is an upload contributor
keyed by its level/track index** — the same shape as dotplot. This is both an
architectural simplification (one canvas instead of N) and a prerequisite for
cross-track features (chained alignments across multiple synteny tracks, unified
picking with z-order).

This is a larger refactor than dotplot's because synteny currently has a
**per-display** renderer with its own canvas, picking, and event handlers. The
work moves all of that to the view.

The dotplot refactor (`DOTPLOT_REFACTOR.md`) should land first; the shared util
generalizations it introduces (per-key delete dispatch, empty-slot single-data
lifecycle, geometry-keyed pattern) are reused here.

---

## Current shape (as of webgl-poc)

**Display** (`LinearSyntenyDisplay`):

- Owns its own `volatile gpuRenderer: SyntenyBackend | null`
- Component (`LinearSyntenyRendering.tsx`) hosts a `<canvas>` and runs
  `useGpuRenderer(canvasRef, SyntenyRendererFactory, { onReady, onDispose })`
- `afterAttach.ts` runs two autoruns:
  - `syntenyDrawAutorun` — calls `gpuRenderer.resize()`,
    `gpuRenderer.uploadGeometry(instanceData)`,
    `gpuRenderer.render(offset0, offset1, height, bpPerPx0, bpPerPx1, maxOffScreenPx, minAlignmentLength, alpha, hoveredFeatureId, clickedFeatureId)`
  - `syntenyFetchAutorun` — RPC for feature data
- The component handles mouse events: `gpuRenderer.pick(x, y)` for hover/ click
  identifying which feature was clicked
- Each pair of adjacent LGV "levels" gets its own LinearSyntenyDisplay, its own
  canvas, its own backend

**Backend** (`SyntenyBackend`):

- `uploadGeometry(data)` — single dataset, no key
- `render(offset0, offset1, height, bpPerPx0, bpPerPx1, maxOffScreenPx, minAlignmentLength, alpha, hoveredFeatureId, clickedFeatureId)`
  — 10 positional args
- `pick(x, y, onResult?)` — synchronous + async fallback for WebGPU GPU buffer
  readback
- `resize`, `dispose`

**View** (`LinearSyntenyView`):

- Doesn't own a canvas today
- Manages levels, view ordering, drawCurves/drawCIGAR settings, etc.
- Just a host for the displays

---

## Target shape

- **View owns the canvas.** A single `<canvas>` element on the view.
- **View runs the render lifecycle.** One backend instance, one render autorun,
  reading state aggregated across all synteny tracks: each track contributes a
  level offset and per-level render parameters (alpha, hover, etc.), and the
  backend renders all geometry at the right per-level offsets in one pass.
- **Each display owns its upload lifecycle.** Each display key is effectively
  `(level, trackIndex)` — multiple synteny tracks at the same level layer,
  multiple level pairs render at distinct y-offsets. Display calls
  `backend.uploadGeometry(key, instanceData)` and `backend.deleteGeometry(key)`
  via the per-key util pattern.
- **Picking moves to the view.** `pick(x, y)` returns
  `{ trackKey, featureIndex }` (or equivalent). The view's overlay React
  component dispatches events (hover, click) to the originating display.
  Per-track context-menu / tooltip stay on each display.
- **Backend.render takes a state object.** All per-level data (offsets, bpPerPx
  pairs, hover/click IDs scoped per track) lives in the state.

The structural payoff: cross-track concerns (chained alignments spanning ≥2
levels, future "compare three or more genomes simultaneously" features, single
GPU context, single readback for pick) are no longer divided across N detached
canvases.

---

## Step 1 — Prerequisites

Inherits from dotplot refactor: no util changes, but the geometry-keyed
vocabulary convention is established (`uploadRegion` / `pruneRegions` on the
backend; view uses `startSingleDataGpuLifecycle` with empty `uploadSlots`).
Synteny follows the same vocabulary.

## Step 2 — Reshape `SyntenyBackend`

```ts
interface SyntenyTrackKey {
  level: number // pair index in view.views (0 means views[0]↔views[1])
  trackIndex: number // disambiguator if multiple tracks share a level
}

interface SyntenyTrackGeometry {
  data: SyntenyInstanceData
  // per-track parameters that influence layout but not per-frame state:
  yTop: number
  yBottom: number
}

interface SyntenyTrackRenderParams {
  alpha: number
  minAlignmentLength: number
  hoveredFeatureId: number
  clickedFeatureId: number
  // per-pair viewport (could move to common state if all tracks share):
  offset0: number
  offset1: number
  bpPerPx0: number
  bpPerPx1: number
  height: number
}

interface SyntenyRenderState {
  maxOffScreenPx: number
  // keyed parallel to uploaded geometry; missing key = skip that track
  perTrack: Map<string, SyntenyTrackRenderParams>
}

interface SyntenyBackend {
  resize(width: number, height: number): void
  uploadGeometry(key: string, geom: SyntenyTrackGeometry): void
  deleteGeometry(key: string): void
  render(state: SyntenyRenderState): void
  pick(
    x: number,
    y: number,
    onResult?: (hit: { key: string; featureIndex: number } | undefined) => void,
  ): { key: string; featureIndex: number } | undefined
  dispose(): void
}
```

Key encoding can be `${level}/${trackIndex}` strings — strings make Map
iteration ergonomic and allow trivial diffing. Alternative: numeric hash.
Strings are fine for the cardinalities involved (typically <20).

Both renderer implementations (`GpuSyntenyRenderer.ts`,
`Canvas2DSyntenyRenderer.ts`) update accordingly. The hot path inside
`render(state)` iterates `state.perTrack`, sets per-track uniforms, draws.

## Step 3 — View owns the canvas + lifecycle

In `LinearSyntenyView/model.ts`:

- Compose `GpuBackendLifecycleSlotMixin()`
- Add `startGpuBackendLifecycle(backend: SyntenyBackend)` that calls
  `self.startSingleDataGpuLifecycle({ backend, uploadSlots: [], ...})` with
  `getRenderState` returning the aggregated `SyntenyRenderState`
- Aggregation reads each contributing display: walk `self.tracks → display`,
  collect
  `{ alpha, minAlignmentLength, hoveredFeatureIdx, clickedFeatureIdx, level, ... }`.
  Each display exposes a cached `renderParams` getter.
- `renderWithState(b, state)` calls `b.resize(...)` and `b.render(state)`.

In `LinearSyntenyView/components/LinearSyntenyView.tsx` (or new sibling
component):

- One `<canvas ref={canvasRef}>` element, positioned to overlay all the LGVs.
- `useGpuRenderer(canvasRef, SyntenyRendererFactory, {   onReady: b => view.startGpuBackendLifecycle(b),   onDispose: () => view.stopGpuBackendLifecycle(), })`
- `useTabVisibilityRerender(() => view.renderNow())`
- Hosts the global mouse handler that calls `view.gpuBackend?.pick(x, y)` and
  dispatches the resulting `{ key, featureIndex }` to the matching display
  (lookup via `key → display`).

Display components (`LinearSyntenyRendering.tsx`) shrink dramatically: they hold
no canvas, no `useGpuRenderer`, no event handler. They render overlays
(tooltips, context menus, error UI) and nothing else.

## Step 4 — Each display owns its upload lifecycle

In `LinearSyntenyDisplay/model.ts`:

- Compose `GpuBackendLifecycleSlotMixin()` (gives `markCanvasDrawn`,
  `gpuBackendLifecycleHandle`, etc.)
- `volatile rpcDataMap: Map<string, SyntenyTrackGeometry>` — a single-entry map
  under the display's own key. Single-entry feels unnecessary, but reusing the
  multi-region util's identity-diff + delete dispatch is still the cleanest way
  to wire it.
- `setGeometry(geometry)` action writes a fresh Map with the display's key.
- Display's `startGpuBackendLifecycle(backend)` calls:
  ```ts
  self.startMultiRegionGpuLifecycle({
    backend,
    getDataByRegionNumber: () => self.rpcDataMap,
    uploadOneRegion: (b, key, geom) => b.uploadGeometry(String(key), geom),
    deleteOneRegion: (b, key) => b.deleteGeometry(String(key)),
    getRenderBlocks: () => [],
    getRenderState: () => undefined,
    renderAllBlocks: () => {},
  })
  ```
  Note keys here are `number` to fit the existing util signature; the display
  picks a stable numeric encoding (e.g.
  `level * MAX_TRACKS_PER_LEVEL + trackIndex`). Internal stringification happens
  in `uploadOneRegion`.
  - Alternative: generalize `getDataByRegionNumber` keys to `string | number` in
    the util. Possible cleanup but requires touching all plugins. Defer.
- Display's component receives the backend reference from the **view** (via
  context/prop) when it needs to call `startGpuBackendLifecycle` — the display
  doesn't get the backend through `useGpuRenderer`. The view's component, after
  creating the backend, walks each display and calls
  `display.startGpuBackendLifecycle(viewBackend)`.

  Or simpler: the display's `afterAttach` sets up a reaction that, when
  `view.gpuBackend` becomes non-null, calls
  `display.startGpuBackendLifecycle(view.gpuBackend)`. When it goes null, calls
  `display.stopGpuBackendLifecycle()`.

## Step 5 — Picking moves to the view

Today, `LinearSyntenyRendering.tsx`:

```ts
model.gpuRenderer.pick(coords.x, coords.y, featureIndex => {...})
```

called per-display. With one canvas, one backend, the display can't pick — only
the view's host component can, since only it knows the canvas coordinates.

In the view's host component:

- Mouse handlers compute canvas-relative coords, call
  `view.gpuBackend.pick(x, y)`.
- The result includes `{ key, featureIndex }`.
- View dispatches to the display via lookup:
  `view.tracks.find(t => keyOf(t.display) === key).display.handleHover(featureIndex)`
- Per-display behavior (tooltip text, context menu) stays on the display — only
  the picking call site moves.

## Step 6 — Cross-track features unlocked (followups, not this refactor)

Single-canvas opens these up; they aren't required to land the refactor:

- Chained alignments across ≥2 levels render through a single instance buffer
  (currently impossible).
- Picking returns z-ordered hits across levels (today picking only returns one
  display's features).
- Single MSAA buffer instead of N — memory + GPU upload savings proportional to
  N tracks.

## Step 7 — Tear-down sequencing

- View dispose → view's lifecycle disposes → backend disposes.
- Each display dispose → display's lifecycle disposes → its `deleteOneRegion`
  fires for its key, removing its geometry from the shared backend (which stays
  alive).
- Track add/remove flows through the same path naturally.

## Step 8 — Migration safety

Parallel branch: ship the per-display canvas behavior behind a feature flag
while the unified view-canvas implementation ramps. Once unified canvas is
verified across PIF/PAF/CIGAR datasets and chained-pair use cases, drop the flag
and remove the per-display code.

---

## File-by-file checklist

- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/syntenyBackendTypes.ts`
  — full interface rewrite (key-based, state-based render).
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/GpuSyntenyRenderer.ts`
  and `Canvas2DSyntenyRenderer.ts` — keyed geometry storage, state-iterating
  `render`.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/SyntenyRenderer.ts`
  — factory unchanged in shape.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts` — compose
  slot mixin, drop `gpuRenderer` volatile + `setGpuRenderer`, add `rpcDataMap` +
  `setGeometry`, add `startGpuBackendLifecycle`, expose `renderParams` getter,
  expose hover/click handlers used by the view.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts` —
  replace `syntenyDrawAutorun` with a `geometryRecompute` autorun feeding
  `setGeometry`. Keep `syntenyFetchAutorun`.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/components/LinearSyntenyRendering.tsx`
  — strip canvas + `useGpuRenderer` + `useTabVisibilityRerender` + picking.
  Becomes overlay-only.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/components/Component.tsx`
  — adjusts to wrap overlays only.
- `plugins/linear-comparative-view/src/LinearSyntenyView/model.ts` — compose
  slot mixin, add aggregator `renderState` getter, add
  `startGpuBackendLifecycle`. Expose `dispatchPick(hit)`.
- `plugins/linear-comparative-view/src/LinearSyntenyView/components/LinearSyntenyView.tsx`
  — host the canvas, run `useGpuRenderer`, install the global mouse handler that
  calls `pick` and dispatches hits.
- `MultiLGVSyntenyDisplay` — already a single-canvas display, but similar
  restructuring may apply later (deferred).

## Out of scope

- The `MultiLGVSyntenyDisplay` migration (separate, larger story).
- Picking algorithm changes (z-ordered multi-hit, depth-readback picking) — Step
  6 lists them but they aren't part of this refactor.
- Any change to the RPC fetch path.

## Validation

- `tsc --noEmit` clean
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/Canvas2DSyntenyRenderer.test.ts`
  updated to keyed API + state object
- Browser smoke:
  - 2-genome PIF dataset, hover + click both sides
  - 3+ genome dataset (chained pairs across levels) — verify per-level render
    offsets are correct
  - Tab hide/show — `renderNow` repaints
  - Track add/remove — geometry slots evict cleanly

## Key risks

- **Picking accuracy at level boundaries.** Single canvas means hit-testing must
  respect per-level y-offsets. The backend's pick must consult the same
  `perTrack` y-range data the renderer uses.
- **Per-track render param diffing.** With 10+ tracks, the render autorun reads
  ≥10 displays' observable state per pass. Confirm cached getters keep this
  O(changed-only) in MobX. If not, separate per-track render-state observables
  and aggregate via a derived view.
- **Drag/scroll overlays.** Today each display catches mouse events on its own
  canvas. A single host canvas means coordinate translation for context menus /
  tooltips. Not hard, but uniform handling needs care.
