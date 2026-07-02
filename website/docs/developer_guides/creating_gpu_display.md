---
title: Creating a GPU-accelerated display
description:
  Build a display that renders with WebGPU/WebGL2 and falls back to Canvas2D
guide_category: Creating pluggable elements
---

:::note

This guide covers the GPU rendering path introduced in the WebGL/WebGPU
migration. If you only need Canvas2D rendering, the standard `createDisplay`
path is simpler. Use this guide when you need hardware-accelerated rendering for
large or dense datasets.

:::

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
`RenderLifecycleMixin`):

- **Upload autorun** — fires when `laidOutDataMap` or the backend changes; calls
  `backend.uploadRegion()` for regions that changed.
- **Render autorun** — fires when `renderTick` bumps (after every upload) or
  when frame-level state like scroll position changes; calls
  `backend.renderBlocks()`.

The backend is a HAL (Hardware Abstraction Layer) that dispatches to WebGPU,
WebGL2, or Canvas2D at runtime. Your renderer code talks to the HAL — it never
calls WebGPU or WebGL2 directly.

See `agent-docs/ARCHITECTURE.md` for the full lifecycle spec and
`packages/render-core/CLAUDE.md` for HAL invariants.

The simplest concrete reference is `plugins/canvas/src/LinearBasicDisplay/` — a
generic feature display with four shader passes (rectangles, lines, chevrons,
arrows).

## Files to create

```
plugins/myplugin/src/LinearMyDisplay/
├── model.ts                         MST model: startRenderingBackend + renderState
├── components/
│   ├── MyComponent.tsx              React: useRenderingBackend hook + <canvas>
│   ├── MyRendererFactory.ts         createRenderingBackend dispatch function
│   ├── GpuMyRenderer.ts             extends GpuPerRegionRenderingBackend
│   ├── Canvas2DMyRenderer.ts        extends Canvas2DPerRegionRenderingBackend
│   ├── myRenderingBackendTypes.ts            MyUploadData, MyRenderState types
│   └── shaders/
│       ├── myUniforms.slang         uniform struct (shared by all passes)
│       └── my.slang                 vertex + fragment for one pass
└── RenderMyDataRPC/
    ├── index.ts                     RPC registration
    └── executeRenderMyData.ts       worker: fetch + pack → MyUploadData
```

## Step 1: Define data types

```ts
// myRenderingBackendTypes.ts

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

export type MyRenderingBackend = PerRegionRenderingBackend<
  MyUploadData,
  MyRenderState
>
```

## Step 2: Write the shaders

Create a `.slang` file — JBrowse uses a Slang-derived shader language that
compiles to both WGSL (WebGPU) and GLSL (WebGL2):

Modules are referenced by bare name (`import hpmath;`), not by file path. The
shared helpers live in `packages/render-core/src/shaders/` (`hpmath` for the
high-precision genomic→pixel transform, `colorPack` for unpacking packed
colors); your own uniform struct goes in a sibling module (`myUniforms.slang`,
which starts with `module myUniforms;` and declares a `public struct`).

```slang
// shaders/my.slang
import hpmath;
import colorPack;
import myUniforms;

// Bind the uniform buffer declared by the myUniforms module
[[vk::binding(1, 0)]] ConstantBuffer<MyUniforms> u;

struct InstanceInput {
  uint startBp : ATTR0;   // absolute genomic position (uint32)
  uint widthBp : ATTR1;
  uint color   : ATTR2;   // packed ABGR
}

[shader("vertex")]
float4 vertexMain(InstanceInput inst, uint vertexId: SV_VertexID) -> float4 {
  // hpmath converts an absolute genomic bp position to clip-space x
  float x = bpToClipX(inst.startBp, u);
  // ... standard quad expansion via vertexId
}

[shader("fragment")]
float4 fragmentMain(InstanceInput inst) -> SV_Target {
  return colorPack.unpackRGBA(inst.color);
}
```

Run `pnpm gen:shaders` after every edit. This emits `my.generated.ts` with:

- `WGSL_SOURCE`, `GLSL_VERTEX`, `GLSL_FRAGMENT`
- `INSTANCE_STRIDE_BYTES` and `FIELD_OFFSET_F32` for packing instances
- `UNIFORMS_SIZE_BYTES` and a typed `writeUniforms()` function
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
import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'
import * as MY_SHADER from './shaders/my.generated.ts'

import type { GpuHal } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { MyUploadData, MyRenderState } from './myRenderingBackendTypes.ts'

const MY_PASS = slangPass({ id: 'my', mod: MY_SHADER })

export class GpuMyRenderer extends GpuPerRegionRenderingBackend<
  MyUploadData,
  MyRenderState
