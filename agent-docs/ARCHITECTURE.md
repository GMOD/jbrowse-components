# GPU Rendering Architecture

Reference for GPU rendering system (canvas, wiggle, alignments, variants, HiC,
LD, synteny, dotplot). For display developers adding new types or modifying
existing ones.

**Updated:** 2026-04-14 — reflects actual implementation with error handling,
context loss recovery, and both upload/render patterns.

---

## Layers at a glance

```
RPC worker returns data
    │
    ▼ model.setLoadedRegionForRegion(regionNumber, data)
    │ increments dataVersion
MobX model (rpcDataMap)
    │
    ├─ useGpuRenderer hook
    │  ├─ Async initialization: factory(canvas)
    │  ├─ Error handling + retry UI
    │  └─ Context loss recovery (WebGL) / device loss recovery (WebGPU)
    │
    ▼ returns renderer once ready
Backend interface (uploadRegion / pruneRegions / renderBlocks / dispose)
    │
    ├── GpuXxxRenderer  ──►  GpuHal  ──►  WebGPU or WebGL2
    └── Canvas2DXxxRenderer  ──►  CanvasRenderingContext2D
```

Each display plugin provides one concrete pair (GPU + Canvas2D). The display
component talks only to the Backend interface; it never knows which path was
chosen.

**Renderer selection** (query parameter `?renderer=`):

- `webgpu` — force WebGPU
- `webgl` — force WebGL2
- `canvas2d` or `canvas` — force Canvas2D fallback
- (omitted) — auto-detect: try WebGPU → WebGL2 → Canvas2D

**Note:** The browser test helper (`helpers.ts`) appends `?gpu=` instead of
`?renderer=`, but the code checks for `?renderer=`. There's a pending issue to
verify/sync this parameter name (see TODO.md).

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

### Initialization: createGpuHal + useGpuRenderer

The Hardware Abstraction Layer hides the WebGPU/WebGL2 API difference:

```ts
// packages/core/src/gpu/hal/createHal.ts
async function createGpuHal(
  canvas: HTMLCanvasElement,
  passes: PassDescriptor[],
  uniformByteSize: number,
): Promise<GpuHal | null>
  → if renderer=canvas2d or renderer=canvas: return null
  → if not renderer=webgl: try WebGPU (requestAdapter) → WebGPUHal
  → fallback to WebGL2 (getContext('webgl2')) → WebGL2Hal
  → if both fail: return null (Canvas2D fallback used by initDualBackend)
```

The `useGpuRenderer` hook manages the full lifecycle:

```ts
export function useGpuRenderer<R extends { dispose(): void }>(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  factory: (canvas: HTMLCanvasElement) => Promise<R>,  // e.g., WiggleRenderer
  opts?: { onReady?: (r: R) => void; onDispose?: () => void }
)
  → async: calls factory(canvas) and awaits Promise<R>
  → success: sets ready=true, returns { ready, rendererRef, error, retry }
  → error: sets error state with retry() function to reinitialize
  → context loss (WebGL): addEventListener('webglcontextlost'/restored) → bumps contextVersion → re-runs effect
  → device loss (WebGPU): onDeviceLost listener → bumps contextVersion → re-runs effect
  → canvas replaced (e.g., regionTooLarge unmount/remount): bumps contextVersion
  → page hidden (hard navigation): 'pagehide' listener calls backend.dispose()
```

**GpuHal key methods:**

- `uploadBuffer(regionKey, passId, data, count)` — write instance data for a
  region/pass
- `drawPass(passId, regionKey, bufferPassId?)` — emit draw call; `bufferPassId`
  lets a picking pass reuse another pass's buffer
- `writeUniforms(data)` — write the uniform block for the next draw
- `setScissor / setViewport` — restrict drawing to the current block's pixels
- `setRegionMeta / getRegionMeta` — store per-region metadata (regionStart,
  maxDepth) retrieved by GPU renderers at draw time
- `dispose()` — cleanup GPU resources (buffers, textures, context)

**Implementations:**

- `WebGPUHal` — 4× MSAA, storage buffers, device lost recovery
- `WebGL2Hal` — `antialias: true`, VAO + UBO, context loss recovery
- `MockHal` (tests) — no-op rendering for unit tests

