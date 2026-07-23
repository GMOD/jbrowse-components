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
[Adding a new GPU display type](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#adding-a-new-gpu-display-type)
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

`example-plugins/score-example/` is the plugin this guide builds, as a
standalone package: one `.slang` shader, a GPU renderer, and a Canvas2D
fallback. CI installs it from a packed tarball and asserts it renders, so it
stays buildable against the published packages.

The simplest per-region streamed reference is
`plugins/gwas/src/LinearManhattanDisplay/` (a scored scatter with both a GPU and
a Canvas2D renderer behind one model). `plugins/canvas/src/LinearBasicDisplay/`
is the fullest example: a generic feature display with four shader passes
(rectangles, lines, chevrons, arrows), but it uses the whole-map
`laidOutDataMap` form for cross-region layout, so start from Manhattan when your
regions are independent.

## Files to create

```
src/LinearScoreDisplay/
├── model.ts                       MST model: startRenderingBackend + renderState
├── index.ts                       registers the display type
├── configSchema.ts                config slots
└── components/
    ├── ScoreDisplayComponent.tsx  React: <DisplayChrome> + <canvas>
    ├── ScoreRendererFactory.ts    createRenderingBackend dispatch
    ├── GpuScoreRenderer.ts        extends GpuPerRegionRenderingBackend
    ├── Canvas2DScoreRenderer.ts   extends Canvas2DPerRegionRenderingBackend
    ├── scoreTypes.ts              ScoreRenderState + backend type
    └── shaders/score.slang        vertex + fragment for one pass
src/ScoreRPC/
├── index.ts                       RPC registration
├── GetScoreData.ts                worker: fetch features -> ScoreRegionData
└── rpcTypes.ts                    RPC arg + result types
```

## Step 1: Define data types

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/scoreTypes.ts -->

```ts
import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

// Recomputed cheaply every frame without fetching. Carries the canvas
// dimensions (required by the base class to size the backing store) plus the
// one setting the draw path reads.
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  color: string
}

export type ScoreRenderingBackend = PerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
>
```

## Step 2: Write the shaders

Create a `.slang` file. JBrowse uses a Slang-derived shader language that
compiles to both WGSL (WebGPU) and GLSL (WebGL2):

Modules are referenced by bare name (`import hpmath;`), not by file path. The
shared helpers live in `packages/render-core/src/shaders/` (`hpmath` for the
high-precision genomic→pixel transform, `colorPack` for unpacking packed
colors). The example below declares its uniforms inline; if several passes share
a struct, put it in a sibling module (`scoreUniforms.slang`, starting with
`module scoreUniforms;` and declaring a `public struct`).

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/shaders/score.slang -->

```slang
// Score display: one box per feature. The box spans start->end horizontally and
// its height is score (0..1) x canvasHeight, grown up from the bottom. A single
// uniform ABGR color fills every box. This is the minimal per-region GPU pass
// used by the "GPU displays" developer guide.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

struct ScoreInstance {
  uint  startBp : ATTR0;
  uint  endBp   : ATTR1;
  float score   : ATTR2;
};

struct Uniforms {
  // hpmath genomic->clip transform (hi, lo, +/-clippedLengthBp)
  float3 bpRangeX;
  float  zero;
  float  canvasWidth;
  float  canvasHeight;
  uint   color;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(ScoreInstance inst, uint vid : SV_VertexID) {
  // quadLocal maps the 6 vertices to the corners of a unit box: x/y each 0 or 1.
  float2 local = quadLocal(vid);

  float x1 = bpToClipX(inst.startBp, u);
  float x2 = bpToClipX(inst.endBp, u);
  // widen a sub-pixel feature so a 1bp box still paints (reversal-safe: reversal
  // is baked into bpRangeX's negated length, so x2 < x1 on reversed blocks).
  x2 = extendToMinWidthX(x1, x2, 1.0, u.canvasWidth);
  float x = local.x < 0.5 ? x1 : x2;

  float barHeightPx = clamp(inst.score, 0.0, 1.0) * u.canvasHeight;
  // local.y: 0 = top of the box, 1 = bottom (canvas bottom edge).
  float yPx = (u.canvasHeight - barHeightPx) + local.y * barHeightPx;

  VsOut o;
  o.position = float4(x, yPxToClipY(yPx, u.canvasHeight), 0.0, 1.0);
  o.color = unpackRGBA(u.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
```

Run `pnpm gen:shaders` after every edit. This emits `score.generated.ts` with:

- `WGSL_SOURCE`, `GLSL_VERTEX`, `GLSL_FRAGMENT`
- `INSTANCE_STRIDE_BYTES` / `FIELD_OFFSET_F32` and a typed `packInstances()`
  that interleaves your parallel arrays into one instance buffer
- `UNIFORMS_SIZE_BYTES`, `UNIFORM_OFFSET_F32` (Float32 indices), and a typed
  `writeUniforms()` function
- `GL_ATTRIBUTES` for WebGL2 binding

**Never hand-edit `*.generated.ts`.**

The codegen runs in your own repo:

```bash
pnpm add -D @jbrowse/shader-tools
npx jbrowse-build-shaders        # or: ... build-shaders src/.../score.slang
```

Run it from your project root. It scans for `*.slang`, fetches a pinned `slangc`
on first use, and writes each `*.generated.ts` next to its source. The shared
modules (`hpmath`, `colorPack`) resolve from your installed
`@jbrowse/render-core`. Inside this repo the same tool runs as
`pnpm gen:shaders`.

:::note

`@jbrowse/shader-tools` and `@jbrowse/render-core` first publish to npm in the
next release. Until then, author `.slang` against a `jbrowse-components`
checkout and copy the emitted `*.generated.ts` into your plugin.

:::

Genomic positions travel as absolute `uint` attributes; convert them with the
`bpToClipX` wrapper above and nothing else. The `bpHi`/`bpLo` split it hides
exists because float32 can't represent every base past ~16.7 Mbp, and it is
confined to that one line — in TypeScript outside uniform writes, use plain
`bp - bpStart`.

The `canvas_width` / `canvas_height` uniforms are CSS pixels, so do not scale by
`devicePixelRatio` in your uniform writes.

## Step 3: GPU renderer

The base class `GpuPerRegionRenderingBackend` owns the per-frame scaffold:
`resize`, `beginFrame`/`endFrame`, and the per-block scissor/viewport clip. You
implement only two methods: `uploadRegion` (pack a region's features into a HAL
buffer) and `drawRegion` (write uniforms and issue the draw pass for one
already-clipped block).

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/GpuScoreRenderer.ts -->

```ts
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const PASS = 'score'
const U = shader.UNIFORM_OFFSET_F32
const UU = shader.UNIFORM_OFFSET_U32

// Exported so the factory can hand the pass list to the HAL. Six vertices per
// instance = two triangles, so the boxes need a triangle-list topology.
export const SCORE_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS, mod: shader, topology: 'triangle-list' }),
]

export class GpuScoreRenderer extends GpuPerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
> {
  private uniformF32: Float32Array
  private uniformU32: Uint32Array

  constructor(hal: GpuHal) {
    // the base allocates the reusable this.uniformData scratch buffer
    super(hal, shader.UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.uniformU32 = new Uint32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, data: ScoreRegionData) {
    if (data.numFeatures === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      return
    }
    // the generated packInstances interleaves the parallel arrays into the
    // GL_ATTRIBUTES layout — no manual DataView offsets
    const buf = shader.packInstances(
      { startBp: data.starts, endBp: data.ends, score: data.scores },
      data.numFeatures,
    )
    this.hal.uploadBuffer(displayedRegionIndex, PASS, buf, data.numFeatures)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _region: ScoreRegionData,
    state: ScoreRenderState,
  ) {
    // fills the hp-split genomic->clip transform (and negates it on reversal)
    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.zero] = 0
    this.uniformF32[U.canvasWidth] = state.canvasWidth
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    this.uniformU32[UU.color] = cssColorToABGR(state.color)
    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS, block.displayedRegionIndex)
  }
}
```

For a real, complete example of this shape see
`plugins/gwas/src/LinearManhattanDisplay/GpuManhattanRenderer.ts`.

## Step 4: Canvas2D renderer (required)

Implement the same interface using `ctx.fillRect` etc. Canvas2D is
[the floor every display must ship](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#canvas2d-is-the-floor-gpu-is-the-optional-accelerator):
**SVG export runs the Canvas2D path**, and the GPU shader is the optional
accelerator layered on top. This renderer also runs when WebGPU and WebGL2 are
both unavailable:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/Canvas2DScoreRenderer.ts -->

```ts
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawScoreBlocks } from './drawScore.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The base class owns renderBlocks (DPR-aware canvas sizing, then calls draw);
// this subclass implements only the pure paint step. Runs both as the WebGPU/
// WebGL2 fallback and as the SVG-export path.
export class Canvas2DScoreRenderer extends Canvas2DPerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
> {
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, ScoreRegionData>,
    state: ScoreRenderState,
  ) {
    drawScoreBlocks(this.ctx, regions, blocks, state)
  }
}
```

## Step 5: RenderingBackend factory

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/ScoreRendererFactory.ts -->

```ts
import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DScoreRenderer } from './Canvas2DScoreRenderer.ts'
import { GpuScoreRenderer, SCORE_PASSES } from './GpuScoreRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/score.generated.ts'

import type { ScoreRenderingBackend } from './scoreTypes.ts'

// createRenderingBackend tries the GPU HAL first (WebGPU, then WebGL2) and
// falls back to Canvas2D when no GPU device is available. It's async (it awaits
// device creation), so this returns a Promise; DisplayChrome awaits it.
export function ScoreRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<ScoreRenderingBackend>(canvas, {
    passes: SCORE_PASSES,
    uniformByteSize: UNIFORMS_SIZE_BYTES,
    createGpuBackend: hal => new GpuScoreRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DScoreRenderer(c),
  })
}
```

## Step 6: MST model

Compose `MultiRegionDisplayMixin` (which includes `RenderLifecycleMixin` and the
fetch autoruns), store the worker output in an `rpcDataMap`, and wire the render
lifecycle with `installPerRegionLifecycle`. This is the **per-region streamed**
upload pattern from the
[architecture spec's three upload patterns](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#three-upload-patterns),
the right shape when each region's data is independent (no cross-region layout
coupling). It's identical in structure to the Canvas2D model in
[Plotting features](/docs/developer_guides/plotting_features#step-3-the-mst-model);
only the renderer differs.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts -->

```ts
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchEachRegion,
} from '@jbrowse/plugin-linear-genome-view'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import { observable } from 'mobx'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type {
  ScoreRenderState,
  ScoreRenderingBackend,
} from './components/scoreTypes.ts'
import type { LinearScoreDisplayConfigModel } from './configSchema.ts'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function modelFactory(configSchema: LinearScoreDisplayConfigModel) {
  return types
    .compose(
      'LinearScoreDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        type: types.literal('LinearScoreDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      // fetched data keyed by displayedRegionIndex — the render lifecycle
      // uploads/draws one region at a time from this map
      rpcDataMap: observable.map<number, ScoreRegionData>(),
    }))
    .views(self => ({
      get view() {
        return getContainingView(self) as LinearGenomeViewModel
      },
      // fetch inputs watched by SettingsInvalidate — any change refetches. Put
      // settings that change what the worker computes here; never scroll/zoom
      // (those change every frame) or the fetch results themselves.
      rpcProps() {
        return { scoreColumn: getConf(self, 'scoreColumn') }
      },
      // recomputed cheaply every frame without fetching; carries the canvas
      // dimensions (required) plus whatever the draw path reads
      get renderState(): ScoreRenderState {
        return {
          canvasWidth: this.view.trackWidthPx,
          canvasHeight: self.height,
          color: getConf(self, 'color'),
        }
      },
    }))
    .actions(self => ({
      setRpcData(idx: number, data: ScoreRegionData) {
        self.rpcDataMap.set(idx, data)
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
    }))
    .actions(self => ({
      // called by the fetch autorun for the regions that need loading;
      // fetchEachRegion handles cancellation, stop tokens and staleness
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        const { adapterConfig } = self
        if (!adapterConfig) {
          return undefined
        }
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        return fetchEachRegion(self, needed, {
          // rpcManager.call injects sessionId itself, so it is not in the args
          call: (region, ctx, displayedRegionIndex) =>
            rpcManager.call(sessionId, 'GetScoreData', {
              adapterConfig,
              region,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
              statusCallback:
                self.makeRegionStatusCallback(displayedRegionIndex),
            }),
          onResult: (idx, result) => {
            self.setRpcData(idx, result)
          },
        })
      },
      // called once by DisplayChrome when the backend is created. Streams each
      // region into the backend and draws every frame from renderState.
      startRenderingBackend(backend: ScoreRenderingBackend) {
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

export type LinearScoreDisplayStateModel = ReturnType<typeof modelFactory>
export type LinearScoreDisplayModel = Instance<LinearScoreDisplayStateModel>
```

`installPerRegionLifecycle` wraps the lower-level
[`attachRenderingBackend`](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#the-core-contract)
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
([a hard invariant](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#the-api)).
Its render-prop child makes it agnostic to how many canvases a display draws.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/ScoreDisplayComponent.tsx -->

```tsx
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { ScoreRenderer } from './ScoreRendererFactory.ts'

import type { LinearScoreDisplayModel } from '../model.ts'

// DisplayChrome supplies the display's chrome (loading scrim, error bar,
// region-too-large banner) and WebGL/WebGPU context-loss recovery, and is the
// only place useRenderingBackend is called. Its render-prop hands back the
// canvasRef to attach to the <canvas>.
const ScoreDisplayComponent = observer(function ScoreDisplayComponent({
  model,
}: {
  model: LinearScoreDisplayModel
}) {
  return (
    <DisplayChrome
      model={model}
      factory={ScoreRenderer}
      testid="score-display"
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

export default ScoreDisplayComponent
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

- [Data fetching pipeline](/docs/developer_guides/data_fetching)
- [RPC and worker system](/docs/developer_guides/rpc_workers)
- [Creating custom display types](/docs/developer_guides/creating_display)
- [Adding SVG export to a display](/docs/developer_guides/svg_export)
