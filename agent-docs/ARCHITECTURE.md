# GPU Rendering Architecture

Canonical reference for the GPU rendering lifecycle across all display types.
Read `PRD.md` first for invariants and active priorities.

---

## One-liner

Each GPU display is an MST model whose autoruns observe per-region data and
views, then call the backend's upload/prune/render methods through a
disposable handle. React components are thin bridges — create a canvas, hand
the backend to the model, render JSX.

---

## Layers

```
RPC worker returns data
        │
        ▼ self.setLoadedRegion(n, data)   (or equivalent)
MST model
  ├─ .volatile rpcDataMap: Map<number, Data>
  ├─ .volatile gpuBackendLifecycleHandle, canvasDrawn
  │     (from GpuBackendLifecycleSlotMixin, composed by MultiRegionDisplayMixin)
  ├─ .views (cached getters):
  │     get renderBlocks()    (inherited — buildRenderBlocks(view.visibleRegions))
  │     get renderState()     (plugin-specific)
  │     get rpcProps          (literal RPC payload + invalidation source)
  │     get gpuProps()        (optional — typed input for main-thread encoders)
  └─ .actions:
        startGpuBackendLifecycle(backend)
          → self.startMultiRegionGpuLifecycle({...adapters...})
                  (or self.startSingleDataGpuLifecycle({...}) for global-upload)
        stopGpuBackendLifecycle()           (from mixin)
        renderNow()                         (from mixin)
        markCanvasDrawn()                   (from mixin; idempotent)

React component (observer, ~30 lines)
  ├─ const { canvasRef, error, retry } =
  │      useGpuModelLifecycle(RendererFactory, model)
  │   (composes useGpuRenderer + useTabVisibilityRerender; wires onReady/
  │    onDispose to model.startGpuBackendLifecycle / stopGpuBackendLifecycle)
  └─ JSX (canvas + overlays + error UI)
```

---

## Three backend families, three utilities

### A. Multi-region display (wiggle, canvas, variants pileup, alignments)

```ts
interface MultiRegionBackend<Data, State> {
  uploadRegion(displayedRegionIndex: number, data: Data): void
  pruneRegions(activeDisplayedRegionIndices: number[]): void
  renderBlocks(blocks: RenderBlock[], state: State): void
  dispose(): void
}
```

Lifecycle utility: `startGpuBackendAutorunLifecycle<Backend, State>`. Spawns
**one autorun per upload entry** plus **one render autorun**. Each upload
autorun iterates its data map and calls `upload` per region (MobX tracks every
observable read inside `upload`). The render autorun reads `renderBlocks`,
`renderState`, and a shared upload counter — so render-only changes (e.g.
hover) skip the upload pass.

Plugins call the mixin wrapper:

```ts
self.startMultiRegionGpuLifecycle({
  backend,
  uploads: [
    {
      getData: () => self.rpcDataMap,
      upload: (b, n, data) => b.uploadRegion(n /* plugin-specific args */),
      prune: (b, active) => b.pruneRegions(active), // optional
      deleteOne: (b, n) => b.deleteRegion(n), // optional — for shared backends
    },
  ],
  renderBlocks: () => self.renderBlocks,
  // Return undefined to suppress the render pass entirely (e.g. wiggle
  // returns undefined until autoscale resolves `self.domain`). The slot
  // mixin only fires markCanvasDrawn after a real `render()` call.
  renderState: () => self.renderState,
  render: (b, blocks, state) => b.renderBlocks(blocks, state),
})
```

