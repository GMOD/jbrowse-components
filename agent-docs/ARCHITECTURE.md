# Architecture

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally for
all genomic features and regions. This matches BED/BAM convention. Adapters
that read 1-based formats (VCF `POS`, GFF `start`) subtract 1 on ingest;
exporters that write 1-based formats add 1 on output.

---

# GPU Rendering Architecture

Canonical reference for the GPU rendering lifecycle across all display types.
Read `PRD.md` first for invariants and active priorities.


## Glossary

- HAL - hardware abstraction layer, used for abstracting WebGL and WebGPU calls. This is architecture we created.

---

## One-liner

Each GPU display is an MST model that composes `GpuBackendLifecycleSlotMixin`
and calls `self.installGpuDisplay(backend, { upload, render })` in its
`startGpuBackendLifecycle(backend)` action. The mixin spawns two autoruns
tied to the model's lifetime — one that runs `upload(backend)`, one that
runs `render(backend)`. Every observable read inside a callback is
auto-tracked by MobX, so changes re-fire the right autorun with no manual
dependency declarations. React components are thin bridges: create a
canvas, hand the backend to the model via `useGpuModelLifecycle`, render
JSX.

---

## The API

```ts
interface Backend {
  // plugin-defined upload/render methods
  dispose(): void
}

// In the plugin's MST model:
startGpuBackendLifecycle(backend: Backend) {
  self.installGpuDisplay<Backend>(backend, {
    upload: b => {
      // Read plugin observables, push bytes to the GPU.
      // Re-fires on any observable change.
    },
    render: b => {
      const state = self.renderState
      if (!state) return false       // skip this tick; canvas not drawn
      b.renderBlocks(self.renderBlocks, state)
      return true                     // drew; mixin sets canvasDrawn
    },
  })
}
```


---

## What the mixin owns

```
GpuBackendLifecycleSlotMixin
  .volatile
    canvasDrawn: boolean          read by loading overlays
    currentGpuBackend: unknown    stored backend; autoruns read it each tick
    renderBump: number            bumped by renderNow() and after every upload
    gpuAutorunsInstalled: boolean guards installGpuDisplay (idempotent)
  .actions
    markCanvasDrawn()             idempotent flip
    stopGpuBackendLifecycle()     clears currentGpuBackend → autoruns idle
    renderNow()                   bumps renderBump → render autorun re-fires
    installGpuDisplay(b, cbs)     spawns upload + render autoruns (once)
```

All backend-specific plumbing lives in the plugin. All reactivity plumbing
lives in the mixin.

---

## Life of a frame

1. React hook (`useGpuModelLifecycle`) mounts, creates the HAL, resolves
   a backend, calls `model.startGpuBackendLifecycle(backend)`.
2. Plugin's action calls `self.installGpuDisplay(backend, cbs)`.
3. Mixin sets `currentGpuBackend = backend`, spawns two autoruns via
   `addDisposer(self, autorun(...))`.
4. Upload autorun fires: reads `currentGpuBackend`, calls `cbs.upload(b)`,
   bumps `renderBump` so render re-fires after any upload.
5. Render autorun fires: reads `currentGpuBackend` + `renderBump`, calls
   `cbs.render(b)`. If it returns anything but `false`, flips
   `canvasDrawn` to `true`.
6. Any observable touched by `upload` or `render` becomes a dep — when it
   changes, MobX re-fires that autorun. No manual invalidation.

### Context-loss recovery

Chrome discards WebGL/WebGPU contexts. `useGpuRenderer` listens for
`webglcontextlost`/`restored` and `device.lost`, rebuilds the backend,
and calls `model.startGpuBackendLifecycle(newBackend)` again. The mixin
sees `gpuAutorunsInstalled === true`, skips re-installation, just
reassigns `currentGpuBackend`. Both autoruns re-fire against the new
backend, upload re-uploads everything, render redraws. No special code
path.

### Tab visibility

`useTabVisibilityRerender` calls `model.renderNow()` on
`visibilitychange`. The mixin's `renderNow` bumps `renderBump`. Render
autorun re-fires. WebGPU swap-chain textures are reissued by the `render`
callback.

---

## Backend interfaces per plugin

Each plugin defines its own `Backend` interface — the shape of the upload
and render methods varies by what the plugin draws — and a factory that
produces either a GPU or Canvas 2D implementation:

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

`initDualBackend` calls `createGpuHal`; if a HAL is returned, the GPU
backend is constructed, otherwise Canvas 2D.

