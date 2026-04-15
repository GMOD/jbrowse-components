# Synteny Refactor — PR-B: View Owns the Canvas

**Status:** plan. PR-A landed the keyed backend interface + MST-driven autorun
pattern with one canvas per display. PR-B moves the canvas to the view, sharing
one backend across N synteny displays.

**Prereqs:** PR-A merged. No util changes required for PR-A's surface; PR-B adds
a small `deleteOneRegion` extension to `startGpuBackendAutorunLifecycle`.

---

## What PR-A already did (reuse, don't repeat)

- `SyntenyBackend` is keyed: `uploadGeometry(key, ...)`, `deleteGeometry(key)`,
  `render(state)` where `state.perTrack: Map<number, SyntenyTrackRenderParams>`.
  `pick` returns `{key, featureIndex} | undefined`.
- `SyntenyTrackRenderParams` already carries `yTop` and per-track `height`. PR-A
  always passes `yTop: 0` and `height: display.height`; the multi-track plumbing
  is unused but in place.
- `Canvas2DSyntenyRenderer` already iterates `state.perTrack` for both `render`
  and `pick`, with y-range gating in pick. Its multi-track tests pass.
- `GpuSyntenyRenderer` stores per-key region metadata in a Map; render loops
  over `state.perTrack` calling `writeUniforms` + `drawPass(_, key)` per track.
  Picking is single-key (still reads `pickContexts[0]`) — see Step 1.
- Display model owns `rpcDataMap`, `setGeometry`, `renderParams` getter,
  `syntenyRenderState` getter, `startGpuBackendLifecycle` action.

---

## Out-of-scope guard rails

- **MultiLGVSyntenyDisplay** — separate display, separate backend, separate
  story. Not touched here.
- **Pickable mixin abstraction** — deferred indefinitely; PR-A's `Promise`-less
  callback shape works fine.
- **Z-ordered multi-hit picking** — single hit per pick suffices.

---

## Step 1 — Shader changes (the unavoidable infra)

### 1a. Per-track y-offset

Today, `uniforms.height` is the only y-axis input — vertices are positioned at
`t * uniforms.height` in canvas-pixel space (then clip-space transform divides
by `canvas_height`). With one canvas spanning multiple tracks at different
y-positions, add a `y_top` uniform.

**WGSL** (`wgslShaders.ts`) — append `y_top: f32` to the `Uniforms` struct (at
byte offset 60 — slot 15 in the f32 array, currently unused padding).

```wgsl
struct Uniforms {
  // ... existing fields 0-14 ...
  y_top: f32,    // was reserved
}
```

In each vertex output:

```wgsl
y = uniforms.y_top + uniforms.height * (...)
// or
y = uniforms.y_top + t * uniforms.height
```

Then convert to clip space using `canvas_height` (full canvas).

**GLSL** (`canvasGlslShaders.ts` / `glslShaders.ts` for synteny) — mirror. The
`y_top` uniform location and byte layout must match WGSL.

**Renderer** (`GpuSyntenyRenderer.writeUniforms`) — write `params.yTop` into
slot 15.

### 1b. Track-id in picking

Picking writes a 24-bit feature index into RGB; the read-back returns one
unsigned int. With multiple keys sharing the picking buffer, the read-back can't
distinguish keys.

**Cheapest option:** use the alpha channel for a track-id byte (0-255 keys
plenty). Modify `FILL_FRAGMENT_SHADER_PICKING` to emit
`vec4(low, mid, high, key_byte)` instead of `vec4(low, mid, high, 1.0)`. The
HAL's `readPickingPixel` returns RGBA already; extract A.

**HAL change:** `readPickingPixel` and `readPickingPixelAsync` need to return
both the 24-bit feature index AND the alpha byte. Two options:

- (preferred) Change return type to
  `{featureIndex: number, key: number} | undefined`. Update the only other
  caller (dotplot? — verify; dotplot uses `readPickingPixel`?). Actually grep:
  only synteny + dotplot use it. Dotplot doesn't use picking today (no
  per-feature interaction), so synteny is the only caller — but verify before
  changing the signature.
