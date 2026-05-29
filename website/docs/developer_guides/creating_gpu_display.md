---
title: Creating a GPU-accelerated display
description:
  Build a display that renders with WebGPU/WebGL2 and falls back to Canvas2D
guide_category: Creating pluggable elements
---

:::note This guide covers the GPU rendering path introduced in the WebGL/WebGPU
migration. If you only need Canvas2D rendering, the standard `createDisplay`
path is simpler. Use this guide when you need hardware- accelerated rendering
for large or dense datasets. :::

## Architecture overview

JBrowse GPU displays follow a three-layer model:

```
Worker (RPC)          Main thread (MST model)        GPU / Canvas
─────────────         ──────────────────────         ─────────────
executeRender()  →    rpcDataMap (per region)   →    upload autorun
                      laidOutDataMap (processed) →    render autorun → frame
                      renderState (frame uniforms)
```

The model keeps two autoruns running at all times (owned by
`GpuLifecycleMixin`):

- **Upload autorun** — fires when `laidOutDataMap` or the backend changes; calls
  `backend.uploadRegion()` for regions that changed.
- **Render autorun** — fires when `renderTick` bumps (after every upload) or
  when frame-level state like scroll position changes; calls
  `backend.renderBlocks()`.

The backend is a HAL (Hardware Abstraction Layer) that dispatches to WebGPU,
WebGL2, or Canvas2D at runtime. Your renderer code talks to the HAL — it never
calls WebGPU or WebGL2 directly.

See `agent-docs/ARCHITECTURE.md` for the full lifecycle spec and
`packages/core/src/gpu/CLAUDE.md` for HAL invariants.

The simplest concrete reference is `plugins/canvas/src/LinearBasicDisplay/` — a
generic feature display with four shader passes (rectangles, lines, chevrons,
arrows).

## Files to create

```
plugins/myplugin/src/LinearMyDisplay/
├── model.ts                         MST model: startBackend + renderState
├── components/
│   ├── MyComponent.tsx              React: useGpuBackend hook + <canvas>
│   ├── MyRendererFactory.ts         createBackend dispatch function
│   ├── GpuMyRenderer.ts             extends GpuPerRegionBackend
│   ├── Canvas2DMyRenderer.ts        extends Canvas2DPerRegionBackend
│   ├── myBackendTypes.ts            MyUploadData, MyRenderState types
│   └── shaders/
│       ├── myUniforms.slang         uniform struct (shared by all passes)
│       └── my.slang                 vertex + fragment for one pass
└── RenderMyDataRPC/
    ├── index.ts                     RPC registration
    └── executeRenderMyData.ts       worker: fetch + pack → MyUploadData
```

## Step 1: Define data types

```ts
// myBackendTypes.ts

// What the RPC worker returns per region
export interface MyUploadData {
  featureCount: number
  positionsF32: Float32Array // interleaved x, width per feature
  colorsU32: Uint32Array
}

// What the model computes fresh each frame (cheap, no fetch)
export interface MyRenderState {
  bpPerPx: number
  canvasWidth: number
  canvasHeight: number
  colorBy: string
}

export type MyBackend = PerRegionBackend<MyUploadData, MyRenderState>
```

## Step 2: Write the shaders

Create a `.slang` file — JBrowse uses a Slang-derived shader language that
compiles to both WGSL (WebGPU) and GLSL (WebGL2):

```slang
// shaders/my.slang
import "../../../../../../packages/core/src/gpu/shaders/hpmath"
import "./myUniforms"

struct InstanceInput {
  float bpStartHi;
  float bpStartLo;
  float bpWidth;
  uint  color;      // packed RGBA
}

[shader("vertex")]
float4 vertexMain(InstanceInput inst, uint vertexId: SV_VertexID) -> float4 {
  // Convert genomic bp position to clip space x
  float xPx = hpSub(inst.bpStartHi, inst.bpStartLo, uniforms.bpStartHi, uniforms.bpStartLo)
              / uniforms.bpPerPx;
  float widthPx = inst.bpWidth / uniforms.bpPerPx;
  // ... standard quad expansion via vertexId
}

[shader("fragment")]
float4 fragmentMain(...) -> SV_Target {
  return unpackColor(inst.color);
}
```

