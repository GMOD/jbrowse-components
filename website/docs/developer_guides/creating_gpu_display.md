---
title: GPU displays
description:
  Build a display that renders with WebGPU/WebGL2 and falls back to Canvas2D
guide_category: Plugins
---

**TL;DR:** Build a display that renders via WebGPU/WebGL2 with a required
Canvas2D fallback: the same `defineDisplay` spec as
[](/docs/developer_guides/plotting_features), plus a `.slang` shader and a `gpu`
block naming its passes and uniforms. The factory tries WebGPU, then WebGL2,
then the `paint` you already wrote.

:::note

The scale-up path, for roughly ≳100K features per frame. Start from
[](/docs/developer_guides/plotting_features) otherwise; it builds the same
plugin without the shader, so moving up later adds a block rather than changing
one.

`@jbrowse/display-kit`, `@jbrowse/render-core` and `@jbrowse/shader-tools`
**first publish in the next release**. Until then, author against a
`jbrowse-components` checkout and copy the emitted `*.generated.ts` into your
plugin. All three land `@experimental`, so pin an exact version and expect to
rebuild on upgrade. `render-core`'s GPU surface is static-import-only, which is
what makes a GPU display a
[build-step plugin](/docs/developer_guides/simple_plugin).

:::

## Architecture overview

JBrowse GPU displays follow a three-layer model:

<Figure caption="The whole idea, before any of the machinery. The worker sends the data to the GPU when the region changes, and it stays there; every frame after that just redraws what the GPU already holds. Panning, zooming and recoloring never refetch or reparse — that is what makes a GPU display different from a Canvas2D one, and everything named in the next figure exists to keep it true." src="/img/gpu_display_tldr.png" />

<Figure caption="Two autoruns, each with its own trigger: one upload autorun on any rpcDataMap entry changing, which diffs the map and uploads what moved, and a render autorun on renderTick or a frame-level change like scroll. Every upload calls renderNow(), which bumps renderTick and closes the loop; a draw that reports it painted also flips canvasDrawn, which readiness testids and DisplayChrome wait on." src="/img/gpu_display_lifecycle.png" />

The factory keeps two autoruns running at all times (owned by
`RenderLifecycleMixin`, installed through `installUpload`):

- One upload autorun fires when any `rpcDataMap` entry or the backend changes;
  it diffs the map against what it last sent and uploads only the regions that
  moved, packing each through your pass's `pack`. That diff keeps a streaming
  whole-genome fetch at O(N) uploads instead of O(N²).
- The render autorun fires when `renderTick` bumps (after every upload) or when
  frame-level state like scroll position or a `frame` param changes; it draws
  every visible block with your `uniforms`.

The backend is a HAL (Hardware Abstraction Layer) that dispatches to WebGPU,
WebGL2, or Canvas2D at runtime. Your `gpu` block talks to the HAL through the
factory, never to WebGPU or WebGL2 directly. See the
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#gpu-rendering-architecture)
for the full lifecycle and `packages/render-core/CLAUDE.md` for HAL invariants.

For real references, `plugins/gwas/src/LinearManhattanDisplay/` is the simplest
per-region streamed case, written without the factory: its
`GpuManhattanRenderer.ts` is the class the factory composes from a `gpu` block.
`plugins/canvas/src/LinearBasicDisplay/` is the fullest (four shader passes) but
uses the whole-map `laidOutDataMap` form for cross-region layout, so start from
Manhattan when your regions are independent.
[](/docs/developer_guides/plotting_features) lists the rest.

## Files to create

The same `example-plugins/score-example/` the Canvas2D guide builds. The shader
is the one new file; the `gpu` block goes in the display file that already
exists:

<!-- EXAMPLE_PLUGIN_TREE START -->

```
src/
  index.ts            the plugin class; installs the display and the feature panel
  scoreDisplay.ts     the whole display: settings, worker fetch, painter, shader passes
  ScoreFeaturePanel/
    index.tsx         adds a panel to the feature details widget
  shaders/
    score.slang       [GPU only] vertex + fragment for one pass; compiled by gen:shaders
```

<!-- EXAMPLE_PLUGIN_TREE END -->

## Write the shader

Create a `.slang` file. JBrowse uses a Slang-derived shader language that
compiles to both WGSL (WebGPU) and GLSL (WebGL2). Modules are referenced by bare
name (`import hpmath;`), not file path; the shared helpers live in
`packages/render-core/src/shaders/` (`hpmath` for the high-precision
genomic→pixel transform, `colorPack` for unpacking packed colors). The example
declares its uniforms inline; if several passes share a struct, put it in a
sibling module (`scoreUniforms.slang`, starting `module scoreUniforms;` with a
`public struct`).

<!-- include: example-plugins/score-example/src/shaders/score.slang -->

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
the shader module that re-exports it.

What lands in `score.generated.ts`, and what a plugin imports from it. It
re-exports the other two modules, so the table below is the union of all three:

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

## The gpu block

A `GpuSpec` is three things: the generated shader module, the passes packed from
one region's payload, and the uniforms one clipped block draws with.

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#gpu -->