- (defensive) Add a new `readPickingPixelKey(x, y)` that returns the alpha.

Where the renderer sets `key_byte` in the picking write: pack into uniforms.
Shader reads `uniforms.track_id_byte` (new f32, slot 16; bumps
`UNIFORM_BYTE_SIZE` by 4).

**Renderer (GpuSyntenyRenderer.pick):** loop tracks instead of using just
`pickContexts[0]`. For each track, writeUniforms with that track's parameters +
track_id, drawPickingPass with that key. After all tracks drawn, single readback
returns `(featureIndex, trackId)`. Map `trackId` back to the actual key.

Alternative if shader changes are too risky: do per-key picking passes, read
back after each. N readbacks instead of 1; OK for N<10.

---

## Step 2 — Util extension

`startGpuBackendAutorunLifecycle` doesn't have a `deleteOneRegion` callback
today. Add one:

```ts
interface GpuUploadStream<...> {
  // existing fields ...
  /** Optional. Called for keys present in the cache but not in the
   *  current dataMap. Use when the backend is shared across displays so
   *  per-display teardown can't rely on dispose() to free GPU resources.
   *  Independent of pruneRegionsNotIn (which dispatches once per pass). */
  deleteOneRegion?: (backend: BackendType, regionNumber: number) => void
}
```

In the upload autorun loop where stale cache keys are detected:

```ts
for (const cachedKey of stream.cache.keys()) {
  if (!dataMap.has(cachedKey)) {
    stream.deleteOneRegion?.(backend, cachedKey)
    stream.cache.delete(cachedKey)
    uploaded = true
  }
}
```

For PR-B, the dispalys' lifecycle uses this to call
`backend.deleteGeometry(key)` when their entry is removed.

Also: confirm `startGpuSingleDataBackendAutorunLifecycle` already handles
`uploadSlots: []` (renders fire on state alone). Per
`agent-docs/NEW_ARCHITECTURE.md` line 184 this is already true via dotplot;
verify before relying on it.

---

## Step 3 — Stable display key

Today PR-A uses `DISPLAY_KEY = 0`. The view shares the backend across displays,
so each display needs a stable, unique numeric key. Two paths:

- **(simple) `display.id` hash to int** — id is a stable string per MST node;
  hash to int32. Collisions theoretically possible but vanishing for
  cardinalities ≤100.
- **(rigorous) view-side registry** — the view maintains a
  `Map<displayId, number>` and assigns the next free integer when a display
  binds. Cleared on display destroy. Avoids hash collisions.

