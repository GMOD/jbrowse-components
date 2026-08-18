---
title: GPU displays
description:
  Build a display that renders with WebGPU/WebGL2 and falls back to Canvas2D
guide_category: Plugins
---

**TL;DR:** Build a display that renders via WebGPU/WebGL2 with a required
Canvas2D fallback: define data types, write a `.slang` shader, implement a GPU
and a Canvas2D renderer behind one factory, wire an MST model with
`installPerRegionLifecycle`, and render through `DisplayChrome`.

:::note

The scale-up path, for roughly ≳100K features per frame. Start from
[](/docs/developer_guides/plotting_features) otherwise; it builds the same
plugin without the shader, so moving up later adds files rather than changing
them.

`@jbrowse/render-core` and `@jbrowse/shader-tools` **first publish in the next
release**. Until then, author against a `jbrowse-components` checkout and copy
the emitted `*.generated.ts` into your plugin. Both land `@experimental`, so pin
an exact version and expect to rebuild on upgrade. `render-core`'s GPU surface
is static-import-only, which is what makes a GPU display a
[build-step plugin](/docs/developer_guides/simple_plugin).

:::

## Architecture overview

JBrowse GPU displays follow a three-layer model:

<Figure caption="The whole idea, before any of the machinery. The worker sends the data to the GPU when the region changes, and it stays there; every frame after that just redraws what the GPU already holds. Panning, zooming and recoloring never refetch or reparse — that is what makes a GPU display different from a Canvas2D one, and everything named in the next figure exists to keep it true." src="/img/gpu_display_tldr.png" />

The rest of this section is that same picture with the mechanisms in it.

<Figure caption="Two autoruns, each with its own trigger: a per-region-key upload autorun on an rpcDataMap entry changing, and a render autorun on renderTick or a frame-level change like scroll. Every upload calls renderNow(), which bumps renderTick and closes the loop; a draw that reports it painted also flips canvasDrawn, which readiness testids and DisplayChrome wait on." src="/img/gpu_display_lifecycle.png" />

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
WebGL2, or Canvas2D at runtime. Your renderer talks to the HAL, never to WebGPU
or WebGL2 directly. See the
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#gpu-rendering-architecture)
for the full lifecycle and `packages/render-core/CLAUDE.md` for HAL invariants.

For real references, `plugins/gwas/src/LinearManhattanDisplay/` is the simplest
per-region streamed case. `plugins/canvas/src/LinearBasicDisplay/` is the
fullest (four shader passes) but uses the whole-map `laidOutDataMap` form for
cross-region layout, so start from Manhattan when your regions are independent.
[](/docs/developer_guides/plotting_features) lists the rest.

## Files to create

The same `example-plugins/score-example/` the Canvas2D guide builds, with the
`[GPU only]` rows added:

<!-- EXAMPLE_PLUGIN_TREE START -->

```
src/
  index.ts                       the plugin class; installs the display, the RPC method and the feature panel
  LinearScoreDisplay/
    configSchema.ts              config slots (color, scoreColumn)
    index.ts                     registers the display type
    model.ts                     MST model: rpcDataMap, renderState, fetchNeeded, startRenderingBackend
    components/
      Canvas2DScoreRenderer.ts   extends Canvas2DPerRegionRenderingBackend; the SVG-export path too
      GpuScoreRenderer.ts        [GPU only] extends GpuPerRegionRenderingBackend; packs instances, writes uniforms
      ScoreDisplayComponent.tsx  React: DisplayChrome wrapping the canvas
      ScoreRendererFactory.ts    the factory DisplayChrome calls; picks GPU or Canvas2D
      drawScore.ts               pure draw function over a Ctx2D
      scoreTypes.ts              ScoreRenderState and the backend type
      shaders/
        score.slang              [GPU only] vertex + fragment for one pass; compiled by gen:shaders
  ScoreFeaturePanel/
    index.tsx                    adds a panel to the feature details widget
  ScoreRPC/
    GetScoreData.ts              worker: fetch features from the adapter, then pack
    buildScoreResult.ts          pure packer, unit-tested without a worker
    index.ts                     registers the RPC method
    rpcTypes.ts                  ScoreRegionData and the RPC arg types
```