**Multiple upload pipelines** (alignments: pileup + arcs) are separate entries
in `uploads`. Each entry's autorun runs independently. Entries that share
backend region slots (arcs share pileup's prune) can omit `prune`.

**No per-region cache.** "MobX is the cache" — any observable read inside
`upload` is tracked, and a change re-fires the autorun. Plugins whose upload
bytes depend on settings read them inside `upload` via `self.gpuProps()`; no
separate invalidation token.

**Per-region zoom-staleness** (`isCacheValid(displayedRegionIndex)`). Worker
output is always BP offsets from `regionStart` (no pixel coordinates cross
the worker boundary), so most plugins never need a zoom check. Two do:

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based
  on `bpPerPx / resolution`, baking granularity into the fetch.
  `isCacheValid` uses strict equality (`view.bpPerPx === loadedBpPerPx`)
  — any zoom change invalidates every region so `FetchVisibleRegions`
  refetches all visible regions in one batch, keeping adjacent regions
  at the same bigwig zoom level. `@gmod/bbi`'s block cache and
  `RemoteFileWithRangeCache`'s 256 KiB chunks absorb the per-zoom
  refetch cost. See `architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md`.

- **Canvas**: the only `bpPerPx`-dependent worker decision is the amino-acid
  overlay (`shouldRenderPeptideBackground`). `isCacheValid` refetches only
  when the viewport crosses that threshold — not on continuous zoom drift.

Alignments / HiC / LD / variants leave the default `() => true` — their
worker output has no `bpPerPx`-dependent decisions (alignments layout is
main-thread; HiC/LD/variants apply the zoom transform in the shader).
`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the override
per region and refetches stale ones.

**Refresh without blanking.** `FetchVisibleRegions` re-queues stale
regions but leaves `rpcDataMap` populated; `setRpcData` overwrites
entries in place when results arrive, so each region swaps atomically
with no empty frame. Two paths exist for *explicit* wipes, used only
when prior data would be wrong to show:

- `invalidateLoadedRegions` — clears bounds and cancels in-flight
  fetches, but preserves `rpcDataMap`. Old pixels stay until the
  refetch lands.
- `clearAllRpcData` — the aggressive wipe: cancels, clears bounds,
  clears `rpcDataMap`. Canvas goes empty. Used by `SettingsInvalidate`
  and `DisplayedRegionsChange`, where stale data under new settings
  would mislead.

Wiggle's `bpPerPx` path stays in the first category: old bins upsample
visually until new data streams in.

**Derived-layout pattern.** Canvas splits raw fetch from laid-out data:
`volatile rawRpcDataMap` → cached view `rpcDataMap` calls pure
`computeLaidOutData(raw, {bpPerPx, showLabels, ...})`. Upload reads
`self.rpcDataMap`, so zoom or label toggle re-derives layout and re-fires
upload without a dedicated relayout autorun. Alignments inverts this — layout
runs as a side effect inside `upload` (`computeAndAssignLayoutForData` before
`b.uploadRegion`) because chain and pileup layout share state across regions
(see `plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`).

**Contract:** per-region value objects must be freshly constructed, never
mutated in place. Setters follow the spread-then-assign pattern of
`setLoadedRegion` on `MultiRegionDisplayMixin`.

### B. Global-upload display (HiC, LD, variant-matrix)

```ts
interface GlobalBackend<State> {
  /* one or more plugin-specific upload methods */
  render(state: State): void
  dispose(): void
}
```

Lifecycle utility: `startGpuSingleDataBackendAutorunLifecycle<Backend, State>`:

```ts
self.startSingleDataGpuLifecycle({
  backend,
  uploads: [
    { getData: () => self.rpcData,     upload: (b, d) => b.uploadData(...) },
    { getData: () => self.colorScheme, upload: (b, s) => b.uploadColorRamp(...) },
  ],
  renderState: () => self.renderState,
  render: (b, state) => b.render(state),
})
```

Each entry is identity-diffed independently. Render fires only after every
entry has data. Couple uploads in one entry when they share a source; split
when independent.

### C. Geometry-keyed display (dotplot, synteny)

```ts
interface GeometryBackend<Key, Data, State> {
  resize(width: number, height: number): void
  uploadGeometry(key: Key, data: Data): void
  deleteGeometry(key: Key): void
  render(state: State): void
  dispose(): void
}
```

Canvas + render lifecycle live on the **view**; each display contributes
geometry keyed by its track index. The view aggregates per-track render state
and issues a single draw.

- Displays use `startMultiRegionGpuLifecycle` with `deleteOne` on the upload
  entry (per-key cleanup for shared backends) and `renderState: () =>
  undefined` to suppress the display-level render pass.
- The view uses `startSingleDataGpuLifecycle` with `uploads: []` (empty ⇒
  `allPresent = true`, so render fires on state alone) and a `renderState`
  aggregating each display's parameters.

---

## Shared MST building blocks

### `GpuBackendLifecycleSlotMixin`

Composed by `MultiRegionDisplayMixin` (so every region display inherits it)
and by non-region GPU displays directly.

| Provision                                   | Purpose                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `volatile canvasDrawn: boolean`             | Read by overlays / loading UI.                                                                   |
| `volatile gpuBackendLifecycleHandle`        | Stores the `{ dispose, renderNow }` handle. Undefined before start / after stop.                 |
| `setCanvasDrawn(val)` / `markCanvasDrawn()` | Idempotent — early-return when value unchanged.                                                  |
| `stopGpuBackendLifecycle()`                 | Disposes the handle + clears the slot.                                                           |
| `renderNow()`                               | Forwards to the handle's `renderNow`. Called from `useTabVisibilityRerender`.                    |
| `startMultiRegionGpuLifecycle(args)`        | Wraps `startGpuBackendAutorunLifecycle` — runs `markCanvasDrawn` after every plugin `render()`. |
| `startSingleDataGpuLifecycle(args)`         | Wraps `startGpuSingleDataBackendAutorunLifecycle` — same post-render mark.                       |

`render()` only fires once data is on the GPU (multi-region: ≥1 region
uploaded; single-data: every entry has data) **and** `renderState` is
defined. Plugins needing an extra gate (e.g. wiggle's autoscale domain)
return `undefined` from `renderState` until ready — `render` is skipped, so
`markCanvasDrawn` stays false.

### `FetchMixin`

Owns the fetch state machine. Composed by both `MultiRegionDisplayMixin` and
`GlobalDataDisplayMixin`.

| Provision         | Purpose                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isLoading`       | True while a fetch is active.                                                                                                                                                       |
| `error`           | Last non-abort error (or undefined).                                                                                                                                                |
| `statusMessage`   | Work-in-progress status string.                                                                                                                                                     |
| `fetchSignal`     | Observable counter that bumps whenever a fetch ends. Autoruns that need to re-evaluate after fetch completion read `void self.fetchSignal` to subscribe.                            |
| `runFetch(work)`  | Start a cancellable fetch (MST flow); cancels any prior in-flight fetch. Captures `fetchSignal` epoch at start — `isStale()` fires if a cancel arrives mid-flow.                   |
| `cancelFetch()`   | Cancel any in-flight fetch and bump `fetchSignal`.                                                                                                                                  |

### `MultiRegionDisplayMixin`

Every LGV-based display composes this; composes `GpuBackendLifecycleSlotMixin`
and `FetchMixin` internally. Provides cached `renderBlocks` (from
`buildRenderBlocks`), `fullyDrawn = canvasDrawn && !isLoading`, the
upload-identity contract on `setLoadedRegion`, a single `SettingsInvalidate`
autorun that reads `void self.rpcProps` → `self.clearAllRpcData()`, and the
`FetchVisibleRegions` autorun. Per-region fetches call `self.runFetch(async
ctx => { ... })` — the `FetchContext` holds the `stopToken` and `isStale()`.

### `StaleViewportRescaleMixin`

Composed by displays that hold a single global RPC result (HiC, LD). Stores
the `(offsetPx, bpPerPx)` of the last completed draw and exposes
`viewportTransform(view)` → `{ scale, translateX }` for the CSS/shader
transform that keeps the stale canvas aligned while a fresh fetch is in
flight.

---

## The `rpcProps` / `gpuProps` pattern

Domain-named getters that enumerate **what affects rendering output**. Each
is the single source of truth for both its data-pipeline consumer and its
invalidation mechanism — adding a field auto-wires both.

| Getter        | Consumer                                                                       | Invalidation route                                                                                |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `rpcProps`    | `rpcManager.call(..., { ...self.rpcProps, ... })` — literal RPC payload        | Mixin `SettingsInvalidate` autorun reads `void self.rpcProps` → `clearAllRpcData` → refetch       |
| `gpuProps()`  | `buildSourceRenderData(data, self.gpuProps())` — typed input to the encoder    | Upload autorun reads `self.gpuProps()` inside `upload()` — changes re-upload without RPC round-trip |
| `renderState` | `backend.renderBlocks(blocks, state)` per frame                                | Render autorun fires when `renderState` identity changes                                          |

`gpuProps` exists only where the main thread encodes the GPU buffer (wiggle).
Canvas's worker pre-builds the buffer, so canvas has only `rpcProps`.

Splitting refetch from re-upload avoids wasted RPC roundtrips. Wiggle color
change → re-encode the per-instance buffer (worker output unchanged) → upload
only. `bicolorPivot` change → worker output differs → flows through
`rpcProps` → refetch.

HiC, LD, and multi-sample variants follow a single-action pattern: a
`performXxxFetch()` action calls `self.runFetch(async ctx => { ... })`. An
`afterAttach.ts` autorun re-fires it on viewport / `rpcProps` changes;
`reload()` calls it directly.

Tested in `fetchAutorun.test.ts` under
`plugins/{wiggle,canvas,alignments}/.../LinearWiggleDisplay|LinearBasicDisplay|LinearAlignmentsDisplay/`.

---

## HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/core/src/gpu/hal/`.

```ts
// packages/core/src/gpu/hal/createHal.ts
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  → if ?renderer=canvas2d: return null
  → if not ?renderer=webgl: try WebGPU → WebGPUHal
  → fallback to WebGL2 → WebGL2Hal
  → if both fail: return null (Canvas2D used by initDualBackend)
```

**Key methods:** `uploadBuffer(regionKey, passId, data, count)`,
`drawPass(passId, regionKey, bufferPassId?)`, `writeUniforms(data)`,
`setScissor`, `setViewport`, `setRegionMeta` / `getRegionMeta`, `dispose()`.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery), `WebGL2Hal`
(`antialias: true`, VAO + UBO, context-loss recovery), `MockHal` (tests).