Picking passes skip MSAA in both backends for accurate color-based picking.

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

Two patterns; canvas uses `useLayoutEffect([..., rpcDataMap])` to sync WebGL
with DOM labels before paint. Wiggle/etc. use
`autorun(() => { ... model.dataVersion })` to decouple upload from render and
ensure fully-committed data even when map reference doesn't change. Both wrap
render functions with `useEffectEvent` to avoid dependency explosion.

---

## Error Handling & Recovery

`useGpuRenderer` hook manages initialization, context loss recovery, and
cleanup:

- **WebGL context loss** (`webglcontextlost`/`webglcontextrestored` events):
  bump `contextVersion` → dispose old backend → re-init
- **WebGPU device loss** (`device.lost` promise): notify via `onDeviceLost()`
  listeners → same recovery flow
- **Init failure** (factory rejects): set `error` state → display ErrorBar with
  `retry()` button → bump `contextVersion` to reinit
- **Page unload** (`pagehide` event): call `dispose()` immediately to free GPU
  contexts before JS context destroyed (Chrome caps 16 contexts)

---

## Tab Visibility & WebGPU Texture Quirks

When a tab is hidden, swap-chain textures are discarded; returning shows a black
canvas. `useTabVisibilityRerender` listens to `visibilitychange` and calls
`requestAnimationFrame(() => renderFn())` to refresh (RAF is needed because
calling `getCurrentTexture()` directly from the handler can return a detached
texture in WebGPU, hanging the GPU timeline).

---

## regionNumber (a.k.a. displayedRegionIndex)

`regionNumber` is the zero-based index into `view.displayedRegions` — the user's
configured region list (e.g. `[chr1, chr2, chr3]` → indices `0, 1, 2`). It is
stable as long as the user doesn't add, remove, or reorder regions in the view
config. A clearer name would be `displayedRegionIndex`; the codebase uses
`regionNumber` for legacy reasons.

It is **not** an index into `dynamicBlocks.contentBlocks`. Each contentBlock
carries `regionNumber` as a back-reference to which displayedRegion produced it.
A single displayedRegion can produce multiple contentBlocks (and therefore
multiple RenderBlocks) — for example when one region appears in multiple
on-screen segments. Those multiple blocks all share **one** GPU buffer, keyed by
their common `regionNumber`, and are drawn with different scissor clips.

It serves as the join key across:

- `model.rpcDataMap: Map<number, T>` — RPC results, one entry per
  displayedRegion
- `hal.uploadBuffer(regionNumber, passId, ...)` — GPU buffer storage
- `RenderBlock.regionNumber` — which buffer this on-screen block draws from

Shaders have no knowledge of regions; they just receive one uniform block per
draw call and draw from whatever buffer `regionNumber` selects.

**Conceptually, `regionNumber` is doing three jobs that happen to collapse to
the same integer in single-LGV displays:**

1. _Fetch key_ — which RPC result this is.
2. _GPU buffer key_ — which backend buffer holds this region's uploaded data.
3. _Render-block back-reference_ — which buffer an on-screen segment draws from.

In multi-LGV displays (dotplot, synteny across two views) the buffer key becomes
a tuple of two displayedRegion indices, which is why those plugins invented
their own `regionKey`/composite-key concept rather than reusing `regionNumber`
directly.

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

## Shader structure & WGSL ↔ GLSL sync

Each plugin maintains three closely-synced files:

1. **wiggleShader.ts** (WGSL for WebGPU)

   ```ts
   export const UNIFORM_SIZE = 64 // SYNC: must match byte size in WGSL struct
   export const INSTANCE_STRIDE = 8 // SYNC: sizeof(Instance)/4 in WGSL
   export const VERTICES_PER_INSTANCE = 6 // SYNC: in WGSL

   export const wiggleShader = /* wgsl */ `
     struct Instance {
       start_end: vec2u,
       score: f32,
       prev_score: f32,
       color: vec3f,  // offset 16
       row_index: f32,
     }
     struct Uniforms {
       bp_range_x: vec3f,  // offset 0
       region_start: u32,   // offset 12
       canvas_height: f32,  // offset 16
       // ... more fields, total 64 bytes
     }
   `
   ```