<!-- EXAMPLE_PLUGIN_TREE END -->

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
compiles to both WGSL (WebGPU) and GLSL (WebGL2). Modules are referenced by bare
name (`import hpmath;`), not file path; the shared helpers live in
`packages/render-core/src/shaders/` (`hpmath` for the high-precision
genomic→pixel transform, `colorPack` for unpacking packed colors). The example
declares its uniforms inline; if several passes share a struct, put it in a
sibling module (`scoreUniforms.slang`, starting `module scoreUniforms;` with a
`public struct`).

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

Run the codegen after every edit. In your own repo:

```bash
pnpm add -D @jbrowse/shader-tools
npx jbrowse-build-shaders
```

It scans from the project root for `*.slang`, fetches a pinned `slangc` on first
use, and writes each `*.generated.ts` next to its source (`hpmath` / `colorPack`
resolve from your installed `@jbrowse/render-core`). Inside this repo the same
tool is `pnpm gen:shaders`.

One `.slang` file with entry points produces up to three modules, and **which
one you import from decides what your users download**. A bundler treats a
namespace import (`import * as shader from './score.generated.ts'`) as using
every export, so a module is included or excluded whole — whatever the smallest
eager consumer of a module wants, the always-loaded chunk pays for all of it.

| Module                      | Holds                                                             | Import it from                                                            |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `score.generated.ts`        | the compiled WGSL/GLSL strings, and a re-export of the other two  | the render path, which needs the shader source anyway                     |
| `score.iface.generated.ts`  | uniform + instance layout, the typed packers, `VERTEX_ATTRIBUTES` | code that packs or reads a buffer                                         |
| `score.consts.generated.ts` | the `//! export-consts` values, and nothing else                  | a state model, a hit test, a Canvas2D twin — anything that wants a number |

So a display model reading one threshold reaches for the `.consts.` module, not
the shader module that re-exports it. The table below is the union of the three.

What lands in `score.generated.ts`, and what a plugin imports from it:

<!-- SHADER_EXPORTS START -->

<!-- prettier-ignore -->
| Export | What it is |
| --- | --- |
| `INSTANCE_STRIDE_BYTES` | bytes per instance in the packed buffer |
| `INSTANCE_STRIDE_WORDS` | the same stride in 4-byte words |
| `INSTANCE_OFFSET_F32 / _U32 / _I32` | per-field word indices, one map per typed-array view; only the views the instance fields actually use are emitted |
| `InstanceArrays` | one input array per instance field, the argument `packInstances` takes |
| `packInstances` | interleaves parallel arrays into one instance buffer |
| `getInstance<Field>` | reads one instance field out of a packed buffer, through that field's own typed view |
| `setInstance<Field>` | writes one instance field into a packed buffer, through that field's own typed view |
| `getInstance<Field> (vector field)` | reads one component of a vector instance field; takes a component index |
| `setInstance<Field> (vector field)` | writes a whole vector instance field; takes one value per component |
| `setUniform<Field>` | writes one element of an array-valued uniform slot, through that field's own typed view; takes every component so an element cannot be half-written |
| `InstanceWriter` | append-at-a-time writer over the packed instance layout, for an encoder whose instance count is not known up front |
| `WGSL_SOURCE` | the compiled WGSL, when the shader targets wgsl |
| `GLSL_VERTEX` | the compiled WebGL2 vertex stage |
| `GLSL_FRAGMENT` | the compiled WebGL2 fragment stage |
| `BINDINGS` | every binding the shader declares, for HAL bind-group setup |
| `VERTS_PER_INSTANCE` | vertices per instance, from the shader's const of that name; the draw call reads it |
| `TOPOLOGY` | the primitive topology `vs_main` emits for, when the shader declares one |
| `BLEND_STATE` | the blend the fragment stage's output wants, when the shader declares one |
| `COMPUTE_ENTRY_POINT` | the compute entry point name, for a compute shader |
| `WORKGROUP_SIZE_X` | the compute workgroup width |
| `UNIFORMS_SIZE_BYTES` | size of the uniform block, the `uniformByteSize` a backend passes |
| `UNIFORM_OFFSET_F32 / _U32 / _I32` | per-field indices into the uniform scratch buffer, one map per view |
| `UNIFORM_SLOT_ARRAYS` | element counts for array-valued uniform slots |
| `Uniforms` | the uniform block as a TS interface, one field per shader uniform; `writeUniforms` takes it |
| `writeUniforms` | typed whole-block writer; the alternative to poking offsets |
| `VERTEX_ATTRIBUTES` | the vertex input layout, used by both HALs — WebGPU builds its GPUVertexBufferLayout from it, WebGL2 its VAO pointers |
| `TEXTURES` | texture bindings the shader declares |
| `(your shader's consts)` | every other `public static const` in the shader, lifted by name |