**Picking passes skip MSAA** in both backends for accurate color-based picking.

**Backend override** (query param `?renderer=`): `webgpu` / `webgl` /
`canvas2d` / `canvas`; omitted → auto-detect WebGPU → WebGL2 → Canvas 2D.

**Context / device loss recovery:** `useGpuRenderer` listens for
`webglcontextlost`/`restored` (WebGL) and `device.lost` (WebGPU); bumps
`contextVersion` → disposes the old backend → re-inits. `pagehide` disposes
immediately (Chrome caps 16 live contexts).

**Tab visibility:** hidden tabs discard WebGPU swap-chain textures.
`useTabVisibilityRerender` listens for `visibilitychange` and calls
`requestAnimationFrame(() => model.renderNow())`. RAF is required — calling
`getCurrentTexture()` directly from the handler can return a detached texture
under WebGPU.

---

## Shaders (Slang codegen)

Production draw shaders are authored as `.slang`, compiled to WGSL (WebGPU)
and GLSL ES 3.00 (WebGL2) by `scripts/build-shaders.ts`. See ADR-005.

**Layout:** display-specific shaders live in
`plugins/<plugin>/src/<display>/shaders/<name>.slang`; per-plugin shared in
`plugins/<plugin>/src/shared/shaders/` (wiggle uses this); cross-plugin
modules (`hpmath.slang`, `colorPack.slang`) in
`packages/core/src/gpu/shaders/`. Codegen emits `<name>.generated.ts` with
`WGSL_SOURCE`, `GLSL_VERTEX`, `GLSL_FRAGMENT`, `GL_ATTRIBUTES`,
`INSTANCE_STRIDE_BYTES`, `UNIFORM_OFFSET_F32`, plus `TEXTURES` when needed.