---

## `rpcProps` / `gpuProps` pattern

Domain-named getters that enumerate **what affects rendering output**.

| Getter             | Consumer                                                                 | Invalidation route                                                                          |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `rpcProps`         | `rpcManager.call(..., { ...self.rpcProps, ... })` — RPC payload          | Mixin `SettingsInvalidate` autorun reads `void self.rpcProps` → `clearAllRpcData` → refetch |
| `gpuProps()`       | `buildSourceRenderData(data, self.gpuProps())` — encoder input           | Upload callback reads it — MobX re-uploads without an RPC roundtrip                         |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap`                 | Upload autorun reads it — MobX re-uploads without an RPC roundtrip                          |
| `renderState`      | `backend.render(state)` per frame                                        | Render callback reads it — re-fires when deps shift                                         |

`gpuProps` exists only where the main thread encodes the GPU buffer
(wiggle, multi-wiggle). Canvas's worker pre-builds the buffer, so canvas
has only `rpcProps`. Splitting refetch from re-upload avoids wasted RPC
roundtrips: wiggle color change → re-encode only. `bicolorPivot` change →
worker output differs → `rpcProps` → refetch.

Derived region maps apply when upload needs *whole fresh per-region
payloads*, not just extra encoder parameters. Alignments' `laidOutPileupMap`
returns shallow clones of `rpcDataMap` entries with freshly-allocated Y
arrays from main-thread pileup/chain layout (+ connecting-line / Flatbush
in chain mode). Upload iterates the derived map; sort or chain-mode changes
invalidate the getter and re-fire upload. Raw `rpcDataMap` is never
mutated, honoring the freshly-constructed-values invariant in `PRD.md`.
Use this when settings change the shape/contents of per-region data; use
`gpuProps` for scalars fed to an encoder.

---

## Per-region zoom-staleness

Most worker output is BP offsets from `regionStart` — no pixel
coordinates cross the worker boundary, so data stays valid under zoom.
Two exceptions:

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based
  on `bpPerPx / resolution`. `isCacheValid` uses strict equality
  (`view.bpPerPx === loadedBpPerPx`) — any zoom change refetches every
  visible region together so they stay at the same zoom level. See
  `architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md`.
- **Canvas**: the amino-acid overlay is the only `bpPerPx`-dependent
  worker decision. `isCacheValid` refetches only when the viewport
  crosses `shouldRenderPeptideBackground`'s discrete threshold.

All other plugins leave the default `() => true` — worker output is
genomic-coord and zoom-agnostic.

`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the
override per region and refetches stale ones.

---

## HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/core/src/gpu/hal/`.

```
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  ?renderer=canvas2d     → return null
  else                   → try WebGPU → fallback WebGL2 → fallback null
```

**Key methods:** `uploadBuffer(regionKey, passId, data, count)`,
`drawPass(passId, regionKey, bufferPassId?)`, `writeUniforms(data)`,
`setScissor`, `setViewport`, `setRegionMeta` / `getRegionMeta`, `dispose()`.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery),
`WebGL2Hal` (`antialias: true`, VAO + UBO, context-loss recovery),
`MockHal` (tests).

**Backend override** (query param `?renderer=`): `webgpu` / `webgl` /
`canvas2d` / `canvas`; omitted → auto-detect WebGPU → WebGL2 → Canvas 2D.

---

## Shaders (Slang codegen)

Production draw shaders are authored as `.slang`, compiled to WGSL
(WebGPU) and GLSL ES 3.00 (WebGL2) by `scripts/build-shaders.ts`. See
ADR-005.

**Layout:** display-specific shaders live in
`plugins/<plugin>/src/<display>/shaders/<name>.slang`; per-plugin shared
in `plugins/<plugin>/src/shared/shaders/`; cross-plugin modules
(`hpmath.slang`, `colorPack.slang`) in
`packages/core/src/gpu/shaders/`. Codegen emits `<name>.generated.ts`.

**Wire-up:** `slangPass()` turns a generated module into a
`PassDescriptor`, with overrides for `topology`, `blendState`, `textures`,
`picking`, and buffer sharing.

Authoring conventions and gotchas: ADR-005.

---

## BP precision