Run `pnpm gen:shaders` after every edit. This emits `my.generated.ts` with:

- `WGSL_SOURCE`, `GLSL_VERTEX`, `GLSL_FRAGMENT`
- `INSTANCE_STRIDE_BYTES`, field offset constants
- A typed `writeInstance()` packer function
- `GL_ATTRIBUTES` for WebGL2 binding

**Never hand-edit `*.generated.ts`.**

Use `bpHi`/`bpLo` (high/low float32 split) for genomic positions in shader code.
In TypeScript outside shader uniform writes, use plain `bp - bpStart` — the
hi/lo split is only needed inside the shader.

The `canvas_width` / `canvas_height` uniforms are CSS pixels — do not scale by
`devicePixelRatio` in your uniform writes.

## Step 3: GPU renderer

```ts
// GpuMyRenderer.ts
import { GpuPerRegionBackend } from '@jbrowse/core/gpu'
import { slangPass } from '@jbrowse/core/gpu'
import MY_SHADER from './shaders/my.generated.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/myUniforms.generated.ts'

import type { GpuHal } from '@jbrowse/core/gpu/hal'
import type { FeatureRenderBlock } from '@jbrowse/core/gpu'
import type { MyUploadData, MyRenderState } from './myBackendTypes.ts'

const MY_PASS = slangPass('my', MY_SHADER)

export class GpuMyRenderer extends GpuPerRegionBackend<
  MyUploadData,
  MyRenderState
> {
  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
  }

  uploadRegion(regionIndex: number, data: MyUploadData) {
    this.hal.deleteRegion(regionIndex)
    if (data.featureCount === 0) return

    // Pack instances into buffer
    const buf = new ArrayBuffer(data.featureCount * MY_PASS.instanceStrideBytes)
    // ... write instances with MY_SHADER.writeInstance(view, offset, { ... })
    this.hal.uploadBuffer(regionIndex, MY_PASS.id, buf, data.featureCount)
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    regions: ReadonlyMap<number, MyUploadData>,
    state: MyRenderState,
  ) {
    // Write frame-level uniforms once
    const uniforms = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
    // ... write bpPerPx, canvasWidth, etc.
    this.hal.beginFrame(uniforms)

    for (const block of blocks) {
      const region = regions.get(block.displayedRegionIndex)
      if (!region) continue
      this.hal.setScissor(block.offsetPx, 0, block.widthPx, state.canvasHeight)
      this.hal.drawPass(MY_PASS.id, regionIndex, instanceCount)
    }
    this.hal.clearScissor()
  }
}
```

## Step 4: Canvas2D renderer (fallback)

Implement the same interface using `ctx.fillRect` etc. This runs when WebGPU and
WebGL2 are both unavailable:

```ts
// Canvas2DMyRenderer.ts
import { Canvas2DPerRegionBackend } from '@jbrowse/core/gpu'

import type { MyUploadData, MyRenderState } from './myBackendTypes.ts'

export class Canvas2DMyRenderer extends Canvas2DPerRegionBackend<
  MyUploadData,
  MyRenderState
> {
  renderBlocks(
    blocks: FeatureRenderBlock[],
    regions: ReadonlyMap<number, MyUploadData>,
    state: MyRenderState,
  ) {
    const { ctx } = this
    for (const block of blocks) {
      const data = regions.get(block.displayedRegionIndex)
      if (!data) continue
      ctx.save()
      ctx.beginPath()
      ctx.rect(block.offsetPx, 0, block.widthPx, state.canvasHeight)
      ctx.clip()
      // ... draw features
      ctx.restore()
    }
  }
}
```

## Step 5: Backend factory

```ts
// MyRendererFactory.ts
import { createBackend } from '@jbrowse/core/gpu'

import { GpuMyRenderer } from './GpuMyRenderer.ts'
import { Canvas2DMyRenderer } from './Canvas2DMyRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/myUniforms.generated.ts'
import { MY_PASSES } from './shaders/index.ts'

import type { MyBackend } from './myBackendTypes.ts'

export function MyRendererFactory(canvas: HTMLCanvasElement): MyBackend {
  return createBackend(
    canvas,
    MY_PASSES,
    UNIFORMS_SIZE_BYTES,
    hal => new GpuMyRenderer(hal),
    canvas => new Canvas2DMyRenderer(canvas),
  )
}
```