**Wire-up:** `slangPass()` (`packages/core/src/gpu/slangPass.ts`) turns a
generated module into a `PassDescriptor`, with overrides for `topology`,
`blendState`, `textures`, `picking`, and buffer sharing.

**Non-Slang holdouts:** hand-written WGSL compute shaders in
`plugins/variants/src/VariantRPC/{ldComputeShader,ldPhasedComputeShader}.ts`
(WebGPU-only).

Authoring conventions and gotchas: ADR-005.

---

## BP precision (high-precision coordinates)

Genomic positions exceed 3×10⁹ on T2T assemblies; 32-bit float's ~7 decimal
digits are insufficient at chromosome scale. GPU renderers split each BP
position into hi/lo halves: `position_bp = hi + lo`.

`blockClipUtils.clipBlock` emits `[bpStartHi, bpStartLo]` for the visible
window; `hp_to_clip_x` in `hpmath.slang` reconstructs precision at draw time.
A `zero` uniform (runtime `0.0`) blocks the compiler from collapsing the
subtraction back to single precision.

---

## Uniforms & canvas scaling

Shader uniforms use **CSS pixels**. The HAL sets the canvas backing store to
`css × dpr`, so `N / canvas_width` in clip space equals `N` CSS pixels at any
DPR. **Do not manually scale by `devicePixelRatio`.**

