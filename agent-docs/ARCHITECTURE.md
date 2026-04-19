# GPU Rendering Architecture

Canonical reference for the GPU rendering lifecycle across all display types.
Read `PRD.md` first for invariants and active priorities.

**Status:** 9/9 LGV-family display types use the MST-driven autorun pattern.
Dotplot uses a related geometry-keyed pattern and is being folded into the
same util (`DOTPLOT_REFACTOR.md`). Synteny PR-A (keyed backend + MST autorun)
landed; PR-B (view owns canvas) is the next refactor (`SYNTENY_REFACTOR_PR_B.md`).

---

## One-liner

Every GPU display has an MST model that owns an `autorun` which observes MST
views and per-region data, calls the backend's upload/prune/render methods,
and produces a disposable handle. React components are thin bridges: create a
canvas, hand the resulting backend to the model, render JSX.

---

## Layers

```
RPC worker returns data
        │
        ▼ self.setLoadedRegionForRegion(n, data)   (or equivalent)
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
  uploadRegion(regionNumber: number, data: Data): void
  pruneRegions(activeRegionNumbers: number[]): void
  renderBlocks(blocks: RenderBlock[], state: State): void
  dispose(): void
}
```

Lifecycle utility: `startGpuBackendAutorunLifecycle<Backend, State>`. Runs
**one autorun per upload entry** (reads its data map and calls `upload` for
every region — MobX tracks every observable `upload` reads) and **one render
autorun** (reads `renderBlocks`, `renderState`, and a shared upload counter).
Render-state-only changes (e.g. hover) re-fire only the render autorun.

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

**No per-region cache.** Any observable `upload()` reads is tracked — on
change the upload autorun fires and re-uploads every region. "MobX is the
cache." Plugins whose upload bytes depend on settings read those settings
inside `upload` via `self.gpuProps()` — no separate invalidation token.

**Per-region zoom-staleness** (`isCacheValid(regionNumber)`). Worker
output X positions are always BP offsets from `regionStart` — no plugin
ships pixel coordinates across the worker boundary. The reason wiggle and
canvas still need a zoom-staleness check is more subtle and differs per
plugin:

- **Wiggle**: BigWig stores discrete zoom levels (1bp, ~10bp, ~100bp,
  ~1000bp summaries). The worker picks one based on `bpPerPx / resolution`.
  Output bins are genomic but their *granularity* is fixed at fetch time.
  When the user zooms in past 2x (`view.bpPerPx < loadedBpPerPx / 2`),
  the loaded bins are too coarse for the new viewport and need refetching
  at a finer zoom level. The reverse (zooming out) is fine — fine bins
  downsample for free. The check is one-sided in
  `LinearWiggleDisplay/model.ts`'s `isCacheValid`.

- **Canvas**: worker output positions and heights are fully genomic and
  config-driven — `rectPositions` are BP offsets, `rectHeights` is
  `config.featureHeight * heightMultiplier`, child positions are looked up
  from `feature.get('start')` in `collectRenderData`. `FeatureLayout`
  carries only `feature`, `glyphType`, `y`, `height`, `totalLayoutHeight`,
  `children` — all viewport-independent. The only `bpPerPx`-dependent
  worker decision that affects output is whether the amino-acid overlay
  was fetched (gated by `shouldRenderPeptideBackground` — overlay is only
  computed at fine zoom). `isCacheValid` reflects that: refetch when the
  current viewport crosses the peptide-background threshold relative to
  the fetch's `bpPerPx`, never on continuous zoom drift. The
  `maxFeatureDensity` gate is also `bpPerPx`-driven but only matters at
  fetch time; treating it as a one-shot decision and decoupling the
  amino-acid overlay into its own fetch pipeline would let canvas drop
  `isCacheValid` entirely — that's the long-term direction.