Genomic positions exceed 3×10⁹ on T2T assemblies; 32-bit float's ~7
decimal digits are insufficient at chromosome scale. GPU renderers split
each BP position into hi/lo halves: `position_bp = hi + lo`.
`blockClipUtils.clipBlock` emits `[bpStartHi, bpStartLo]` for the visible
window; `hp_to_clip_x` in `hpmath.slang` reconstructs precision at draw
time.

---

## Coverage segment coordinate convention

Most `PileupDataResult` position arrays (reads, gaps, mismatches,
interbase) store **regionStart-relative** uint32 offsets so that features
starting before `regionStart` can be represented without negative numbers
(uint32 wrapping), and so float32 GPU buffers stay precise (small offsets
have no rounding error).

Coverage segment arrays are different:

| Array | Format | Rationale |
|---|---|---|
| `snpPositions` | absolute uint32 | written as uint32 by Canvas2D packer; GPU subtracts `regionStart` |
| `noncovPositions` | absolute uint32 | same |
| `indicatorPositions` | absolute uint32 | same |
| `modCovPositions` | absolute uint32 | same |
| `coverageStartOffset` | relative (offset from `regionStart`) | used as depth-array index alongside other relative positions |

**Why absolute for segment arrays?** Canvas2D stores positions directly as
uint32 in packed buffers (no float32 cast). At positions > 16 Mbp a
float32 would lose integer precision (~8 bp error); uint32 is exact up to
4 Gbp (> T2T chromosome lengths). For Canvas2D no coordinate transform is
needed at pack time. The GPU pack path (`packCoverageAreaForGpu`) subtracts
`regionStart` before writing float32, maintaining the small-relative-value
precision used by shaders.

This convention is display-orientation-agnostic: `bpToX` and GPU shaders
handle reversed blocks via their own logic; absolute positions require no
special casing for reversed regions.

---

## Uniforms & canvas scaling

Shader uniforms use **CSS pixels**. The HAL sets the canvas backing store
to `css × dpr`, so `N / canvas_width` in clip space equals `N` CSS pixels
at any DPR. **Do not manually scale by `devicePixelRatio`.**

---

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions`. Stable unless regions are
added, removed, or reordered. **Not** an index into
`dynamicBlocks.contentBlocks` — one displayedRegion can produce multiple
render blocks that share one GPU buffer and draw with different scissor
clips.

The join key across `model.rpcDataMap`, `hal.uploadBuffer(regionKey, ...)`,
and `RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot,
synteny) key on a tuple of two displayedRegion indices.

---

## Adding a new GPU display type

- **Types** — `MyData`, `MyRenderState`, `MyBackend`.
- **Shader** — author `my.slang`; `pnpm gen:shaders` emits
  `my.generated.ts`.
- **Renderers + factory** — `initDualBackend<MyBackend>` from
  `packages/core/src/gpu/createDualRenderer.ts`, with a GPU and a
  Canvas2D implementation. Use `slangPass()` to build the
  `PassDescriptor`.
- **MST model:**
  - Compose `MultiRegionDisplayMixin()` for LGV-family displays (brings
    in `GpuBackendLifecycleSlotMixin`, `FetchMixin`, the fetch autorun,
    and the `rpcProps`→refetch wiring); non-region displays compose
    `GpuBackendLifecycleSlotMixin()` directly.
  - Add a cached `renderState` view.
  - Define `startGpuBackendLifecycle(backend)` that calls
    `self.installGpuDisplay(backend, { upload, render })`.
  - Expose `rpcProps` (refetch source of truth); add `gpuProps()` only
    when the main thread encodes GPU buffers from settings.
- **React component** — `observer()`:
  ```tsx
  const { canvasRef, error, retry } = useGpuModelLifecycle(MyRenderer, model)
  return <>{error && <ErrorBar action={retry} …/>}<canvas ref={canvasRef}/></>
  ```
- **Tests** — unit (`MockHal`); browser (Puppeteer,
  `--backend=webgl|webgpu|canvas2d`).

---

## What NOT to do

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` —
  it belongs in the MST autorun pair spawned by `installGpuDisplay`.
- Don't destructure model methods (`const { startGpuBackendLifecycle } =
  model`); call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST
  view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't add per-plugin `backend` / `renderBump` / install-flag volatiles
  — the slot mixin owns those.
- Don't redefine `canvasDrawn` / `markCanvasDrawn` / `renderNow` /
  `stopGpuBackendLifecycle` on a plugin model — the slot mixin owns
  them.
- Don't hand-maintain WGSL/GLSL/offset tables next to generated modules;
  consume the generated constants.
