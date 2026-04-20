# Dotplot Refactor — Adopt MST Autorun Lifecycle

Goal: bring the dotplot view + display into the same MST-driven autorun pattern
the rest of the GPU displays now use, while preserving its distinguishing
architectural feature: **one canvas on the view, geometry uploads keyed per
track from each display**.

This refactor does **not** change that two-layer split. It rewires the existing
autoruns through the shared util so the lifecycle, idempotency guards, dispose
semantics, and tab-visibility behavior come from one place instead of being
open-coded in `dotplot-view` files.

Reference doc for the target architecture: `agent-docs/NEW_ARCHITECTURE.md`.

---

## Current shape (as of webgl-poc)

**View** (`plugins/dotplot-view/src/DotplotView/model.ts`):

- Owns `volatile gpuRenderer: DotplotBackend | null`
- Owns `tabVisibilityVersion`, `canvasDrawn` volatiles
- Has `dotplotViewDrawAutorun` autorun that:
  - Reads `gpuRenderer`, `initialized`, `tabVisibilityVersion`, each track's
    `display.geometryVersion`, hview/vview offsets+bpPerPx, track's `lineWidth`
  - Calls `renderer.resize(viewWidth, viewHeight)`
  - Builds `trackScales[]` from each display's `featPositionsBpPerPxH/V`
  - Calls `renderer.render(hOffsetPx, vOffsetPx, lineWidth, trackScales)`
  - Sets `canvasDrawn = true` if any track has features

**View component** (`DotplotView/components/DotplotView.tsx`):

- `useGpuRenderer(canvasRef, DotplotRendererFactory, { onReady, onDispose })`
- Calls `model.setGpuRenderer(renderer)` / `setGpuRenderer(null)`
- `useTabVisibilityRerender(() => model.bumpTabVisibility())`

**Display** (`plugins/dotplot-view/src/DotplotDisplay/`):

- `afterAttach.ts` runs `dotplotUploadAutorun` autorun that:
  - Reads `view.gpuRenderer`, `view.initialized`, the display's track index,
    `featPositions`, `colorBy`, `alpha`, `minAlignmentLength`, `view.drawCigar`,
    hview/vview bpPerPx
  - Builds line segments via `buildLineSegments(...)`
  - Calls
    `renderer.uploadGeometry(regionKey, { x1s, y1s, x2s, y2s, colors, instanceCount })`
  - Bumps `display.geometryVersion` so the view's draw autorun re-fires

**Backend** (`DotplotDisplay/dotplotBackendTypes.ts`):

```ts
interface DotplotBackend {
  resize(width: number, height: number): void
  uploadGeometry(regionKey: number, data: DotplotGeometryData): void
  deleteGeometry(regionKey: number): void
  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    trackScales: readonly TrackScale[],
  ): void
  dispose(): void
}
```

---

## Target shape

A clean variant of today's split:

- **View** runs _one_ render-only lifecycle that reads its own observables and
  the per-display `geometryVersion` signals to re-fire after uploads.
- **Each display** runs _one_ upload-only lifecycle keyed by its track index,
  owning identity-diff and prune (the existing `startGpuBackendAutorunLifecycle`
  semantics, applied to a per-display single-key stream).
- **Backend** keeps geometry-keyed uploads but its `render` collapses to a
  single state object so adding fields doesn't churn signatures.

The structural change is small. The win is that all lifecycle, dispose,
tab-visibility, and canvasDrawn concerns become inherited mixin behavior.

---

## Step 1 — No util changes; dotplot backend adopts multi-region vocab

The util is already expressive enough. Rather than add a geometry-keyed variant
(`deleteOneRegion`) to `GpuUploadStream`, the dotplot backend adopts the same
`uploadRegion(n, data)` / `pruneRegions(active)` naming the rest of the
multi-region backends already use. The backend owns its own key map, so
`pruneRegions(active)` is a trivial set subtraction — no worse than a per-key
delete loop.

Empty `uploadSlots: []` in `startGpuSingleDataBackendAutorunLifecycle` already
works: the for-loop doesn't execute, `allPresent` stays true, render fires on
state alone. No change needed.