```ts
// The optional accelerator: one pass whose instance buffer the generated
// `packInstances` interleaves from the region's arrays, and the uniforms one
// clipped block draws with. `bpRangeXTuple` carries the hp-split genomic ->
// clip transform, negated on a reversed block, so the shader needs no
// reversed flag of its own.
export const scoreGpu: GpuSpec<ScoreRegionData, ScoreParams, shader.Uniforms> =
  {
    shader,
    passes: [
      {
        ...slangPass({ id: 'score', mod: shader }),
        pack: data =>
          shader.packInstances(
            { startBp: data.starts, endBp: data.ends, score: data.scores },
            data.numFeatures,
          ),
      },
    ],
    uniforms: (
      block,
      clip,
      _region,
      { canvasWidth, canvasHeight, params },
    ) => ({
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      zero: 0,
      canvasWidth,
      canvasHeight,
      color: cssColorToABGR(params.color),
    }),
  }
```

- **`shader`** is the namespace import of `score.generated.ts`. The factory
  reads `UNIFORMS_SIZE_BYTES` and `writeUniforms` off it, so the uniform block
  is typed by the generated `Uniforms` interface and a field the shader dropped
  fails to compile here.
- **`passes`** is one entry per pipeline. `slangPass` builds the
  `PipelineDescriptor` from the module (its sources, `VERTS_PER_INSTANCE`,
  `VERTEX_ATTRIBUTES`), and `pack` fills that pass's instance buffer from one
  region's payload through the generated `packInstances`, so there are no manual
  `DataView` offsets. The instance count is the buffer's own length: nothing to
  keep in agreement with the bytes, and an empty pack releases the buffer.
- **`uniforms`** runs once per clipped block per frame. `bpRangeXTuple` gives
  the hp-split genomic→clip transform, negated on a reversed block, so the
  shader needs no `reversed` flag. `canvasWidth` and `canvasHeight` are CSS
  pixels; the factory owns `devicePixelRatio`. `params` is every setting
  resolved, so a `frame` param such as the color reaches the shader without a
  refetch.

Then name it in the spec:

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#define -->

```ts
export const LinearScoreDisplay = defineDisplay({
  name: 'LinearScoreDisplay',
  displayName: 'Score display (example)',
  trackType: 'FeatureTrack',
  params,
  data: fetchScoreData,
  paint: drawScoreBlocks,
  gpu: scoreGpu,
})
```

With `gpu` set, the factory's backend factory goes through
`createRenderingBackend`, which tries WebGPU, then WebGL2, and falls back to a
Canvas2D backend over `paint` when no GPU device is available. Without it the
factory builds the Canvas2D backend alone. Everything else, `params`, `data`,
`paint`, the `install`, is unchanged from
[](/docs/developer_guides/plotting_features).

## Canvas2D is still required

`paint` does not go away when a shader arrives. Canvas2D is
[the floor every display must ship](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#canvas2d-is-the-floor-gpu-is-the-optional-accelerator):
**SVG export runs the Canvas2D path**, and the GPU shader is the optional
accelerator layered on top. The Canvas2D backend also runs when WebGPU and
WebGL2 are both unavailable.
[Plotting features](/docs/developer_guides/plotting_features#paint) builds
`drawScoreBlocks` in full; the GPU path adds to it and changes none of it.

## Settings and what they invalidate

The three settings buckets of the
[`rpcProps()` / `gpuProps()` pattern](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#rpcprops--gpuprops-pattern)
are the three values of `affects` on a param:

- **`fetch`** refetches in the worker, so scroll and zoom must stay out of it.
- **`frame`** reaches `uniforms` and `paint` on the next draw and refetches
  nothing.
- **`encode`** marks a setting the main-thread buffer packing reads rather than
  the worker, the bucket a hand-written display spells as `gpuProps()`. This
  display has none: its `pack` reads only the region's payload.

This is the **per-region streamed** upload pattern from the
[architecture spec's upload patterns](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#upload-patterns),
the right shape when each region's data is independent. Only displays that lay
features into Y-rows _across_ regions (`LinearBasicDisplay`, alignments) need
the whole-map form, which the spec does not offer; they hand `installUpload` a
computed map by hand.

## The WebGL2 context ceiling

One display owns one backend canvas, and `WebGL2Hal` takes its own WebGL2
context with no pooling. Browsers cap how many a page may hold — 16 on Chrome —
and past that, eviction and re-acquisition cascade and wedge the main thread
rather than degrading. **A single ordinary view reaches it**: 17 GPU tracks on
one linear genome view. So budget contexts as one per open GPU track.

Chromosomes are free on this axis — a whole-genome view of one track is still
one canvas, with one GPU buffer per `displayedRegionIndex`.

View-level lazy mount and bounded auto-recovery in `useRenderingBackend` bound
the problem; tracks inside a mounted view are not virtualized, so the ceiling
stays reachable.

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
- A `fetch` param is a setting, never a fetch result. The factory derives the
  RPC cache key from the `fetch` set and nothing else, which is what keeps a
  derived value out of the key and the fetch loop it would cause.
- Shader uniforms use CSS pixels: don't scale `canvasWidth`/`canvasHeight` by
  `devicePixelRatio` before writing them.
- Never edit `*.generated.ts`. Always edit `.slang` and run `pnpm gen:shaders`;
  CI enforces this with `git diff --exit-code`.
- Keep `pack` and `uniforms` pure. The model's `rpcDataMap` is the single source
  of truth and is what `pack` is called over; GPU buffer lifecycle is the HAL's
  (`hal.pruneRegions(active)`), so nothing in the spec caches a region.
- The canvas renders through `DisplayChrome`, which the factory's component
  does; a display with a component of its own still goes through it rather than
  calling `useRenderingBackend` directly.

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