<!-- SHADER_EXPORTS END -->

Only what a given shader needs is emitted: no compute entry point for a
render-only shader, and an `*_OFFSET_*` map only for the typed-array views its
fields actually take.

Genomic positions travel as absolute `uint` attributes; convert them with the
`bpToClipX` wrapper above and nothing else. The `bpHi`/`bpLo` split it hides
exists because float32 can't represent every base past ~16.7 Mbp, and it stays
confined to that one line; in TypeScript outside uniform writes, use plain
`bp - bpStart`.

## Step 3: GPU renderer

The base class `GpuPerRegionRenderingBackend` owns the per-frame scaffold:
`resize`, `beginFrame`/`endFrame`, and the per-block scissor/viewport clip. It
also owns the upload, driven by the `regionPasses` you declare — each pass
carries the function that packs its instance buffer, so there is one place a
pass is named and no instance count to keep in agreement with the bytes.

You implement one method: `drawRegion`, which writes uniforms and issues the
draw pass for one already-clipped block.

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
import type { GpuHal } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const PASS = 'score'
const U = shader.UNIFORM_OFFSET_F32
const UU = shader.UNIFORM_OFFSET_U32

// A pass is its shader plus the function that fills its instance buffer. Six
// vertices per instance = two triangles, so the boxes need a triangle-list
// topology. Exported so the factory can hand the pass list to the HAL.
//
// You write no upload: the base class packs every pass in `regionPasses` and
// hands the bytes to the HAL, taking the instance count from the buffer's own
// length. Nothing to keep in agreement, and an empty pack releases the buffer.
export const SCORE_PASSES = [
  {
    ...slangPass({ id: PASS, mod: shader }),
    // the generated packInstances interleaves the parallel arrays into the
    // GL_ATTRIBUTES layout, no manual DataView offsets
    pack: (data: ScoreRegionData) =>
      shader.packInstances(
        { startBp: data.starts, endBp: data.ends, score: data.scores },
        data.numFeatures,
      ),
  },
]