## Step 6: MST model

Compose `MultiRegionDisplayMixin` (which includes `GpuLifecycleMixin`) and add a
`startBackend` action:

```ts
// model.ts
import { MultiRegionDisplayMixin } from '@jbrowse/plugin-linear-genome-view'
import { getContainingView } from '@jbrowse/core/util'
import { createRegionUploadSync } from '@jbrowse/core/gpu'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { MyBackend, MyRenderState } from './components/myBackendTypes.ts'

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .model('LinearMyDisplay', {
      type: types.literal('LinearMyDisplay'),
      configuration: ConfigurationReference(configSchema),
    })
    .compose(MultiRegionDisplayMixin())
    .views(self => ({
      // rpcProps() controls when a full re-fetch fires.
      // Keep it cheap — it runs on every observable read.
      rpcProps() {
        return {
          adapterConfig: readConfObject(self.configuration, 'adapter'),
        }
      },

      // renderState is recomputed each frame without fetching.
      get renderState(): MyRenderState {
        const view = getContainingView(self) as LinearGenomeViewModel
        return {
          bpPerPx: view.bpPerPx,
          canvasWidth: view.width,
          canvasHeight: self.height,
          colorBy: readConfObject(self.configuration, 'colorBy'),
        }
      },
    }))
    .actions(self => {
      const syncRegions = createRegionUploadSync<MyUploadData, MyBackend>()
      return {
        startBackend(backend: MyBackend) {
          self.attachBackend(backend, {
            upload: b => {
              syncRegions(b, self.laidOutDataMap)
            },
            render: b => {
              if (self.laidOutDataMap.size === 0) return false
              b.renderBlocks(
                self.renderBlocks,
                self.laidOutDataMap,
                self.renderState,
              )
              return true
            },
          })
        },
      }
    })
}
```

`rpcProps()` is watched by the fetch autorun — any change triggers a full
re-fetch from workers. Don't put frequently-changing values (scroll position,
zoom) here; put those in `renderState` instead. See
`adr-016-bicolorpivot-stays-in-worker.md` for the trade-off.

## Step 7: React component

```tsx
// components/MyComponent.tsx
import { observer } from 'mobx-react-lite'
import { useGpuBackend } from '@jbrowse/core/util'

import { MyRendererFactory } from './MyRendererFactory.ts'

import type { LinearMyDisplayModel } from '../model.ts'

const MyComponent = observer(({ model }: { model: LinearMyDisplayModel }) => {
  const { canvasRef, error } = useGpuBackend(MyRendererFactory, model)

  return (
    <div
      style={{ position: 'relative', height: model.height, overflow: 'hidden' }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      {error ? <DisplayErrorBar model={model} /> : null}
    </div>
  )
})

export default MyComponent
```

`useGpuBackend` creates the HAL, calls `model.startBackend()`, and returns a
`canvasRef` to attach to the `<canvas>` element.

## Step 8: Register the display

In your plugin's `install()`, register the display type pointing at your model
factory and React component (see
[Creating custom display types](/docs/developer_guides/creating_display) for the
full registration pattern).

## Key invariants

- **Absolute uint32 coordinates** — all worker output uses absolute genomic
  positions, not region-relative. float32 cannot hold 3 Gbp; use uint32 for
  positions crossing the worker boundary.
- **`rpcProps` must not contain fetch results** — `SettingsInvalidate` watches
  `rpcProps()`; putting derived cell data there creates an infinite fetch loop.
- **Shader uniforms use CSS pixels** — `canvas_width`/`canvas_height` are CSS
  pixels; do not scale by `devicePixelRatio` before writing them.
- **Never edit `*.generated.ts`** — always edit `.slang` and run
  `pnpm gen:shaders`; CI enforces this with `git diff --exit-code`.