2. **wiggleGlslShaders.ts** (GLSL for WebGL2)
   - Hand-written GLSL that mirrors WGSL struct definitions
   - Vertex and fragment shaders in separate exports
   - Must match WGSL byte offsets and semantics exactly

3. **GpuWiggleRenderer.ts** (TypeScript setup)

   ```ts
   export const WIGGLE_PASSES: PassDescriptor[] = [
     {
       id: PASS_FILL,
       wgslSource: wiggleShader,
       glslVertex: WIGGLE_VERTEX_SHADER_GLSL,
       glslFragment: WIGGLE_FRAGMENT_SHADER_GLSL,
       instanceStride: INSTANCE_BYTES, // 32 bytes
       verticesPerInstance: VERTICES_PER_INSTANCE, // 6
       glAttributes: [
         {
           name: 'a_start_end',
           components: 2,
           type: 'uint',
           offsetBytes: 0, // SYNC: match struct field offset
         },
         // ... more attributes matching struct layout
       ],
     },
   ]

   export const WIGGLE_UNIFORM_BYTE_SIZE = 64 // SYNC
   ```

**Sync requirements:**

- WGSL struct field offsets must match TypeScript `glAttributes` `offsetBytes`
- Struct byte size (accounting for alignment padding) must match `UNIFORM_SIZE`
- `instanceStride` must equal `sizeof(Instance)` in WGSL
- Constant values (`VERTICES_PER_INSTANCE`, rendering types, etc.) must be
  mirrored in both WGSL and GLSL with `// SYNC:` comments
- GLSL vertex and fragment logic must be semantically identical to WGSL

**Verification:**

- Byte offset errors cause vertex data corruption (features shift on-screen)
- Uniform size mismatch causes uniforms to be read at wrong offsets
- Constant mismatches cause rendering logic divergence between backends

---

## Uniforms & Canvas Scaling

Shader uniforms use **CSS pixels** for canvas dimensions:

```ts
// In renderBlocks(), before each draw call:
renderer.writeUniforms({
  canvas_width: view.trackWidthPx, // CSS pixels, NOT physical
  canvas_height: model.height, // CSS pixels, NOT physical
  bpPerPx: view.bpPerPx,
  // ... other uniforms
})

// Shader receives CSS pixels and uses them as-is:
// No manual devicePixelRatio scaling needed
```

The HAL handles the backing store setup:

```ts
// In WebGPUHal/WebGL2Hal:
const physicalWidth = (canvas.width = cssWidth * devicePixelRatio)
const physicalHeight = (canvas.height = cssHeight * devicePixelRatio)
// Viewport/scissor set to [0, 0, cssWidth, cssHeight] in clip space
```

This means a pixel at screen position `N` is always `N / canvas_width` in clip
space, regardless of DPR.

---

## Adding a new GPU display type

1. **Define types** — `MyData`, `MyRenderState`, `MyRenderBlock` (alias of
   `RenderBlock`)
2. **Define backend interface** —
   `MyBackend { uploadRegion, pruneRegions, renderBlocks, dispose }`

3. **Create shaders** — WGSL (`myShader.ts`) + GLSL (`myGlslShaders.ts`); keep
   `SYNC:` comments for struct offsets and constants matching WGSL
4. **Implement GPU renderer** — `GpuMyRenderer` class: pack instance data in
   `uploadRegion()`, use `clipBlock()` to get scissor/viewport, write uniforms,
   call `hal.drawPass()` in `renderBlocks()`
5. **Implement Canvas2D renderer** — `Canvas2DMyRenderer` class: cache data in
   `uploadRegion()`, use `bpToScreenX()` for coordinate conversion in
   `renderBlocks()`
6. **Create renderer factory** — call
   `initDualBackend<MyBackend>(canvas, MY_PASSES, MY_UNIFORM_BYTE_SIZE, hal => new GpuMyRenderer(hal), c => new Canvas2DMyRenderer(c))`
7. **Create display component** — `observer()` +
   `useGpuRenderer(canvasRef, MyRenderer)`, use autorun + `dataVersion` pattern
   (or useLayoutEffect for canvas), call `useTabVisibilityRerender(renderNow)`,
   show ErrorBar on error
8. **Define MST model** — `rpcDataMap: Map<number, MyData>`, `dataVersion: 0`,
   action that spreads map and increments dataVersion