export class GpuScoreRenderer extends GpuPerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
> {
  private uniformF32: Float32Array
  private uniformU32: Uint32Array
  protected regionPasses = SCORE_PASSES

  constructor(hal: GpuHal) {
    // the base allocates the reusable this.uniformData scratch buffer
    super(hal, shader.UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.uniformU32 = new Uint32Array(this.uniformData)
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
both unavailable.

It is not a GPU-specific artifact, so it is written once and unchanged here:
[Plotting features, Step 4](/docs/developer_guides/plotting_features#step-4-the-renderer)
builds `drawScore.ts` and `Canvas2DScoreRenderer.ts` in full. The only
difference on this path is the factory in Step 5 below, which now has a GPU
backend to prefer.

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
[architecture spec's upload patterns](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#upload-patterns),
the right shape when each region's data is independent (no cross-region layout
coupling).

The model is **identical** to the Canvas2D one, not merely similar:
[Plotting features, Step 3](/docs/developer_guides/plotting_features#step-3-the-mst-model)
builds it in full (`rpcDataMap`, `rpcProps`, `renderState`, `fetchNeeded`), and
none of it changes when a shader appears. The one action worth reading again
here is the render wiring:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#startRenderingBackend -->

```ts
// called once by DisplayChrome when the backend is created. Streams each
// region into the backend and draws every frame from renderState. This is
// the only part of the model that knows a backend exists, and it is
// identical whether that backend is the GPU or the Canvas2D one.
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
```

`installPerRegionLifecycle` wraps the lower-level
[`attachRenderingBackend`](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#the-core-contract)
contract, giving each region key its own upload autorun to avoid O(N²)
re-uploads as regions stream in. Only displays that lay features into Y-rows
_across_ regions (`LinearBasicDisplay`, alignments) need the whole-map
`laidOutDataMap` form instead.

Three settings buckets, and putting one in the wrong place is the common
mistake: `rpcProps()` refetches in the worker, so scroll and zoom must stay out
of it; `renderState` is recomputed per frame and refetches nothing; and a
setting that needs a main-thread buffer _re-encode_ but no refetch (a color, a
scale) goes in `gpuProps()` (see the
[`rpcProps()` / `gpuProps()` pattern](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#rpcprops--gpuprops-pattern)).

## Step 7: React component

The same component the Canvas2D path uses, unchanged —
[Plotting features, Step 5](/docs/developer_guides/plotting_features#step-5-the-react-component)
shows it in full. `DisplayChrome` creates the HAL via `useRenderingBackend`,
calls `model.startRenderingBackend(backend)` once the backend is live, and hands
back the `canvasRef` to attach to your `<canvas>`. Nothing in it knows whether
the factory resolved to a GPU or a Canvas2D backend, and its render-prop child
keeps it agnostic to how many canvases a display draws.

## Step 8: Register the display

In your plugin's `install()`, register the display type pointing at your model
factory and React component (see [](/docs/developer_guides/creating_display) for
the full registration pattern).

## The WebGL2 context ceiling

One display owns one backend canvas, and `WebGL2Hal` takes its own WebGL2
context with no pooling. Browsers cap how many a page may hold — 16 on Chrome —
and past that, eviction and re-acquisition cascade and wedge the main thread
rather than degrading. **A single ordinary view reaches it**: 17 GPU tracks on
one linear genome view. So budget contexts as one per open GPU track.

Chromosomes are free on this axis — a whole-genome view of one track is still
one canvas, with one GPU buffer per `displayedRegionIndex`.

View-level lazy mount and bounded auto-recovery in `useRenderingBackend` both
bound the problem rather than fixing it; tracks inside a mounted view are not
virtualized, so the ceiling stays reachable.

WebGPU has no per-canvas cap, because `gpuDevice.ts` shares one device across
displays. The trade is its mirror image: one `device.lost` takes down every
display at once. That makes triage easy — **one track broke points at WebGL2,
every track broke at once points at WebGPU**.

What each backend refuses to allocate is
[](/docs/developer_guides/memory#gpu-memory-is-guarded-per-object-not-per-session).

## Key invariants

- All worker output uses absolute genomic uint32 coordinates, not
  region-relative. float32 cannot hold 3 Gbp; use uint32 for positions crossing
  the worker boundary.
- `rpcProps` must not contain fetch results. `SettingsInvalidate` watches
  `rpcProps()`; putting derived cell data there creates an infinite fetch loop.
- Shader uniforms use CSS pixels: don't scale `canvas_width`/`canvas_height` by
  `devicePixelRatio` before writing them.
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

- [](/docs/developer_guides/dataflow)
- [](/docs/developer_guides/optimizations)
- [](/docs/developer_guides/memory)
- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/rpc_workers)
- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/svg_export)
- [GPU_CONTEXT_BUDGET.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_CONTEXT_BUDGET.md)
  — the WebGL2 context ceiling one display spends against, what reaches it, and
  the four fixes already measured and eliminated
