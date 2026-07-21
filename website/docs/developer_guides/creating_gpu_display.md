---
title: GPU displays
description:
  Build a display that renders with WebGPU/WebGL2 and falls back to Canvas2D
guide_category: Creating pluggable elements
---

:::note

This guide covers the GPU rendering path introduced in the WebGL/WebGPU
migration, the scale-up path for large or dense datasets (roughly ≳100K features
per frame). For typical annotation tracks, start with
[Plotting features in a custom display](/docs/developer_guides/plotting_features),
which uses the shader-free Canvas2D path. The two share the same model, fetch
chain, and lifecycle; only the renderer differs, so moving up later is a small
change.

The
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md)
is the source of truth for the lifecycle, mixins, and invariants; its
[GPU rendering architecture](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#gpu-rendering-architecture)
and
[Adding a new GPU display type](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#adding-a-new-gpu-display-type)
sections mirror the steps below.

`@jbrowse/render-core` is published but marked `@experimental`: names and
signatures may still change before it is frozen under semver, so pin an exact
version and expect to rebuild on upgrade. Its GPU surface is also
static-import-only (it is not exposed through JBrowse's runtime `ReExports`
registry), so a GPU display must be a
[build-step plugin](/docs/developer_guides/simple_plugin), not a
[no-build plugin](/docs/developer_guides/no_build_plugin).

:::

## Architecture overview

JBrowse GPU displays follow a three-layer model:

```
Worker (RPC)          Main thread (MST model)        GPU / Canvas
─────────────         ──────────────────────         ─────────────
executeRender()  →    rpcDataMap (per region)   →    upload autorun
                      renderState (frame uniforms) → render autorun → frame
```

The model keeps two autoruns running at all times (owned by
`RenderLifecycleMixin`, installed by `installPerRegionLifecycle`):

- An upload autorun _per region key_ fires when that region's `rpcDataMap` entry
  or the backend changes; it calls `backend.uploadRegion()` for the region that
  changed. Per-key autoruns keep a streaming whole-genome fetch at O(N) uploads
  instead of O(N²).
- The render autorun fires when `renderTick` bumps (after every upload) or when
  frame-level state like scroll position changes; it calls
  `backend.renderBlocks()`.

The backend is a HAL (Hardware Abstraction Layer) that dispatches to WebGPU,
WebGL2, or Canvas2D at runtime. Your renderer code talks to the HAL. It never
calls WebGPU or WebGL2 directly.

See the
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#gpu-rendering-architecture)
for the full lifecycle spec and `packages/render-core/CLAUDE.md` for HAL
invariants.

The simplest per-region streamed reference is
`plugins/gwas/src/LinearManhattanDisplay/` (a scored scatter with both a GPU and
a Canvas2D renderer behind one model). `plugins/canvas/src/LinearBasicDisplay/`
is the fullest example: a generic feature display with four shader passes
(rectangles, lines, chevrons, arrows), but it uses the whole-map
`laidOutDataMap` form for cross-region layout, so start from Manhattan when your
regions are independent.

## Files to create

```
plugins/myplugin/src/LinearMyDisplay/
├── model.ts                         MST model: startRenderingBackend + renderState
├── components/
│   ├── MyComponent.tsx              React: <DisplayChrome> + <canvas>
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
  positionsU32: Uint32Array // interleaved absolute-bp start, width per feature
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

Create a `.slang` file. JBrowse uses a Slang-derived shader language that
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
- `INSTANCE_STRIDE_BYTES` / `FIELD_OFFSET_F32` and a typed `packInstances()`
  that interleaves your parallel arrays into one instance buffer
- `UNIFORMS_SIZE_BYTES`, `UNIFORM_OFFSET_F32` (Float32 indices), and a typed
  `writeUniforms()` function
- `GL_ATTRIBUTES` for WebGL2 binding

**Never hand-edit `*.generated.ts`.**

The codegen (`@jbrowse/shader-tools`) is currently repo-coupled: it derives the
repo root from its own location and hardcodes the shared-module include path to
`packages/render-core/src/shaders` (the `hpmath` / `colorPack` modules). It is
not yet packaged for an out-of-tree plugin repo, so today you author `.slang`
shaders inside a `jbrowse-components` checkout (or a fork) and copy the emitted
`*.generated.ts` into your plugin. `build-shaders.ts` accepts explicit paths, so
you can regenerate a single shader instead of walking the whole workspace:

```bash
node --experimental-strip-types \
  packages/shader-tools/src/build-shaders.ts \
  plugins/myplugin/src/LinearMyDisplay/components/shaders/my.slang
```

Use `bpHi`/`bpLo` (high/low float32 split) for genomic positions in shader code.
In TypeScript outside shader uniform writes, use plain `bp - bpStart`. The hi/lo
split is only needed inside the shader.

The `canvas_width` / `canvas_height` uniforms are CSS pixels, so do not scale by
`devicePixelRatio` in your uniform writes.

## Step 3: GPU renderer

The base class `GpuPerRegionRenderingBackend` owns the per-frame scaffold:
`resize`, `beginFrame`/`endFrame`, and the per-block scissor/viewport clip. You
implement only two methods: `uploadRegion` (pack a region's features into a HAL
buffer) and `drawRegion` (write uniforms and issue the draw pass for one
already-clipped block).

```ts
// GpuMyRenderer.ts
import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'
import * as shader from './shaders/my.generated.ts'

import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { MyUploadData, MyRenderState } from './myRenderingBackendTypes.ts'

const PASS = 'my'
const U = shader.UNIFORM_OFFSET_F32

// exported so the factory (Step 5) can hand the pass list to the HAL
export const MY_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS, mod: shader }),
]