9. **Test** — Jest unit tests with `MockHal`, Puppeteer tests:
   `node browser-tests/runner.ts --backend=webgl|webgpu|canvas2d`

---

### Shader file structure (for reference)

```ts
// myShader.ts (WGSL for WebGPU)
export const UNIFORM_SIZE = 64 // SYNC: byte size of Uniforms struct
export const INSTANCE_STRIDE = 4 // SYNC: sizeof(Instance)/4 in WGSL
export const VERTICES_PER_INSTANCE = 6

export const myShader = /* wgsl */ `
  struct Instance {
    start_end: vec2u,  // offset 0
    score: f32,        // offset 8
  }
  
  struct Uniforms {
    bp_range: vec3f,      // offset 0
    domain_y: vec2f,      // offset 12
    canvas_width: f32,    // offset 20
    canvas_height: f32,   // offset 24
    // ... padding to 64 bytes
  }
  
  fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f, zero: f32) -> f32 {
    // High-precision BP coordinate conversion (see Shader precision section)
    let step = 2.0 / bp_range.z
    let hi = max(split_pos.x - bp_range.x, -1.0/zero)
    let lo = max(split_pos.y - bp_range.y, -1.0/zero)
    return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step))
  }
  
  @vertex
  fn vs(...) -> ... { ... }
  
  @fragment
  fn fs(...) -> ... { ... }
`

// myGlslShaders.ts (GLSL for WebGL2 — must match WGSL exactly)
export const MY_VERTEX_SHADER_GLSL = /* glsl */ `
  precision highp float;
  in uvec2 a_start_end;
  in float a_score;
  uniform vec3 bp_range;
  // ... mirror WGSL struct layout and semantics
  void main() { ... }
`

export const MY_FRAGMENT_SHADER_GLSL = /* glsl */ `
  precision highp float;
  out vec4 outColor;
  void main() { ... }
`
```

### Step 4: GPU renderer

```ts
// myGpuRenderer.ts
import { clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_DEFAULT = 'default'

const MY_GL_ATTRIBUTES: GlAttributeLayout[] = [
  {
    name: 'a_start_end',
    components: 2,
    type: 'uint',
    offsetBytes: 0,
    integer: true,
  },
  {
    name: 'a_score',
    components: 1,
    type: 'float',
    offsetBytes: 8,
    integer: false,
  },
]

export const MY_PASSES: PassDescriptor[] = [
  {
    id: PASS_DEFAULT,
    wgslSource: myShader,
    glslVertex: MY_VERTEX_SHADER_GLSL,
    glslFragment: MY_FRAGMENT_SHADER_GLSL,
    instanceStride: INSTANCE_STRIDE * 4, // 16 bytes
    verticesPerInstance: VERTICES_PER_INSTANCE,
    blend: true,
    glAttributes: MY_GL_ATTRIBUTES,
  },
]

export const MY_UNIFORM_BYTE_SIZE = UNIFORM_SIZE

export class GpuMyRenderer implements MyBackend {
  private hal: GpuHal
  private regionMap = new Map<number, MyData>()
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(regionNumber: number, data: MyData): void {
    this.regionMap.set(regionNumber, data)

    // Pack data into buffer (instance data)
    const instanceBuffer = new Uint32Array(
      data.features.length * INSTANCE_STRIDE,
    )
    for (let i = 0; i < data.features.length; i++) {
      const f = data.features[i]
      instanceBuffer[i * INSTANCE_STRIDE + 0] = f.start
      instanceBuffer[i * INSTANCE_STRIDE + 1] = f.end
      instanceBuffer[i * INSTANCE_STRIDE + 2] = f.score // as uint bits
    }

    this.hal.uploadBuffer(
      regionNumber,
      PASS_DEFAULT,
      instanceBuffer,
      data.features.length,
    )
  }

  pruneRegions(activeRegions: number[]): void {
    pruneRegionMap(this.regionMap, activeRegions, regionNumber => {
      // Optional: cleanup region-specific GPU resources if needed
    })
  }

  renderBlocks(blocks: MyRenderBlock[], state: MyRenderState): void {
    for (const block of blocks) {
      const clip = clipBlock(
        block,
        state.width,
        state.height,
        window.devicePixelRatio,
      )
      if (!clip) continue // off-screen

      // Write uniforms for this block
      this.uniformF32[0] = clip.bpStartHi
      this.uniformF32[1] = clip.bpStartLo
      this.uniformF32[2] = clip.clippedLengthBp
      this.uniformF32[3] = state.domain[0]
      this.uniformF32[4] = state.domain[1]
      this.uniformF32[5] = state.width
      this.uniformF32[6] = state.height
      this.hal.writeUniforms(this.uniformData)

      // Set scissor/viewport for this block
      this.hal.setScissor(clip.scissorX, 0, clip.scissorW, state.height)
      this.hal.setViewport(clip.scissorX, 0, clip.scissorW, state.height)

      // Draw
      this.hal.drawPass(PASS_DEFAULT, block.regionNumber)
    }
  }

  dispose(): void {
    this.regionMap.clear()
  }
}
```

