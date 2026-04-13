# GPU Rendering Architecture

This document describes the GPU rendering system used by the canvas, wiggle,
alignments, and variant display plugins. It is intended for anyone adding a new
display type or modifying an existing one.

---

## Layers at a glance

```
MobX model (rpcDataMap)
    │  uploadChangedRegions (per-region identity check)
    ▼
Backend interface (uploadRegion / pruneRegions / renderBlocks / dispose)
    │  initDualBackend picks at canvas creation time
    ├── GpuXxxRenderer  ──►  GpuHal  ──►  WebGPU or WebGL2
    └── Canvas2DXxxRenderer  ──►  CanvasRenderingContext2D
```

Each display plugin provides one concrete pair (GPU + Canvas2D). The display
component talks only to the Backend interface; it never knows which path was
chosen.

---

## packages/core/src/gpu — shared primitives

### RenderBlock (`renderBlock.ts`)

The unit of work for a single render call:

```ts
interface RenderBlock {
  regionNumber: number // index into the GPU buffer map
  bpRangeX: [number, number] // [start, end] in absolute genomic bp
  screenStartPx: number // left edge of this region on screen (CSS px)
  screenEndPx: number // right edge
  reversed: boolean // strand orientation
}
```

`buildRenderBlocks(view.visibleRegions)` converts LinearGenomeView's visible
region list to this format. All display types call it identically — no
plugin-specific logic needed.

### uploadChangedRegions (`uploadChangedRegions.ts`)

```ts
function uploadChangedRegions<T>(
  dataMap: Map<number, T>,
  cache: Map<number, T>,
  upload: (regionNumber: number, data: T) => void,
): number[]
```

Skips the GPU upload for any region whose data reference is the same object as
last time (identity comparison). Returns the active region numbers for the
caller to pass to `renderer.pruneRegions()`. The cache is mutated in-place;
stale entries (regions no longer in `dataMap`) are removed automatically.

**Every display type** uses this or an equivalent pattern. The one exception is
`uploadRegionDataToGPU` in the alignments plugin, which adds domain-specific
bookkeeping (tracking `maxY` across regions for pileup layout) while
implementing the same identity-check logic.

### pruneRegionMap (`pruneRegionMap.ts`)

```ts
function pruneRegionMap<T>(
  regionMap: Map<number, T>,
  activeRegionNumbers: number[],
  onRemove?: (regionNumber: number) => void,
): void
```

Removes map entries for regions no longer active. The `onRemove` callback lets
GPU backends free their buffer resources before the map entry is deleted.

### blockClipUtils (`blockClipUtils.ts`)

`clipBlock(block, canvasWidth, canvasHeight, dpr)` converts a RenderBlock's
screen coordinates into physical-pixel scissor/viewport rectangles and
high-precision BP range fields needed by the vertex shader. Returns `null` if
the block is entirely off-screen.

`writeBpRangeUniforms(uniformF32, clip, reversed)` writes the first three floats
of the uniform buffer: `[bpStartHi, bpStartLo, ±clippedLengthBp]`. Negative
length signals the shader to render right-to-left for reversed blocks.

The BP range is split into hi/lo components to avoid floating-point precision
loss at genome scale (positions up to ~3×10⁹ bp). The vertex shader's
`hp_to_clip_x` function reconstructs the full precision by summing the pair.

### canvas2dUtils (`canvas2dUtils.ts`)

Canvas2D renderers use a simpler block type:

```ts
interface Canvas2DRenderBlock {
  screenStartPx: number
  screenEndPx: number
  bpRangeX: [number, number]
  reversed?: boolean // optional — not all Canvas2D paths need it
}
```

`clipBlockForCanvas(block, canvasWidth)` clamps to canvas width and returns
`{ scissorX, scissorW, fullBlockWidth, bpLength }` — no DPR scaling or HP
arithmetic, since Canvas2D applies the DPR transform via `ctx.setTransform`.

`bpToScreenX(absBp, block, bpLength, fullBlockWidth)` converts an absolute
genomic position to a screen pixel, respecting `reversed`.

### GpuHal (`hal/`)

The Hardware Abstraction Layer hides the WebGPU/WebGL2 API difference:

```
createGpuHal(canvas, passes, uniformByteSize)
  → tries WebGPU (requestAdapter)
  → falls back to WebGL2 (getContext('webgl2'))
  → returns null if both fail
```

Key GpuHal methods:

- `uploadBuffer(regionKey, passId, data, count)` — write instance data for a
  region/pass
- `drawPass(passId, regionKey, bufferPassId?)` — emit draw call; `bufferPassId`
  lets a picking pass reuse another pass's buffer
- `writeUniforms(data)` — write the uniform block for the next draw
- `setScissor / setViewport` — restrict drawing to the current block's pixels
- `setRegionMeta / getRegionMeta` — store per-region metadata (regionStart,
  maxDepth) retrieved by GPU renderers at draw time

Two implementations: `WebGPUHal` and `WebGL2Hal`. Tests use `MockHal`.

WebGPU uses 4× MSAA and storage buffers. WebGL2 uses `antialias: true` and
VAO+UBO. Picking passes skip MSAA in both backends.

---

## Plugin-level Backend interfaces

Each plugin defines a Backend interface with this invariant shape:

```ts
interface XxxBackend {
  uploadRegion(regionNumber: number, data: XxxData): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(blocks: RenderBlock[], state: XxxRenderState): void
  dispose(): void
}
```

The `state` parameter carries per-frame uniforms (domain, scale type, canvas
dimensions, scroll offset, etc.) that do not change per-region.

Each plugin also defines a renderer factory:

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

`initDualBackend` calls `createGpuHal`; if it returns a HAL, the GPU backend is
constructed. Otherwise the Canvas2D backend is used. Display components call
`useGpuRenderer(canvasRef, XxxRenderer)` and get back a Backend through the
`rendererRef` ref.