> {
  constructor(hal: GpuHal) {
    // The base class allocates a reusable this.uniformData scratch buffer
    super(hal, MY_SHADER.UNIFORMS_SIZE_BYTES)
  }

  uploadRegion(regionIndex: number, data: MyUploadData) {
    this.hal.deleteRegion(regionIndex)
    if (data.featureCount > 0) {
      // Pack one instance per feature into an interleaved buffer laid out to
      // match MY_SHADER.GL_ATTRIBUTES (stride MY_SHADER.INSTANCE_STRIDE_BYTES).
      const buf = new ArrayBuffer(
        data.featureCount * MY_SHADER.INSTANCE_STRIDE_BYTES,
      )
      // ... write each instance's fields via a DataView using
      // MY_SHADER.FIELD_OFFSET_F32 as the byte offsets
      this.hal.uploadBuffer(regionIndex, MY_PASS.id, buf, data.featureCount)
    }
  }

  renderBlocks(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, MyUploadData>,
    state: MyRenderState,
  ) {
    const dpr = getDpr()
    this.hal.resize(state.canvasWidth, state.canvasHeight)
    // beginFrame clears the canvas to transparent (r, g, b, a)
    this.hal.beginFrame(0, 0, 0, 0)
    for (const block of blocks) {
      const region = regions.get(block.displayedRegionIndex)
      const clip = region
        ? clipBlock(block, state.canvasWidth, state.canvasHeight, dpr)
        : undefined
      if (clip) {
        // Write frame-level uniforms into the reused this.uniformData buffer,
        // then hand them to the HAL right before the draw.
        MY_SHADER.writeUniforms(this.uniformData, {
          bpPerPx: clip.bpPerPx,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          // ... remaining uniform fields
        })
        this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
        this.hal.writeUniforms(this.uniformData)
        this.hal.drawPass(MY_PASS.id, block.displayedRegionIndex)
      }
    }
    this.hal.clearScissor()
    this.hal.endFrame()
  }
}
```

## Step 4: Canvas2D renderer (fallback)

Implement the same interface using `ctx.fillRect` etc. This runs when WebGPU and
WebGL2 are both unavailable:

```ts
// Canvas2DMyRenderer.ts
import {
  clipBlockForCanvas,
  makeBpMapper,
  prepareCanvas,
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { MyUploadData, MyRenderState } from './myRenderingBackendTypes.ts'

export class Canvas2DMyRenderer extends Canvas2DPerRegionRenderingBackend<
  MyUploadData,
  MyRenderState
> {
  renderBlocks(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, MyUploadData>,
    state: MyRenderState,
  ) {
    const { canvas, ctx } = this
    prepareCanvas(canvas, ctx, state.canvasWidth, state.canvasHeight)
    for (const block of blocks) {
      const data = regions.get(block.displayedRegionIndex)
      const clip = data
        ? clipBlockForCanvas(block, state.canvasWidth)
        : undefined
      if (clip) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(clip.scissorX, 0, clip.scissorW, state.canvasHeight)
        ctx.clip()
        // makeBpMapper(block) returns a bp → screen-x function for drawing
        const toX = makeBpMapper(block)
        // ... draw features using toX
        ctx.restore()
      }
    }
  }
}
```

## Step 5: RenderingBackend factory

```ts
// MyRendererFactory.ts
import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { GpuMyRenderer } from './GpuMyRenderer.ts'
import { Canvas2DMyRenderer } from './Canvas2DMyRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/myUniforms.generated.ts'
import { MY_PASSES } from './shaders/index.ts'

import type { MyRenderingBackend } from './myRenderingBackendTypes.ts'

// createRenderingBackend is async (it awaits GPU device creation), so the factory
// returns Promise<MyRenderingBackend> — useRenderingBackend awaits it for you.
export function MyRendererFactory(canvas: HTMLCanvasElement) {
  return createRenderingBackend<MyRenderingBackend>(
    canvas,
    MY_PASSES,
    UNIFORMS_SIZE_BYTES,
    hal => new GpuMyRenderer(hal),
    c => new Canvas2DMyRenderer(c),
  )
}
```

## Step 6: MST model

Compose `MultiRegionDisplayMixin` (which includes `RenderLifecycleMixin`) and
add a `startRenderingBackend` action:

```ts
// model.ts
import { MultiRegionDisplayMixin } from '@jbrowse/plugin-linear-genome-view'
import { getContainingView } from '@jbrowse/core/util'
import { createRegionUploadSync } from '@jbrowse/render-core/regionUploadSync'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  MyRenderingBackend,
  MyRenderState,
} from './components/myRenderingBackendTypes.ts'

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
      const syncRegions = createRegionUploadSync<
        MyUploadData,
        MyRenderingBackend
      >()
      return {
        startRenderingBackend(backend: MyRenderingBackend) {
          self.attachRenderingBackend(backend, {
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
import { observer } from 'mobx-react'
import { useRenderingBackend } from '@jbrowse/core/util'

import { MyRendererFactory } from './MyRendererFactory.ts'

import type { LinearMyDisplayModel } from '../model.ts'

const MyComponent = observer(({ model }: { model: LinearMyDisplayModel }) => {
  const { canvasRef, error } = useRenderingBackend(MyRendererFactory, model)

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

`useRenderingBackend` creates the HAL, calls `model.startRenderingBackend()`,
and returns a `canvasRef` to attach to the `<canvas>` element.

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

## See also

- [Data fetching pipeline](/docs/developer_guides/data_fetching) — the
  `MultiRegionDisplayMixin` autorun chain, `rpcProps`, and `renderState`
- [RPC and worker system](/docs/developer_guides/rpc_workers) — the worker that
  packs the upload buffers this display renders
- [Renderer architecture](/docs/developer_guides/renderer_architecture)
- [Creating custom display types](/docs/developer_guides/creating_display) — the
  Canvas2D-only path and display registration
- [Adding SVG export to a display](/docs/developer_guides/svg_export)