Recommend simple-first; switch to registry if hash collisions ever appear (they
won't).

`DISPLAY_KEY` constant in `model.ts` becomes a getter:

```ts
get displayKey() {
  return hashString(self.id)
}
```

`setGeometry` and `beforeDestroy → deleteGeometry` use `self.displayKey`.

---

## Step 4 — View MST model

Mirror the dotplot view shape (`plugins/dotplot-view/src/DotplotView/model.ts`):

```ts
.compose(..., GpuBackendLifecycleSlotMixin(), ...)
.volatile(() => ({
  ...,
  gpuBackend: null as SyntenyBackend | null,
}))
.views(self => ({
  /**
   * #getter
   * Per-track y offsets accumulated through visible (non-collapsed) levels.
   * Returns Map<level, yTop>.
   */
  get levelYOffsets() {
    const offsets = new Map<number, number>()
    let y = 0
    for (let level = 0; level + 1 < self.views.length; level++) {
      offsets.set(level, y)
      const collapsed = self.levels[level]?.collapsed ?? false
      const h = collapsed ? 0 : self.levels[level]?.effectiveHeight ?? defaultLevelHeight
      y += h
    }
    return offsets
  },

  /**
   * #getter
   * Aggregated render state. Walks tracks → display → renderParams,
   * substitutes per-level yTop, returns Map<displayKey, params>.
   * Returns undefined if no display has renderable params yet.
   */
  get syntenyRenderState() {
    const perTrack = new Map<number, SyntenyTrackRenderParams>()
    for (const track of self.tracks) {
      for (const display of track.displays) {
        if (!isLinearSyntenyDisplay(display)) continue
        const params = display.renderParams
        if (!params) continue
        const yTop = self.levelYOffsets.get(display.level) ?? 0
        perTrack.set(display.displayKey, { ...params, yTop })
      }
    }
    if (perTrack.size === 0) return undefined
    return { maxOffScreenPx: self.maxOffScreenDrawPx, perTrack }
  },

  /** key → display map for picking dispatch */
  get displaysByKey() {
    const m = new Map<number, LinearSyntenyDisplayModel>()
    for (const track of self.tracks) {
      for (const display of track.displays) {
        if (isLinearSyntenyDisplay(display)) {
          m.set(display.displayKey, display)
        }
      }
    }
    return m
  },

  /** Total canvas height — sum of all level heights */
  get syntenyCanvasHeight() {
    let h = 0
    for (const level of self.levels) {
      h += level.collapsed ? 0 : level.effectiveHeight
    }
    return h
  },
}))
.actions(self => {
  const baseStop = self.stopGpuBackendLifecycle
  return {
    startGpuBackendLifecycle(backend: SyntenyBackend) {
      self.gpuBackend = backend
      self.startSingleDataGpuLifecycle({
        backend,
        uploadSlots: [],
        getRenderState: () => self.syntenyRenderState,
        renderWithState: (b, state) => {
          b.resize(self.width, self.syntenyCanvasHeight)
          b.render(state)
          self.markCanvasDrawn()
        },
      })
    },
    stopGpuBackendLifecycle() {
      baseStop()
      self.gpuBackend = null
    },
  }
})
```

---

## Step 5 — Display model changes

**Drop:**

- `gpuBackend` volatile (now read from view)
- `startGpuBackendLifecycle` action's `self.gpuBackend = backend` line
- The `uploadOneRegion: (b, key, data) => b.uploadGeometry(key, data)` passes
  `key` from the rpcDataMap. PR-A uses `DISPLAY_KEY=0`; PR-B uses
  `self.displayKey`.

**Change:**

- `setGeometry(data)` writes to `displayKey` slot, not `0`.
- Pass `deleteOneRegion: (b, key) => b.deleteGeometry(key)` to the multi-region
  util (the new util extension).

**Add display-binding autorun** in `afterAttach.ts` (mirrors dotplot):

```ts
addDisposer(
  self,
  autorun(
    function syntenyDisplayBackendBinding() {
      let view: LinearSyntenyViewModel
      try {
        view = getContainingView(self) as LinearSyntenyViewModel
      } catch {
        return
      }
      const backend = view.gpuBackend
      if (backend) self.startGpuBackendLifecycle(backend)
      else self.stopGpuBackendLifecycle()
    },
    { name: 'SyntenyDisplayBackendBinding' },
  ),
)
```

**Add `beforeDestroy`** to delete this display's key from the shared backend:

```ts
beforeDestroy() {
  const key = self.displayKey
  self.stopGpuBackendLifecycle()
  const view = getContainingView(self) as LinearSyntenyViewModel | null
  view?.gpuBackend?.deleteGeometry(key)
}
```

---

## Step 6 — Display React component (LinearSyntenyRendering.tsx)

**Strip:**

- `gpuCanvasRef` + the `<canvas>` element
- `useGpuRenderer(...)`
- `useTabVisibilityRerender(...)`
- All wheel/zoom/scroll handlers (`onWheel`, `useWheelHandler`-like `useEffect`,
  `scheduleHorizontalScroll`)
- All mouse handlers that read `gpuCanvasRef` for canvas-relative coords:
  `handleMouseMove`, `handleMouseLeave`, `handleMouseDown`, `handleMouseUp`,
  `handleContextMenu` — those move to the view.

**Keep:**

- Tooltip overlay (uses `model.tooltipText`)
- Context menu UI (anchorEl state + `<SyntenyContextMenu>`) — but the
  `setAnchorEl` callback now needs to be invoked _by the view_ via a
  display-side action (`display.openContextMenu({clientX, clientY, feature})`).
  Or: keep `anchorEl` per-display and have the view's pick result include enough
  info to dispatch via `display.handleContextMenu`.
- LoadingOverlay, ErrorMessage

End state: ~80 lines (down from ~300).

---

## Step 7 — View React component (LinearSyntenyView.tsx)

Add a new `SyntenyCanvas` component (mirror DotplotCanvas) that hosts the shared
canvas and runs the GPU lifecycle:

```tsx
const SyntenyCanvas = observer(function SyntenyCanvas({model}: {model: LinearSyntenyViewModel}) {
  const { width, syntenyCanvasHeight } = model
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gpuOpts = useMemo(() => ({
    onReady: (b: SyntenyBackend) => model.startGpuBackendLifecycle(b),
    onDispose: () => model.stopGpuBackendLifecycle(),
  }), [model])
  const { error } = useGpuRenderer(canvasRef, SyntenyRendererFactory, gpuOpts)
  useTabVisibilityRerender(() => model.renderNow())

  // Mouse handling moved here. Computes canvas-relative coords, calls
  // pick, dispatches to display via view.displaysByKey.

  return (
    <canvas
      ref={canvasRef}
      data-testid={model.canvasDrawn ? 'synteny_canvas_done' : 'synteny_canvas'}
      style={{width, height: syntenyCanvasHeight, position: 'absolute', ...}}
      onMouseMove={...}
      onMouseLeave={...}
      onMouseDown={...}
      onMouseUp={...}
      onContextMenu={...}
    />
  )
})
```

The wheel handler operates on `view.views` directly (already does today inside
the display) — no per-level dispatch needed since wheel zoom/scroll is
view-wide.

The mouse handlers call
`model.gpuBackend.pick(x, y, hit => {   const display = hit ? model.displaysByKey.get(hit.key) : undefined   display?.setHoveredFeatureIdx(hit?.featureIndex ?? -1)   // or display?.handleClick(...) for mouseup with no drag })`.

Position the `SyntenyCanvas` absolute, behind the existing per-level
controls/overlays. Z-order matters: canvas at z=0, overlays above.

---

## Step 8 — Tear-down sequence

Verify with a targeted test:

- View dispose → `stopGpuBackendLifecycle` → backend dispose → done.
- Display dispose (track removal) → `beforeDestroy` runs
  `view.gpuBackend.deleteGeometry(self.displayKey)` → next render skips that
  key. Other displays unaffected.
- Backend swap (e.g. WebGPU context loss → reinit): `useGpuRenderer` fires
  `onDispose` then `onReady` with new backend. Each display's binding autorun
  sees `view.gpuBackend` flip null→new → restarts upload lifecycle, re-uploads
  its geometry under its key. Verify in browser.

---

## Step 9 — Validation

### Unit tests

- `Canvas2DSyntenyRenderer.test.ts` — already covers multi-track render +
  per-track yTop pick gating from PR-A. Add test for `deleteGeometry` mid-
  lifecycle (already present).
- New: `LinearSyntenyView/model.test.ts` extension — unit-test `levelYOffsets`,
  `syntenyRenderState`, `displaysByKey` aggregation with fixture displays.
- Util: `startGpuBackendAutorunLifecycle.test.ts` — add a `deleteOneRegion` test
  (key disappears from dataMap → callback fires).

### Browser smoke

- 2-genome PIF — hover, click, contextmenu on either side.
- 3+ genome dataset (chained pairs) — verify per-level y offsets are correct,
  picking returns the right feature on the right level.
- Tab hide/show — `view.renderNow()` fires; canvas repaints.
- Track add — new display binds, geometry appears in shared backend.
- Track remove — geometry slot evicts; other tracks unaffected.
- Resize via ResizeObserver — canvas resizes; render runs.

---

## Step 10 — Cleanup after PR-B lands

Once PR-B is verified:

- Delete `tabVisibilityVersion` / `bumpTabVisibility` from
  `MultiLGVSyntenyDisplay/model.ts` if its migration follows the same pattern
  (or leave for that separate effort).
- Move `useTabVisibilityRerender` → HAL-level `visibilitychange` listener
  (NEXT_STEPS Tier 3) — drops the React hook entirely.
- Update `agent-docs/NEW_ARCHITECTURE.md` "Geometry-keyed display" section to
  remove the "pending migration" caveats.

---

## Risks (what to verify carefully)

1. **Picking accuracy at level boundaries.** New y_top uniform must match the
   renderer's per-track y range. Add a test: feature at y=98 in a 100-px-tall
   track should be hittable; y=101 should fall through to the next track. Both
   Canvas2D and GPU paths.

2. **Per-track render param diffing.** The view's `syntenyRenderState` getter
   walks N displays per render. Cached MST view should keep this O(changed-only)
   but verify with a 10-track dataset that hover on one track doesn't re-iterate
   all tracks' computations more than necessary.

3. **Wheel/zoom event landing.** Today the display's canvas catches the event.
   View's canvas catches it now — verify it doesn't conflict with per-level
   controls (DotplotControls equivalent) that may be overlaid.

4. **Context menu coordinates.** Tooltip + context menu use `event.clientX/Y`
   which doesn't change. But the canvas size is now different (full view
   height), so any `getBoundingClientRect()` math must reference the new canvas.