### Plugin type aliases

Each plugin re-exports `RenderBlock` under its own alias for in-plugin clarity:

| Plugin     | Alias                | Source                                   |
| ---------- | -------------------- | ---------------------------------------- |
| wiggle     | `WiggleRenderBlock`  | `@jbrowse/core/gpu/renderBlock`          |
| canvas     | `FeatureRenderBlock` | `@jbrowse/core/gpu/renderBlock`          |
| variants   | `VariantRenderBlock` | `@jbrowse/core/gpu/renderBlock`          |
| alignments | `RenderBlock`        | `@jbrowse/core/gpu/renderBlock` (direct) |

These are type-only re-exports. Structurally they are all `RenderBlock`.

---

## Upload / render lifecycle

```
RPC worker returns data
  │
  └─► model.setLoadedRegionForRegion(regionNumber, data)
        writes rpcDataMap[regionNumber] = data
        increments dataVersion
              │
              ▼
        MobX autorun (in useEffect)
              │
              ├─ if rpcDataMap reference changed:
              │     uploadChangedRegions(rpcDataMap, cache, upload)
              │     renderer.pruneRegions(activeRegions)
              │
              ├─ reads model.dataVersion  (creates MobX dependency)
              │
              └─ renderNow()
                    renderer.renderBlocks(
                      buildRenderBlocks(view.visibleRegions),
                      makeRenderState(...model properties...),
                    )
```

**Why read `dataVersion` explicitly?**  
`rpcDataMap` gets a new `Map` reference on every `setRpcData` call (shallow
copy), so the outer `lastDataMap !== dataMap` guard fires for any region update.
But `uploadChangedRegions` only uploads the regions that actually changed.
Reading `dataVersion` creates a separate MobX dependency that fires after the
final `setLoadedRegionForRegion` call completes, ensuring `renderNow` runs with
fully-committed data even if the map reference didn't change.

**Canvas plugin exception**  
`FeatureComponent` uses `useLayoutEffect([..., rpcDataMap])` instead of autorun.
The observer re-renders when `rpcDataMap` changes reference (which always
happens on data commit), which fires the layout effect and uploads/renders.
`dataVersion` is not needed because the map reference is the sole trigger.
`useLayoutEffect` (vs `useEffect`) keeps the WebGL canvas in sync with the DOM
label overlay computed during the same render cycle.

---

## regionNumber

`regionNumber` is the zero-based index of a genomic region in the view's
`dynamicBlocks.contentBlocks` array. It is stable for a given view state.

It serves as the join key across:

- `model.rpcDataMap: Map<number, T>` — data from the RPC worker
- `hal.uploadBuffer(regionNumber, passId, ...)` — GPU buffer storage
- `RenderBlock.regionNumber` — which buffer to draw in `renderBlocks`

Multi-region views (e.g. showing chr1 and chr2 simultaneously) produce multiple
RenderBlocks, each referencing a different `regionNumber`. Shaders have no
knowledge of regions; they just receive one uniform block and draw from whatever
buffer `regionNumber` indexes.

---

## Shader precision: high-precision BP coordinates

Genomic positions can exceed 3×10⁹ (human chromosome 1 is ~249 Mbp; T2T
assemblies go higher). A 32-bit float has ~7 decimal digits of precision, which
is insufficient for sub-pixel accuracy at chromosome scale.

All GPU renderers split each BP position into a hi/lo `vec2f`:

```
position_bp = hi + lo   (where hi captures the integer part, lo the fraction)
```

`blockClipUtils.clipBlock` computes `[bpStartHi, bpStartLo]` for the visible
window. The vertex shader's `hp_to_clip_x` function reconstructs full precision
at draw time.

A `zero` uniform (always set to `0.0` at runtime) prevents the compiler from
optimizing the subtraction into a single-precision operation.

---

## Shader sync (WGSL ↔ GLSL)

Each plugin maintains two shader files:

- `*Shader.ts` (WGSL for WebGPU)
- `*GlslShaders.ts` (GLSL for WebGL2)

They must be kept in sync manually. The `compile-shader-utils` script
(referenced in `CLAUDE.md`) recompiles GLSL from WGSL when a shader changes. The
uniform struct layout and byte offsets must match `*Renderer.ts` exactly.

Canvas uniforms are CSS pixels (`canvas_width`, `canvas_height`). The HAL
manages the `css * dpr` backing store, so shaders do NOT scale by
`devicePixelRatio`.

---

## Adding a new GPU display type

1. Define `MyData` (RPC result type) and `MyRenderState` (per-frame uniforms).
2. Write `MyBackend` interface with the four standard methods.
3. Write `GpuMyRenderer` (implements `MyBackend` using a `GpuHal`).
4. Write `Canvas2DMyRenderer` (implements `MyBackend` using Canvas2D).
5. Write `MyRenderer(canvas)` factory calling `initDualBackend`.
6. In the display component:
   - `useGpuRenderer(canvasRef, MyRenderer)` to get `rendererRef`.
   - `useEffect(() => autorun(() => { ... }), [model, view, ready, rendererRef])`:
     - Watch `model.rpcDataMap`; call `uploadChangedRegions` + `pruneRegions`.
     - Read `model.dataVersion` to create the sync dependency.
     - Call `renderNow()`.
   - `renderNow` calls
     `renderer.renderBlocks(buildRenderBlocks(view.visibleRegions), state)`.
   - `useTabVisibilityRerender(renderNow)` for tab visibility re-renders.
7. Make the model multi-region: use `Map<number, MyData>` for `rpcDataMap`, not
   a single `MyData`. Single-region displays are a degenerate case (HiC and LD
   are pending migration to the multi-region pattern).