Net: core util surface stays minimal. Dotplot and synteny express the
geometry-keyed pattern entirely through the plugin-supplied callbacks.

## Step 2 — Normalize `DotplotBackend.render(state)`

```ts
interface DotplotRenderState {
  offsetX: number
  offsetY: number
  lineWidth: number
  trackScales: readonly TrackScale[]
}

interface DotplotBackend {
  resize(width: number, height: number): void
  uploadRegion(displayedRegionIndex: number, data: DotplotGeometryData): void
  pruneRegions(activeDisplayedRegionIndices: number[]): void
  render(state: DotplotRenderState): void
  dispose(): void
}
```

Naming matches the multi-region backends (wiggle, canvas, variants). Backend
internally holds a `Map<number, Geometry>`; `pruneRegions` is set subtraction on
its own map. Update both backend implementations (`GpuDotplotRenderer.ts`,
`Canvas2DDotplotRenderer.ts`) to destructure the state object and implement the
new prune.

## Step 3 — Display-level upload lifecycle

In `DotplotDisplay/stateModelFactory.tsx`:

- Compose `GpuBackendLifecycleSlotMixin()` (gives the display its own
  `gpuBackendLifecycleHandle`, `markCanvasDrawn`, `stopGpuBackendLifecycle`).
- Add `volatile rpcDataMap: Map<number, DotplotUploadData>` (single entry keyed
  by the display's track index — analogous to multi-region's per-region map but
  with one entry).
- Add `setRpcData(key, data)` action that writes a fresh Map reference
  (matches the upload-identity contract).
- Replace the body of `dotplotUploadAutorun` with a `geometryRecompute` autorun
  that reads `featPositions` etc. and calls
  `setRpcData(trackIndex, { x1s, y1s, ... })`.
- Add `startGpuBackendLifecycle(backend: DotplotBackend)` that wraps:
  ```ts
  self.startMultiRegionGpuLifecycle({
    backend,
    getDataByRegionNumber: () => self.rpcDataMap,
    uploadOneRegion: (b, n, data) => b.uploadRegion(n, data),
    pruneRegionsNotIn: (b, active) => b.pruneRegions(active),
    getRenderBlocks: () => [], // display contributes no render
    getRenderState: () => undefined, // — the view does it
    renderAllBlocks: () => {},
  })
  ```
  Returning `undefined` from `getRenderState` makes the util skip render —
  exactly the upload-only mode we want for displays.

`bumpGeometryVersion` and the existing autorun go away.

## Step 4 — View-level render lifecycle

The view doesn't fit the `MultiRegionDisplayMixin` shape (it isn't a display —
it owns the canvas). It can still use `GpuBackendLifecycleSlotMixin` directly:

In `DotplotView/model.ts`:

- Compose `GpuBackendLifecycleSlotMixin()` (so the view gets `canvasDrawn`,
  `markCanvasDrawn`, `gpuBackendLifecycleHandle`, `stopGpuBackendLifecycle`,
  `renderNow`).
- Remove the duplicate `canvasDrawn`, `setCanvasDrawn`, `bumpTabVisibility`
  state — `markCanvasDrawn` covers it; tab visibility moves to `renderNow` via
  the component (see Step 5).
- Replace `dotplotViewDrawAutorun` with a render-only lifecycle:
  ```ts
  startGpuBackendLifecycle(backend: DotplotBackend) {
    self.startSingleDataGpuLifecycle({
      backend,
      uploadSlots: [],   // view never uploads
      getRenderState: () => self.initialized ? buildRenderState(self) : undefined,
      renderWithState: (b, state) => {
        b.resize(self.viewWidth, self.viewHeight)
        b.render(state)
      },
    })
  }
  ```
  Where `buildRenderState(self)` is a cached view that returns:
  ```ts
  {
    offsetX: hview.offsetPx,
    offsetY: vview.offsetPx,
    lineWidth: tracks[0]?.displays[0]?.lineWidth ?? 2,
    trackScales: tracks.map(t => ({...})),
  }
  ```
  Reading each track's `featPositionsBpPerPxH/V` and `geometryVersion` (... but
  `geometryVersion` becomes redundant — see Step 5 note).