---

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions` (the user's configured region
list). Stable unless regions are added, removed, or reordered. **Not** an
index into `dynamicBlocks.contentBlocks` — one displayedRegion can produce
multiple render blocks that share one GPU buffer and draw with different
scissor clips.

The join key across `model.rpcDataMap`,
`hal.uploadBuffer(displayedRegionIndex, passId, ...)`, and
`RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot, synteny)
key on a tuple of two displayedRegion indices.

---

## Backend interfaces per plugin

Each plugin defines a Backend interface (one of the three families) and a
renderer factory:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<XxxBackend>(
    canvas,
    XXX_PASSES,
    XXX_UNIFORM_BYTE_SIZE,
    hal => new GpuXxxRenderer(hal),
    c => new Canvas2DXxxRenderer(c),
  )
}
```

`initDualBackend` calls `createGpuHal`; if a HAL is returned, the GPU backend
is constructed, otherwise Canvas 2D.

Each plugin re-exports `RenderBlock` under an alias (`WiggleRenderBlock`,
`FeatureRenderBlock`, `VariantRenderBlock`, `RenderBlock`) — all structurally
identical.

---

## Adding a new GPU display type

- **Types** — `MyData`, `MyRenderState`, `MyBackend` (pick a family).
- **Shader** — author `my.slang` under the plugin's `shaders/` dir; `pnpm
  gen:shaders` emits `my.generated.ts`.
- **Renderers + factory** — `initDualBackend<MyBackend>` from
  `packages/core/src/gpu/createDualRenderer.ts`, with a GPU and a Canvas2D
  implementation. Use `slangPass()` to build the `PassDescriptor`.
- **MST model:**
   - Compose `MultiRegionDisplayMixin()` for LGV-family displays (brings in
     the GPU slot + fetch mixins); non-region displays compose
     `GpuBackendLifecycleSlotMixin()` directly.
   - Add a cached `renderState` view (override `renderBlocks` only for
     plugin-specific gating).
   - Add `startGpuBackendLifecycle(backend)` calling
     `self.startMultiRegionGpuLifecycle({...})` or
     `self.startSingleDataGpuLifecycle({...})`.
   - Setters produce fresh value objects, never mutate.
   - Expose `rpcProps` (refetch source of truth); add `gpuProps()` only when
     the main thread encodes GPU buffers from settings.
- **React component** — `observer()`:
   ```tsx
   const { canvasRef, error, retry } = useGpuModelLifecycle(MyRenderer, model)
   return <>{error && <ErrorBar action={retry} …/>}<canvas ref={canvasRef}/></>
   ```
   The hook composes `useGpuRenderer` + `useTabVisibilityRerender` and wires
   `onReady` / `onDispose` to the model's start/stop actions. `model` is
   duck-typed to the slot mixin's contract (`start/stop/renderNow`).
- **Tests** — unit (`MockHal`); browser (Puppeteer,
  `--backend=webgl|webgpu|canvas2d`).

---

## What NOT to do

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` — it
  belongs in the MST autorun.
- Don't read `dataVersion` at plugin level — it's a debug counter on
  `MultiRegionDisplayMixin`.
- Don't destructure model methods (`const { startGpuBackendLifecycle } =
  model`); call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't call `startGpuBackendAutorunLifecycle` /
  `startGpuSingleDataBackendAutorunLifecycle` directly — go through
  `self.startMultiRegionGpuLifecycle` / `self.startSingleDataGpuLifecycle`.
- Don't redefine `canvasDrawn` / `setCanvasDrawn` on a plugin model — the
  slot mixin owns them.
- Don't fold upload and render autoruns back together — the split is
  load-bearing.
- Don't hand-maintain WGSL/GLSL/offset tables next to generated modules;
  consume the generated constants.