export class GpuMyRenderer extends GpuPerRegionRenderingBackend<
  MyUploadData,
  MyRenderState
> {
  private uniformF32: Float32Array

  constructor(hal: GpuHal) {
    // the base class allocates a reusable this.uniformData scratch buffer
    super(hal, shader.UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  // pack one region's features into a GPU buffer (or drop the buffer when empty)
  uploadRegion(regionIndex: number, data: MyUploadData) {
    if (data.featureCount === 0) {
      this.hal.deleteRegion(regionIndex)
    } else {
      // the generated packInstances() interleaves your parallel arrays into the
      // GL_ATTRIBUTES layout — no manual DataView offsets
      const buf = shader.packInstances(
        { startBp: data.positionsU32, color: data.colorsU32 },
        data.featureCount,
      )
      this.hal.uploadBuffer(regionIndex, PASS, buf, data.featureCount)
    }
  }

  // draw one block whose scissor/viewport the base already set to its span
  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _region: MyUploadData,
    state: MyRenderState,
  ) {
    // writeBpRangeUniforms fills the hp-split genomic→clip transform for you
    writeBpRangeUniforms(this.uniformF32, clip, block.reversed)
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    // ... set the remaining uniform fields by UNIFORM_OFFSET_F32 index
    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS, block.displayedRegionIndex)
  }
}
```

For a real, complete example of this shape see
`plugins/gwas/src/LinearManhattanDisplay/GpuManhattanRenderer.ts`.

## Step 4: Canvas2D renderer (required)

Implement the same interface using `ctx.fillRect` etc. Canvas2D is
[the floor every display must ship](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#canvas2d-is-the-floor-gpu-is-the-optional-accelerator):
**SVG export runs the Canvas2D path**, and the GPU shader is the optional
accelerator layered on top. This renderer also runs when WebGPU and WebGL2 are
both unavailable:

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

import { GpuMyRenderer, MY_PASSES } from './GpuMyRenderer.ts'
import { Canvas2DMyRenderer } from './Canvas2DMyRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/myUniforms.generated.ts'

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

Compose `MultiRegionDisplayMixin` (which includes `RenderLifecycleMixin` and the
fetch autoruns), store the worker output in an `rpcDataMap`, and wire the render
lifecycle with `installPerRegionLifecycle`. This is the **per-region streamed**
upload pattern from the
[architecture spec's three upload patterns](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#three-upload-patterns),
the right shape when each region's data is independent (no cross-region layout
coupling). It's identical in structure to the Canvas2D model in
[Plotting features](/docs/developer_guides/plotting_features#step-3-the-mst-model);
only the renderer differs.

```ts
// model.ts
import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { MultiRegionDisplayMixin } from '@jbrowse/plugin-linear-genome-view'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import { observable } from 'mobx'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  MyRenderingBackend,
  MyRenderState,
  MyUploadData,
} from './components/myRenderingBackendTypes.ts'

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .model('LinearMyDisplay', {
      type: types.literal('LinearMyDisplay'),
      configuration: ConfigurationReference(configSchema),
    })
    .compose(MultiRegionDisplayMixin())
    .volatile(() => ({
      // fetched data keyed by displayedRegionIndex — one entry per region
      rpcDataMap: observable.map<number, MyUploadData>(),
    }))
    .views(self => ({
      // rpcProps() controls when a full re-fetch fires. User-controlled
      // settings only — never scroll/zoom or fetch results.
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
    .actions(self => ({
      setRpcData(idx: number, data: MyUploadData) {
        self.rpcDataMap.set(idx, data)
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
      // fetchNeeded is identical to the Canvas2D path — see the data fetching
      // pipeline guide. It calls fetchEachRegion and writes into rpcDataMap.
      startRenderingBackend(backend: MyRenderingBackend) {
        // one autorun per region key: a new region uploads O(1); a settings
        // change re-encodes all regions. `data => data` is the identity encoder
        // — use it when the RPC result is already the render payload.
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => data,
          (b, regions) => {
            if (regions.size === 0) {
              return false // keep the loading overlay up until data lands
            }
            b.renderBlocks(self.renderBlocks, regions, self.renderState)
            return true
          },
        )
      },
    }))
}
```

`installPerRegionLifecycle` wraps the lower-level
[`attachRenderingBackend`](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#the-core-contract)
contract (one upload autorun, one render autorun), giving each region key its
own upload autorun to avoid O(N²) re-uploads as regions stream in. Only displays
that lay features into Y-rows _across_ regions (`LinearBasicDisplay`,
alignments) need the whole-map `laidOutDataMap` form instead.

The model omits `fetchNeeded` for brevity; add it exactly as on the Canvas2D
path
([Plotting features, Step 3](/docs/developer_guides/plotting_features#step-3-the-mst-model)):
it calls `fetchEachRegion` and writes each region through `setRpcData`. Full
detail: [the data fetching pipeline](/docs/developer_guides/data_fetching).

Any change to `rpcProps()` triggers a full worker re-fetch (via
`SettingsInvalidate`), so keep frequently-changing values (scroll, zoom) in
`renderState`, not here. Settings that drive a main-thread buffer _re-encode_
with no refetch (a color or scale change) go in a separate `gpuProps()` method
(see the
[`rpcProps()` / `gpuProps()` pattern](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#rpcprops--gpuprops-pattern)).

## Step 7: React component

Render the canvas through the shared `DisplayChrome` (the wrapper that supplies
a display's _chrome_: the UI framing around your canvas (loading scrim, error
bar, "region too large" banner, in the sense of "browser chrome") plus
WebGL/WebGPU context-loss recovery). It is the **only** place
`useRenderingBackend` is called. A display must not call the hook itself
([a hard invariant](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#the-api)).
Its render-prop child makes it agnostic to how many canvases a display draws.

```tsx
// components/MyComponent.tsx
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { MyRendererFactory } from './MyRendererFactory.ts'

import type { LinearMyDisplayModel } from '../model.ts'

const MyComponent = observer(function MyComponent({
  model,
}: {
  model: LinearMyDisplayModel
}) {
  return (
    <DisplayChrome
      model={model}
      factory={MyRendererFactory}
      testid="my-display"
      style={{ width: '100%', height: model.height }}
    >
      {({ canvasRef }) => (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      )}
    </DisplayChrome>
  )
})

export default MyComponent
```

`DisplayChrome` creates the HAL via `useRenderingBackend`, calls
`model.startRenderingBackend(backend)` once the backend is live, and hands back
the `canvasRef` to attach to your `<canvas>`. This is the same component the
Canvas2D display in
[Plotting features](/docs/developer_guides/plotting_features#step-5-the-react-component)
uses. The two paths share it unchanged.

## Step 8: Register the display

In your plugin's `install()`, register the display type pointing at your model
factory and React component (see
[Creating custom display types](/docs/developer_guides/creating_display) for the
full registration pattern).

## Key invariants

- All worker output uses absolute genomic uint32 coordinates, not
  region-relative. float32 cannot hold 3 Gbp; use uint32 for positions crossing
  the worker boundary.
- `rpcProps` must not contain fetch results. `SettingsInvalidate` watches
  `rpcProps()`; putting derived cell data there creates an infinite fetch loop.
- Shader uniforms use CSS pixels. `canvas_width`/`canvas_height` are CSS pixels;
  do not scale by `devicePixelRatio` before writing them.
- Never edit `*.generated.ts`. Always edit `.slang` and run `pnpm gen:shaders`;
  CI enforces this with `git diff --exit-code`.
- Renderers stay stateless. Don't cache per-region data on the renderer class
  (`private regions = new Map()`); the model's `rpcDataMap` is the single source
  of truth and is passed into `renderBlocks`. Delegate GPU buffer lifecycle to
  `hal.pruneRegions(active)`.
- Render the canvas through `DisplayChrome`, never by calling
  `useRenderingBackend` in your own component.

The
[What NOT to do](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#what-not-to-do)
section of the architecture spec is the full quick-scan list.

## See also

- [Renderer architecture](/docs/developer_guides/renderer_architecture)
- [Data fetching pipeline](/docs/developer_guides/data_fetching)
- [RPC and worker system](/docs/developer_guides/rpc_workers)
- [Creating custom display types](/docs/developer_guides/creating_display)
- [Adding SVG export to a display](/docs/developer_guides/svg_export)