### Step 5: Canvas2D renderer

```ts
// Canvas2DMyRenderer.ts
import {
  clipBlockForCanvas,
  bpToScreenX,
} from '@jbrowse/core/gpu/canvas2dUtils'

export class Canvas2DMyRenderer implements MyBackend {
  private ctx: CanvasRenderingContext2D
  private regionMap = new Map<number, MyData>()

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
  }

  uploadRegion(regionNumber: number, data: MyData): void {
    // For Canvas2D, just cache the data; no GPU upload needed
    this.regionMap.set(regionNumber, data)
  }

  pruneRegions(activeRegions: number[]): void {
    for (const key of this.regionMap.keys()) {
      if (!activeRegions.includes(key)) {
        this.regionMap.delete(key)
      }
    }
  }

  renderBlocks(blocks: MyRenderBlock[], state: MyRenderState): void {
    this.ctx.clearRect(0, 0, state.width, state.height)

    for (const block of blocks) {
      const clip = clipBlockForCanvas(block, state.width)
      const data = this.regionMap.get(block.regionNumber)
      if (!data) continue

      for (const feature of data.features) {
        const screenX = bpToScreenX(
          feature.start,
          block,
          clip.bpLength,
          clip.fullBlockWidth,
        )
        const screenW = Math.max(
          1,
          bpToScreenX(feature.end, block, clip.bpLength, clip.fullBlockWidth) -
            screenX,
        )
        const screenY =
          state.height *
          (1 -
            (feature.score - state.domain[0]) /
              (state.domain[1] - state.domain[0]))

        this.ctx.fillStyle = 'rgba(0, 100, 200, 0.7)'
        this.ctx.fillRect(screenX, screenY, screenW, 2)
      }
    }
  }

  dispose(): void {
    this.regionMap.clear()
  }
}
```

### Step 6: Renderer factory

```ts
// MyRenderer.ts
import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

export function MyRenderer(canvas: HTMLCanvasElement): Promise<MyBackend> {
  return initDualBackend<MyBackend>(
    canvas,
    MY_PASSES,
    MY_UNIFORM_BYTE_SIZE,
    hal => new GpuMyRenderer(hal),
    c => new Canvas2DMyRenderer(c),
  )
}
```

### Step 7: Display component

```ts
// MyDisplayComponent.tsx
import {
  useGpuRenderer,
  useTabVisibilityRerender,
  getContainingView,
} from '@jbrowse/core/util'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { uploadChangedRegions } from '@jbrowse/core/gpu/uploadChangedRegions'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

const MyDisplayComponent = observer(function MyDisplay({ model }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = getContainingView(model)

  const { error, ready, rendererRef, retry } = useGpuRenderer(
    canvasRef,
    MyRenderer,
  )

  const renderNow = useEffectEvent(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized) return

    const blocks = buildRenderBlocks(view.visibleRegions)
    renderer.renderBlocks(blocks, {
      bpPerPx: view.bpPerPx,
      width: view.trackWidthPx,
      height: model.height,
      domain: model.domain,
    })
  })

  // Use Pattern B (autorun + dataVersion) for this example
  useEffect(
    () =>
      autorun(() => {
        if (!ready) return

        const dataMap = model.rpcDataMap
        const activeRegions = uploadChangedRegions(
          dataMap,
          new Map(),  // or use ref for identity tracking
          (regionNumber, data) =>
            rendererRef.current?.uploadRegion(regionNumber, data),
        )
        rendererRef.current?.pruneRegions(activeRegions)

        const _dv = model.dataVersion  // create MobX dependency

        renderNow()
        if (dataMap.size > 0) {
          model.setCanvasDrawn(true)
        }
      }),
    [model, view, ready, rendererRef],
  )

  useTabVisibilityRerender(renderNow)

  return (
    <>
      {error && (
        <ErrorBar
          message="Renderer failed"
          action={() => retry()}
        />
      )}
      <canvas ref={canvasRef} />
    </>
  )
})

export default MyDisplayComponent
```