5. **Shader uniform layout drift.** The synteny uniforms struct gains `y_top`
   (and possibly `track_id_byte`). Both WGSL and GLSL must update in lockstep.
   Use the existing `// SYNC:` convention.

6. **Sliced-region render culling.** Today off-screen culling is per-canvas;
   per-track yTop changes the y range in canvas space. Off-screen X culling
   (`maxOffScreenPx`) is unchanged; off-screen Y doesn't exist in the synteny
   shader (parallelogram spans full track height). Verify no implicit y-axis
   assumption breaks.

---

## Ordering inside PR-B

1. Util: add `deleteOneRegion` to `startGpuBackendAutorunLifecycle` + test.
2. Shaders: add `y_top` uniform + (later) `track_id_byte`.
   GpuSyntenyRenderer.writeUniforms updates. Smoke-test with one display to
   verify nothing regresses.
3. Renderer: GpuSyntenyRenderer.pick loops `pickContexts` instead of `[0]`; HAL
   readPickingPixel returns track_id.
4. View model: `gpuBackend` volatile + `syntenyRenderState` / `displaysByKey` /
   `syntenyCanvasHeight` getters + `start/stopGpuBackendLifecycle`.
5. Display model: `displayKey` getter; `setGeometry` uses it; binding autorun in
   afterAttach; `beforeDestroy` calls deleteGeometry on shared backend.
6. View component: `SyntenyCanvas` with useGpuRenderer + mouse handlers
   - pick dispatch.
7. Display component: strip canvas + handlers; overlay-only.
8. Browser smoke: full matrix from Step 9.

---

## Files

To touch:

- `packages/core/src/gpu/startGpuBackendAutorunLifecycle.ts` (+ test)
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/wgslShaders.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/glslShaders.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/GpuSyntenyRenderer.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/components/LinearSyntenyRendering.tsx`
- `plugins/linear-comparative-view/src/LinearSyntenyView/model.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyView/components/LinearSyntenyView.tsx`
- maybe `packages/core/src/gpu/hal/*` for `readPickingPixel` return change

Not touched:

- `MultiLGVSyntenyDisplay/*`
- `Canvas2DSyntenyRenderer.ts` (already multi-track-ready from PR-A)
- RPC fetch path