Plugins override the mixin's `isCacheValid` hook to express their own
threshold; `MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls
it per region and refetches only the stale ones. Alignments, HiC, LD,
and variants leave the default `() => true` because their worker output
contains no `bpPerPx`-dependent decisions at all (layout is fully
main-thread for alignments; HiC/LD/variants render genomic data through a
shader that handles the zoom transform).

**Derived-layout pattern (canvas).** Canvas splits raw fetch results from
laid-out data:
`volatile rawRpcDataMap` (post-RPC) → cached MST view `get rpcDataMap()` which
calls pure `computeLaidOutData(raw, {bpPerPx, showLabels, ...})`. Upload reads
`self.rpcDataMap` — MobX invalidates the cached view on any input change, so
zoom or label toggle re-derives layout and re-fires upload, no separate
relayout autorun needed. Alignments uses the same idea differently: layout is
computed as a side effect in the upload callback
(`computeAndAssignLayoutForData` runs before `b.uploadRegion`), because chain
and pileup layout share state across regions (see
`plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`).

**Contract:** per-region value objects must be freshly constructed on update
(never mutated in place). Plugin setters follow the spread-then-assign pattern
used by `setLoadedRegionForRegion` on `MultiRegionDisplayMixin`.

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

Each entry is independently identity-diffed. Render fires only after every
entry has data. Couple uploads in one entry when they derive from the same
source (LD data + color ramp both from `rpcData`); split when they are
independent (HiC matrix vs. color ramp).

### C. Geometry-keyed display (dotplot, synteny PR-B)

```ts
interface GeometryBackend<Key, Data, State> {
  resize(width: number, height: number): void
  uploadGeometry(key: Key, data: Data): void
  deleteGeometry(key: Key): void
  render(state: State): void
  dispose(): void
}
```

Canvas + render lifecycle live on the **view**. Each display under the view
contributes upload geometry keyed by its track index. The view aggregates
per-track render state and issues a single draw.

- Each display uses `startMultiRegionGpuLifecycle` with `deleteOne` on its
  upload entry (per-key cleanup for shared backends). Display's `renderState`
  returns `undefined` to disable the render pass at the display level.
- The view uses `startSingleDataGpuLifecycle` with empty `uploads: []` (empty
  means `allPresent = true` so render fires on state alone) and a
  `renderState` that aggregates each display's per-track parameters.

See `DOTPLOT_REFACTOR.md` and `SYNTENY_REFACTOR_PR_B.md`.

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

The util only invokes `render()` once data is on the GPU (multi-region:
≥1 region uploaded; single-data: every entry has data) and `renderState`
is defined. Plugins that need an additional gate (wiggle's autoscale
domain) return `undefined` from `renderState` until ready — `render` is
skipped, so `markCanvasDrawn` is not called.

### `MultiRegionDisplayMixin`

Every LGV-based display composes this; composes `GpuBackendLifecycleSlotMixin`
internally. Provides cached `renderBlocks` (from `buildRenderBlocks`),
`fullyDrawn = canvasDrawn && !isLoading`, the upload-identity contract on
`setLoadedRegionForRegion`, a single `SettingsInvalidate` autorun that reads
`void self.rpcProps` → `self.clearAllRpcData()`, the `FetchVisibleRegions`
autorun, and shared volatiles for `error` / `renderingStopToken` /
`statusMessage`. The `withFetchLifecycle(needed, work)` action wraps a
fetch with stop-token rotation, `isStale()` cancellation, and error
handling — used both by per-region displays (alignments, wiggle, canvas,
variants pileup) and global-data displays (HiC, LD).

### `StaleViewportRescaleMixin`

Composed by displays that hold a single global RPC result rather than
per-region buffers (HiC, LD). Stores the `(offsetPx, bpPerPx)` of the
last completed draw, and exposes `viewportTransform(view)` which returns
`{ scale, translateX }` for the CSS / shader transform that keeps the
stale canvas aligned with the live viewport while a fresh fetch is in
flight. Per-region displays don't need this — the GPU shader's per-region
uniforms handle the alignment.

---

## The `rpcProps` / `gpuProps` pattern

Domain-named getters that name **what affects rendering output**. Each is the
**single source of truth** used by both its data-pipeline consumer and its
invalidation mechanism — adding a field auto-wires both jobs.

| Getter        | Consumer                                                                       | Invalidation route                                                                                |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `rpcProps`    | `rpcManager.call(..., { ...self.rpcProps, ... })` — literal RPC payload        | Mixin `SettingsInvalidate` autorun reads `void self.rpcProps` → `clearAllRpcData` → refetch       |
| `gpuProps()`  | `buildSourceRenderData(data, self.gpuProps())` — typed input to the encoder    | Upload autorun reads `self.gpuProps()` inside `upload()` — changes re-upload without RPC round-trip |
| `renderState` | `backend.renderBlocks(blocks, state)` per frame                                | Render autorun fires when `renderState` identity changes                                          |

`gpuProps` is only present where the main thread encodes the GPU buffer
(wiggle). Canvas's worker pre-builds the buffer, so canvas has only `rpcProps`.

Splitting refetch from re-upload removes wasted RPC roundtrips. A wiggle color
change re-encodes the per-instance buffer but the worker output is unchanged;
so it re-uploads without refetching. A `bicolorPivot` change *does* change
worker output — that flows through `rpcProps` → refetch.

HiC and LD don't iterate visible regions — they fetch one global payload
per viewport. They expose a `performXxxFetch()` action containing the
RPC body wrapped in `withFetchLifecycle`; an `afterAttach.ts` autorun
calls it on viewport / `rpcProps` changes, and `reload()` calls it
directly. There is no `fetchGeneration` retrigger — the autorun re-fires
on natural observable changes, and explicit reload uses the action path.

Multi-sample variants follows the same single-action pattern.

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

**Context loss / device loss recovery:** `useGpuRenderer` listens to
`webglcontextlost`/`restored` (WebGL) and `device.lost` (WebGPU), bumps
`contextVersion` → disposes old backend → re-inits. On `pagehide`, disposes
immediately (Chrome caps 16 live contexts).

**Tab visibility:** hidden tabs discard WebGPU swap-chain textures.
`useTabVisibilityRerender` listens to `visibilitychange` and calls
`requestAnimationFrame(() => model.renderNow())`. (RAF is required — calling
`getCurrentTexture()` directly from the handler can return a detached texture
in WebGPU.) Tracked: move into HAL so React doesn't see the concern
(`PRD.md` §3 P5).

---

## Shaders (Slang codegen)

All production draw shaders are authored as `.slang` files, compiled to
WGSL (WebGPU) and GLSL ES 3.00 (WebGL2) by `scripts/build-shaders.ts`. See
ADR-005.

**Layout:** `plugins/<plugin>/src/<display>/shaders/<name>.slang`. Shared
modules (`hpmath.slang`, `colorPack.slang`) live in
`packages/core/src/gpu/shaders/`. The codegen emits
`<name>.generated.ts` with `WGSL_SOURCE`, `GLSL_VERTEX`, `GLSL_FRAGMENT`,
`GL_ATTRIBUTES`, `INSTANCE_STRIDE_BYTES`, `UNIFORM_OFFSET_F32`, and (for
textures) `TEXTURES`.

**Renderer wire-up:** `slangPass()` (in `packages/core/src/gpu/slangPass.ts`)
builds a `PassDescriptor` from the generated module. Supports `topology`,
`blendState`, `textures`, `picking`, and buffer-sharing overrides.

**Remaining non-Slang shaders:** compute shaders in
`plugins/variants/src/VariantRPC/ldComputeShader.ts` and
`ldPhasedComputeShader.ts` (WebGPU-only, still hand-written WGSL — they can
migrate, not urgent).

**Authoring conventions** and gotchas: see ADR-005.

---

## BP precision (high-precision coordinates)

Genomic positions can exceed 3×10⁹ (T2T assemblies). 32-bit float has ~7
decimal digits — insufficient at chromosome scale. All GPU renderers split
each BP position into hi/lo:

```
position_bp = hi + lo
```

`blockClipUtils.clipBlock` computes `[bpStartHi, bpStartLo]` for the visible
window; `hp_to_clip_x` in `hpmath.slang` reconstructs precision at draw time.
A `zero` uniform (always `0.0` at runtime) prevents the compiler collapsing
the subtraction into single precision.

---

## Uniforms & canvas scaling

Shader uniforms use **CSS pixels**. The HAL sets the canvas backing store to
`css × dpr`, so `N / canvas_width` in clip space equals `N` CSS pixels at any
DPR. **Do not manually scale by `devicePixelRatio`.**

---

## `regionNumber`

Zero-based index into `view.displayedRegions` — the user's configured region
list. Stable unless regions are added, removed, or reordered. **Not** an
index into `dynamicBlocks.contentBlocks`. One displayedRegion can produce
multiple render blocks sharing one GPU buffer, drawn with different scissor
clips.

Join key across `model.rpcDataMap`, `hal.uploadBuffer(regionNumber, passId,
...)`, `RenderBlock.regionNumber`. In multi-LGV displays (dotplot, synteny)
the buffer key becomes a tuple of two displayedRegion indices — those plugins
use composite keys.

Pending rename to `displayedRegionIndex` (~550 sites, 73 files). Last step of
the migration cleanup (`PRD.md` §3 P5).

---

## Backend interfaces per plugin

Each plugin defines a Backend interface (one of the three families above)
and a renderer factory:

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

`initDualBackend` calls `createGpuHal`; if it returns a HAL, the GPU backend
is constructed. Otherwise Canvas 2D is used.

Each plugin re-exports `RenderBlock` under its own alias
(`WiggleRenderBlock`, `FeatureRenderBlock`, `VariantRenderBlock`,
`RenderBlock`) — all structurally identical.

---

## Adding a new GPU display type

1. **Define types** — `MyData`, `MyRenderState`, and `MyBackend` (one of the
   three families).
2. **Shader** — author `my.slang` in the plugin's `shaders/` dir. `pnpm
   gen:shaders` emits `my.generated.ts`.
3. **GPU renderer + Canvas2D renderer + factory** — `initDualBackend<MyBackend>`
   from `packages/core/src/gpu/createDualRenderer.ts`. Use `slangPass()` to
   build the `PassDescriptor`.
4. **MST model:**
   - Compose `MultiRegionDisplayMixin()` (LGV-family) — brings the GPU slot
     mixin in. Non-region displays compose `GpuBackendLifecycleSlotMixin()`
     directly.
   - Add cached `renderState` view (override `renderBlocks` only if you need
     plugin-specific gating).
   - Add `startGpuBackendLifecycle(backend)` action calling
     `self.startMultiRegionGpuLifecycle({...})` or
     `self.startSingleDataGpuLifecycle({...})`.
   - Per-region setters must produce fresh value objects — never mutate.
   - Expose `rpcProps` (refetch source of truth); add `gpuProps()` only if
     the main thread encodes GPU buffers from settings.
5. **React component** — `observer()`:
   ```tsx
   const { canvasRef, error, retry } = useGpuModelLifecycle(MyRenderer, model)
   return <>{error && <ErrorBar action={retry} …/>}<canvas ref={canvasRef}/></>
   ```
   The hook composes `useGpuRenderer` + `useTabVisibilityRerender` and wires
   `onReady` / `onDispose` to `model.startGpuBackendLifecycle` /
   `stopGpuBackendLifecycle`. `model` is duck-typed to the slot mixin's
   contract (`start/stop/renderNow`).
6. **Tests** — unit (`MockHal`), browser (Puppeteer, `--backend=webgl|webgpu|canvas2d`).

---

## What NOT to do

- Don't put upload/render logic in React `useEffect` / `useLayoutEffect`. It
  belongs in the MST autorun.
- Don't add `dataVersion` reads at plugin level. The new util doesn't need
  them; `dataVersion` exists on `MultiRegionDisplayMixin` only as a debug
  counter.
- Don't destructure model methods
  (`const { startGpuBackendLifecycle } = model`). Call on the model.
- Don't use `useMemo` to derive observable-dependent values. Use a cached MST
  view.
- Don't mutate per-region values in place. Produce a fresh object.
- Don't call `startGpuBackendAutorunLifecycle` /
  `startGpuSingleDataBackendAutorunLifecycle` directly — go through the
  mixin wrappers (`self.startMultiRegionGpuLifecycle` /
  `self.startSingleDataGpuLifecycle`).
- Don't redefine `canvasDrawn` / `setCanvasDrawn` on a plugin model. The
  slot mixin owns them.
- Don't fold upload and render autoruns back together. The split is load-bearing.
- Don't hand-maintain WGSL/GLSL/offset tables alongside generated modules —
  consume the generated constants.

---

## Historical notes

**Pre-migration** (before Q2 2026): every display's React component inlined
`useEffect(() => autorun(…), [])` with `lastDataMap` / `lastUploaded` refs,
`dataVersion` counters, and `uploadChangedRegions` / `pruneRegions` calls.
Subtle invariants (`dataVersion` vs. map identity; `useLayoutEffect` vs.
`autorun`) had already drifted across eight copy-pasted call sites. The
MST-driven autorun refactor concentrated the tricky correctness into the
tested utility. See `completed/COMPLETED.md` and
`completed/mst-autorun-migration.md` for the migration archive.

**Shader history:** shaders were hand-written WGSL + GLSL pairs with
`// SYNC:` comments for struct offsets. All four canvas-feature shaders, then
wiggle, dotplot, hic, variant-matrix, ld, multi-variant, synteny, multi-synteny,
and alignments (~15 shaders) migrated to Slang authoring. `packages/alignments-core`'s
`hpWgsl.ts` / `hpGlsl.ts` string templates were replaced by `import hpmath;`.
ADR-005 records the rationale.