Empty `uploadSlots: []` already works in the current util — the for-loop doesn't
execute, `allPresent` stays true, render fires on state alone. No util change
required.

## Step 5 — Wire renderNow into tab visibility, drop `geometryVersion`

In `DotplotView/components/DotplotView.tsx`:

- Replace `useTabVisibilityRerender(() => model.bumpTabVisibility())` with
  `useTabVisibilityRerender(() => model.renderNow())` (provided by mixin).
- The component's `useGpuRenderer` already has `onReady` / `onDispose` — wire
  those to `model.startGpuBackendLifecycle(renderer)` /
  `model.stopGpuBackendLifecycle()`.

`display.geometryVersion` exists today only to flow upload-completion signals
back into the view's draw autorun. With the new shape:

- Display upload lifecycle bumps the util's internal upload signal.
- View lifecycle isn't observing the display's signal directly — but the view's
  render state reads each display's `featPositionsBpPerPxH/V` and similar
  derived state, which already changes on upload.

If the test reveals the view needs an explicit signal from upload commits, the
cleanest path is for the display's upload autorun to bump a public
`uploadVersion` observable that the view's `renderState` getter reads. Same
one-counter trick, named honestly.

Either way, `bumpGeometryVersion` and `tabVisibilityVersion` come out.

## Step 6 — Tear-down sequencing

The display's lifecycle handle disposes when the display is destroyed (MST
disposer or component unmount via `stopGpuBackendLifecycle`). The view's handle
disposes when the view is destroyed. Track add/remove flows naturally re-fire
the display's upload autorun (data goes from "present" to "absent" when the
display unmounts), which calls `deleteOneRegion(key)`, which removes the
geometry from the shared backend.

Verify in tests: removing a track removes its geometry from the backend without
disposing the backend itself.

---

## File-by-file checklist

- Core util files: no change. Existing `uploadOneRegion` + `pruneRegionsNotIn`
  cover geometry-keyed uploads; empty `uploadSlots: []` is already a valid state
  for `startGpuSingleDataBackendAutorunLifecycle`.
- `plugins/dotplot-view/src/DotplotDisplay/dotplotBackendTypes.ts` — introduce
  `DotplotRenderState`, change `render` signature.
- `plugins/dotplot-view/src/DotplotDisplay/GpuDotplotRenderer.ts` and
  `Canvas2DDotplotRenderer.ts` — update `render` to destructure state.
- `plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx` — compose slot
  mixin, add `rpcDataMap` + `setRpcData`, add
  `startGpuBackendLifecycle`.
- `plugins/dotplot-view/src/DotplotDisplay/afterAttach.ts` — replace
  `dotplotUploadAutorun` with `geometryRecompute` autorun that calls
  `setRpcData`. Drop `bumpGeometryVersion`.
- `plugins/dotplot-view/src/DotplotView/model.ts` — compose slot mixin, remove
  duplicate state, replace `dotplotViewDrawAutorun` with
  `startGpuBackendLifecycle` action.
- `plugins/dotplot-view/src/DotplotView/components/DotplotView.tsx` — wire
  `useGpuRenderer` callbacks into `startGpuBackendLifecycle` /
  `stopGpuBackendLifecycle`. Tab visibility → `renderNow`.

## Out of scope (deliberate)

- No naming-override surface area on the util (no `uploadKey`/`deleteKey`
  rename). The callbacks already adapt freely.
- No view-as-display pretense. The view is the canvas owner; the display is an
  upload contributor. Keep the asymmetry; encode it in the wrapper choice
  (`startMultiRegionGpuLifecycle` for displays, `startSingleDataGpuLifecycle`
  for the view).
- No picking. Dotplot doesn't pick today.

## Validation

- `tsc --noEmit` clean
- `packages/core/src/gpu` jest suite green (existing tests + new
  `deleteOneRegion` and empty-`uploadSlots` cases)
- `plugins/dotplot-view/src/DotplotDisplay/Canvas2DDotplotRenderer.test.ts`
  still passes after the render-state change
- Browser smoke: open a synteny dataset in dotplot, pan, zoom, add/remove a
  track, hide/show the tab. No regressions.