### Step 8: Model integration

```ts
// MyDisplayModel.ts
import { types } from 'mobx-state-tree'

export const MyDisplayModel = types
  .model('MyDisplay', {
    type: types.literal('MyDisplay'),
    rpcDataMap: types.frozen<Map<number, MyData>>(new Map()),
    dataVersion: 0,
    height: 100,
    domain: [0, 100],
  })
  .actions(self => ({
    setLoadedRegionForRegion(regionNumber: number, data: MyData) {
      const next = new Map(self.rpcDataMap)
      next.set(regionNumber, data)
      self.rpcDataMap = next
      self.dataVersion++
    },
  }))
```

### Step 9: Testing

**Unit tests** (Jest + MockHal):

```ts
// myGpuRenderer.test.ts
import { MockHal } from '@jbrowse/core/gpu/hal/mockHal'

test('GpuMyRenderer uploads instance data', () => {
  const hal = new MockHal()
  const renderer = new GpuMyRenderer(hal)
  const data: MyData = { regionNumber: 0, features: [...] }

  renderer.uploadRegion(0, data)

  expect(hal.uploadBuffer).toHaveBeenCalledWith(
    0,
    'default',
    expect.any(Uint32Array),
    expect.any(Number),
  )
})
```

**Browser tests** (Puppeteer):

```sh
# Test all backends (default, webgl, webgpu, canvas2d)
node --experimental-strip-types browser-tests/runner.ts

# Test only WebGL
node --experimental-strip-types browser-tests/runner.ts --backend=webgl

# Test only Canvas2D
node --experimental-strip-types browser-tests/runner.ts --backend=canvas2d

# Headed mode for debugging
node --experimental-strip-types browser-tests/runner.ts --headed

# Update golden snapshots
node --experimental-strip-types browser-tests/runner.ts --update-snapshots
```

The test runner passes the `--backend=` flag to the browser via `?renderer=`
query parameter. Visual regression via snapshot comparison (pixelmatch,
threshold 0.1%).

---

### Quick reference: High-precision BP Coordinates

All GPU renderers split genomic positions into hi/lo `vec2f`:

```wgsl
fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f, zero: f32) -> f32 {
  let inf = 1.0 / zero;  // zero MUST be 0.0 at runtime to prevent optimization
  let step = 2.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step));
}
```

**Why?** Genomic positions (0–3×10⁹ bp) exceed 32-bit float precision (~7
digits). Splitting into hi/lo preserves sub-pixel accuracy at chromosome scale.

**Uniforms passed to shader:**

- `bp_range_x.x` (hi) — integer part of region start
- `bp_range_x.y` (lo) — fractional part of region start
- `bp_range_x.z` — clipped BP length of visible window

---

### Browser Support Matrix

| Backend  | Chrome | Firefox | Safari | Requirements                                      |
| -------- | ------ | ------- | ------ | ------------------------------------------------- |
| WebGPU   | 113+   | Nightly | No     | Real GPU; on Linux needs Vulkan (Lavapipe for CI) |
| WebGL2   | 56+    | 51+     | 15+    | None (universally supported)                      |
| Canvas2D | All    | All     | All    | Fallback (always works)                           |

**Query parameter overrides** (`?renderer=`):

Pass one of these values to force a specific backend:

- `?renderer=webgpu` — force WebGPU (fails if unavailable)
- `?renderer=webgl` — force WebGL2 (fails if unavailable)
- `?renderer=canvas2d` or `?renderer=canvas` — force Canvas2D fallback
- (omitted) — auto-detect: try WebGPU → WebGL2 → Canvas2D

**Example:**

```
http://localhost:3000/?config=config.json&renderer=webgl
```

This forces the app to use WebGL2, skipping WebGPU detection.
