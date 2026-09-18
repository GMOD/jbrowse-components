---
title: GPU displays
description:
  Write a shape of your own when no shared one fits, and declare it as a mark
  the WebGPU, WebGL2 and Canvas2D backends all draw
guide_category: Plugins
---

A display declares what it draws as a list of **marks**. A mark binds a shape to
the display's payload and render state. `createMarkBackend` turns the list into
the WebGPU, WebGL2 and Canvas2D backends, and the Canvas2D painter also produces
the SVG export. You write a new **shape** only when no shared shape fits. A
shape consists of one `.slang`, one uniform write, one Canvas2D painter and one
hit test, all reading one set of channel arrays. The sections below write one.

:::note

To plot a field of a feature file as a bar, point or span, add a `marks` entry
on [`LinearMarkDisplay`](/docs/config_guides/mark_display), with no plugin. The
shape below reads the same worker channels. Start from
[](/docs/developer_guides/plotting_features), which builds the same plugin: the
fetch chain, the model, the mark list and the component. The steps below replace
only the shape that guide names. If `spanMark`, `pointMark` or `barMark` draws
your data, you need none of the steps below.

`@jbrowse/render-core` and `@jbrowse/shader-tools` are on npm. Both are
`@experimental`: a plugin's build reads `render-core` off the host rather than
bundling it, so build against the version your JBrowse release ships and expect
to rebuild on upgrade. Shaders compile at build time, which makes a GPU display
a [build-step plugin](/docs/developer_guides/simple_plugin).

:::

## Architecture overview

<Figure caption="The worker sends the data to the GPU when the region changes, and the data stays on the GPU. Every later frame redraws what the GPU already holds, so, unlike in a Canvas2D display, panning and zooming never refetch or reparse. The machinery in the next figure keeps panning and zooming that way." src="/img/gpu_display_tldr.png" />

<Figure caption="The three dashed lines mark where a change re-enters the pipeline: rpcProps() above the worker, gpuProps() at the upload autorun, and everything else at the frame. The stages below a line are the cost of that change. Every upload calls renderNow(), which bumps renderTick and closes the loop. A draw that reports it painted flips canvasDrawn, which readiness testids and DisplayChrome wait on." src="/img/gpu_display_lifecycle.png" />

The model keeps two autoruns running at all times (owned by
`RenderLifecycleMixin`, installed by `installUpload`):

- The upload autorun fires when any `rpcDataMap` entry or the backend changes.
  It diffs the map against what it last sent and calls `backend.upload()` only
  for regions that changed. The diff keeps a streaming whole-genome fetch at
  O(N) uploads instead of O(N²).
- The render autorun fires when `renderTick` bumps (after every upload) or when
  frame-level state like scroll position changes. It calls
  `backend.renderBlocks()`.

The backend is a HAL (Hardware Abstraction Layer) that dispatches to WebGPU,
WebGL2, or Canvas2D at runtime. Your shape talks to the HAL through its mark,
never to WebGPU or WebGL2 directly. See the
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#gpu-rendering-architecture)
for the full lifecycle and `packages/render-core/CLAUDE.md` for HAL invariants.

## Shapes and marks

A **shape** (`MarkShape<TChannels, TParams>`) defines geometry and picking in
four members, and all four read the same channel arrays:

- `pass` — the `.slang` shader and the packer that fills its instance buffer
- `writeUniforms` — what reaches the GPU per block
- `paintBlock` — the Canvas2D painter, which is also the SVG export
- `ink` — the box each instance paints. render-core turns it into the hit test
  for hover and click, and the chrome turns it into the hover highlight

A **mark** (`defineMark({ shape, channels, params })`) binds a shape to one
display. `channels` names which of the payload's arrays feed which lane, and
`params` names which of the render state's values reach the uniforms. Both
functions only select fields and compute nothing.

Two shapes are shared. A display that draws with one of them writes no shader,
no painter and no hit test:

- **`spanMark`** — a coloured rectangle from `x` to `x2` on the band of `row`.
  Features laid into rows, MAF's alignment cells, anything that is a box on a
  row.
- **`pointMark`** — a glyph (disc, triangle, diamond) at `x` on a linear
  `domain` of `y`, widening to a bar where `x2 - x` is wider than the glyph. A
  scatter plot, Manhattan's points, any datum placed by a value.

`plugins/gwas/src/LinearManhattanDisplay/manhattanMarks.ts` holds all of
Manhattan's drawing, over `pointMark`. The example's score box spans start to
end and grows up from the bottom to its value. It is neither a row band nor a
glyph, so the example writes a new shape. A shape moves into `render-core` once
two displays share it. Until then it stays beside the display that declares it,
so the score shape goes there.

## Files to create

The files are the same `example-plugins/score-example/` that the plotting guide
builds. Every file serves both backends. The shape and its shader get more
detail in the steps below:

<!-- EXAMPLE_PLUGIN_TREE START -->

```
src/
  index.ts                       the plugin class; installs the display, the RPC method and the feature panel
  LinearScoreDisplay/
    configSchema.ts              config slots (color, scoreColumn)
    findScoreHit.ts              the display's hit: `nearestMarkHit` asks the mark's `hitNearest`, which its `ink` implies, about every instance under the cursor
    index.ts                     registers the display type; the model and the component both load lazily
    model.ts                     MST model: rpcDataMap, renderState, fetchNeeded, startRenderingBackend, renderSvg
    renderSvg.tsx                SVG export: the mark list painted through renderDisplaySvg
    scoreMark.ts                 the `score` shape: score.slang's pass, its uniform write, and the placement its painter (also the SVG export) and its ink (the hit test and the highlight) both read
    scoreMarks.ts                ScoreRenderState, the mark list (one `score` mark over the RPC payload) and the backend type
    components/
      ScoreDisplayComponent.tsx  React: DisplayChrome wrapping the canvas; builds the backend from the mark list
    shaders/
      score.slang                the `score` shape's shader: one box per feature, compiled by gen:shaders
  ScoreFeaturePanel/
    index.tsx                    adds a panel to the feature details widget
  ScoreRPC/
    GetScoreData.ts              worker: fetch features from the adapter, then encode
    index.ts                     registers the RPC method
    rpcTypes.ts                  ScoreRegionData and the RPC arg types
```

<!-- EXAMPLE_PLUGIN_TREE END -->

## Step 1: Define data types

The worker sends one payload per region, and the payload is the encoder's
channels. A config-declared mark reads the same arrays, in absolute genomic
uint32:

<!-- include: example-plugins/score-example/src/ScoreRPC/rpcTypes.ts#region-data -->

```ts
// One region's worth of features as the encoder packs them: parallel typed
// arrays, `x`/`x2` absolute genomic uint32 (never region-relative, so they
// cross the worker boundary without precision loss) and `y` the raw score,
// plus the score extremes. The shape reads the arrays under these names.
export type ScoreRegionData = Encoded<'y'>
```

The model recomputes the render state cheaply every frame. The model resolves
the colour once, to the packed form the shader's uniform takes. A shape takes
packed colours and the display resolves them, so the uniform write and the
painter receive the same number. The model also computes the domain. The encoder
ships each region's score extremes, and the model folds them into the one
`[min, max]` that places every region's boxes:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMarks.ts#render-state -->

```ts
// Recomputed cheaply every frame without fetching: the canvas dimensions
// (required, to size the backing store) plus what the drawing reads
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  // packed ABGR (`cssColorToABGR`), resolved once in the model so both backends
  // are handed the same number
  color: number
  // the score range the boxes are placed through, from the loaded regions'
  // extremes, so a box's height means the same in every region
  domainY: [number, number]
}
```

## Step 2: Write the shader

Create a `.slang` file. JBrowse uses a Slang-derived shader language that
compiles to both WGSL (WebGPU) and GLSL (WebGL2). Modules are referenced by bare
name (`import hpmath;`), not file path. The shared helpers are in
`packages/render-core/src/shaders/`:

- `hpmath` for the high-precision genomic→pixel transform
- `colorPack` for unpacking packed colors
- `valueScale` for placing a value on a `[min, max]` domain. The library's
  `point` and `bar` shapes read this scale, and the example combines it with its
  box's anchor at the canvas bottom

`packages/render-core/src/shaders/` also holds the shared _shapes_ (`capsule`,
`rowRect`, `pointGlyph`, `diagonalGrid`). Each carries a mark's geometry
together with its antialias contract.
[The shader shape library](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SHADER_SHAPE_LIBRARY.md)
lists what each shape draws, who imports it, and which parts are deliberately
not shared. The example declares its uniforms inline. If several passes share a
struct, put it in a sibling module (`scoreUniforms.slang`, starting
`module scoreUniforms;` with a `public struct`).

The shader defines the geometry **once**: how tall a box is, and how narrow one
may paint. `//! js-export` lifts a function into a TypeScript twin, and
`//! export-consts` lifts a constant. The painter and the hit test in Step 3
import those twins and do not repeat the arithmetic:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/shaders/score.slang -->

```slang
// The score shape: one box per instance, spanning x->x2 and grown up from the
// canvas bottom to its score on the shared value scale, every box in the one
// uniform ABGR color. The box height is written here once and lifted into a
// TypeScript twin, which the painter and the hit test read.
//! targets: wgsl, glsl
//! export-consts: MIN_WIDTH_PX
//! js-export: scoreBarHeightPx

import hpmath;
import colorPack;
import valueScale;

public static const uint VERTS_PER_INSTANCE = 6u;

// Narrowest a box paints, in CSS px, so a 1bp feature still shows at
// chromosome zoom. Both backends floor at this constant.
static const float MIN_WIDTH_PX = 1.0;

struct ScoreInstance {
  uint  x  : ATTR0;
  uint  x2 : ATTR1;
  float y  : ATTR2;
};

struct Uniforms {
  // hpmath genomic->clip transform (hi, lo, +/-clippedLengthBp)
  float3 bpRangeX;
  float  zero;
  // CSS px of the block column clip space spans, not the whole canvas
  float  viewportWidth;
  float  canvasHeight;
  // the [min, max] a score is placed through, set by the display from the
  // loaded regions' extremes so every region's boxes share one scale
  float  domainMin;
  float  domainMax;
  uint   color;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

// valueScale's valueToYPx is the scale the library's own `point` and `bar`
// shapes read; the box's anchor — its foot on the canvas bottom — is this
// shape's own.
float scoreBarHeightPx(float score, float domainMin, float domainMax, float canvasHeight) {
  return canvasHeight - valueToYPx(score, domainMin, domainMax, canvasHeight);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(ScoreInstance inst, uint vid : SV_VertexID) {
  // quadLocal maps the 6 vertices to the corners of a unit box: x/y each 0 or 1.
  float2 local = quadLocal(vid);

  float x1 = bpToClipX(inst.x, u);
  float x2 = bpToClipX(inst.x2, u);
  // reversal-safe: it is baked into bpRangeX's negated length, so x2 < x1 on a
  // reversed block and the widening grows the same way
  x2 = extendToMinWidthX(x1, x2, MIN_WIDTH_PX, u.viewportWidth);
  float x = local.x < 0.5 ? x1 : x2;

  float barHeightPx = scoreBarHeightPx(inst.y, u.domainMin, u.domainMax, u.canvasHeight);
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

`jbrowse-build-shaders` scans from the project root for `*.slang`, fetches a
pinned `slangc` on first use, and writes each `*.generated.ts` next to its
source (`hpmath` / `colorPack` resolve from your installed
`@jbrowse/render-core`). Inside this repo the same tool is `pnpm gen:shaders`.

One `.slang` file with entry points produces up to four modules, and **which
module you import determines what your users download**. A bundler treats a
namespace import (`import * as shader from './score.generated.ts'`) as using
every export, so it includes or excludes a module whole. If any eager code
imports a module, even for one value, the always-loaded chunk carries the whole
module.

| Module                      | Holds                                                             | Import it from                                                            |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `score.generated.ts`        | the compiled WGSL/GLSL strings, and a re-export of the next two   | the shape, which needs the shader source anyway                           |
| `score.iface.generated.ts`  | uniform + instance layout, the typed packers, `VERTEX_ATTRIBUTES` | code that packs or reads a buffer                                         |
| `score.consts.generated.ts` | the `//! export-consts` values, and nothing else                  | a state model, a hit test, a Canvas2D twin — anything that wants a number |
| `score.js.generated.ts`     | the `//! js-export` functions as scalar TypeScript                | the painter and the hit test, which run the shader's own math             |

A display model that reads one threshold should therefore import the `.consts.`
module, not the shader module that re-exports it.

The table below says what lands in `score.generated.ts` and what a plugin
imports from it. That module re-exports the interface and consts modules, so the
table is the union of all three:

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
| `COVERAGE` | 'analytic' when the shader declares that its fragments compute their own coverage, so a display registering only such passes allocates no MSAA target |
| `COMPUTE_ENTRY_POINT` | the compute entry point name, for a compute shader |
| `WORKGROUP_SIZE_X` | the compute workgroup width |
| `WORKGROUP_SIZE_Y` | the compute workgroup height, for a kernel dispatched over a 2D grid |
| `UNIFORMS_SIZE_BYTES` | size of the uniform block; `slangPass` carries it onto the descriptor |
| `UNIFORM_OFFSET_F32 / _U32 / _I32` | per-field indices into the uniform scratch buffer, one map per view |
| `UNIFORM_SLOT_ARRAYS` | element counts for array-valued uniform slots |
| `Uniforms` | the uniform block as a TS interface, one field per shader uniform; `writeUniforms` takes it |
| `writeUniforms` | typed whole-block writer; the alternative to poking offsets |
| `VERTEX_ATTRIBUTES` | the vertex input layout, used by both HALs — WebGPU builds its GPUVertexBufferLayout from it, WebGL2 its VAO pointers |
| `TEXTURES` | texture bindings the shader declares |
| `(your shader's consts)` | every other `public static const` in the shader, lifted by name |

<!-- SHADER_EXPORTS END -->

The generator emits only what a given shader needs: no compute entry point for a
render-only shader, and an `*_OFFSET_*` map only for the typed-array views its
fields actually take.

Genomic positions travel as absolute `uint` attributes. Convert them only with
the `bpToClipX` wrapper above. The wrapper hides a `bpHi`/`bpLo` split, which is
needed because float32 can't represent every base past ~16.7 Mbp, and keeps the
split in that one line. In TypeScript outside uniform writes, use plain
`bp - bpStart`.

## Step 3: The shape

A shape takes two inputs. Its channels are parallel typed arrays plus a count,
and its params are everything else the drawing needs. A shape names its lanes in
the library's vocabulary: `x`, `x2`, `y` or `row`, `color`, plus any names
specific to the shape. The display's payload can name its arrays differently,
because `channels` on the mark maps one set of names to the other. The file
below defines the placement function that two members share, then the four
members. A shape has no constructor. It is an object literal, admitted by having
a consumer and not by completeness.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMark.ts -->

```ts
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import {
  bpProjection,
  projectBp,
  spanLeft,
} from '@jbrowse/render-core/canvas2dUtils'
import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'
import { scoreBarHeightPx } from './shaders/score.js.generated.ts'

import type { BpProjection } from '@jbrowse/render-core/canvas2dUtils'
import type { MarkFrame, MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The shape's lanes, in the shape library's vocabulary (`x`, `x2`, `y`):
// parallel typed arrays plus a count. The encoder's payload carries these
// names, so the mark's channel lens is the identity.
export interface ScoreChannels {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  count: number
}

// Everything else the drawing needs, reaching the GPU as uniforms and the
// painter as arguments
export interface ScoreParams {
  // packed ABGR (`cssColorToABGR`), the form the shader's uniform takes; the
  // painter unpacks it
  color: number
  // the [min, max] a score is placed through
  domain: [number, number]
}

// What one block fixes for every instance, beside the box `placeScore` writes
// for one of them
interface ScoreFrame extends BpProjection {
  canvasHeight: number
  domainMin: number
  domainMax: number
  left: number
  top: number
  width: number
  height: number
}

function scoreFrame(
  block: RenderBlock,
  frame: MarkFrame,
  params: ScoreParams,
): ScoreFrame {
  const { originPx, startBp, spanBp, signedSpanPx } = bpProjection(block)
  return {
    originPx,
    startBp,
    spanBp,
    signedSpanPx,
    canvasHeight: frame.canvasHeight,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  }
}

// One box per instance: x..x2 wide, grown up from the canvas bottom to its
// score on the value scale. The painter and the ink both place through here,
// and the shader owns the geometry: its generated twin (`scoreBarHeightPx`)
// and constant (`MIN_WIDTH_PX`), so the three cannot drift.
function placeScore(c: ScoreChannels, g: ScoreFrame, i: number) {
  const xa = projectBp(g, c.x[i]!)
  const xb = projectBp(g, c.x2[i]!)
  const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
  const height = scoreBarHeightPx(
    c.y[i]!,
    g.domainMin,
    g.domainMax,
    g.canvasHeight,
  )
  g.left = spanLeft(xa, xb, width)
  g.top = g.canvasHeight - height
  g.width = width
  g.height = height
}

export const scoreMark: MarkShape<ScoreChannels, ScoreParams> = {
  id: 'score',
  pass: {
    ...slangPass({ id: 'score', mod: shader }),
    // the generated packInstances interleaves the parallel arrays into the
    // shader's instance layout; the instance count is the buffer's own
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      // the hp-split genomic->clip transform, negated on a reversed block
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      zero: 0,
      // CSS px, so the min-width floor is a CSS pixel on every DPR
      viewportWidth: clip.scissorW,
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      color: params.color,
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const g = scoreFrame(block, frame, params)
    ctx.fillStyle = abgrToCssRgba(params.color)
    for (let i = 0; i < channels.count; i++) {
      placeScore(channels, g, i)
      ctx.fillRect(g.left, g.top, g.width, g.height)
    }
  },

  // The rect `paintBlock` fills. render-core derives the hit test from it —
  // distance 0 inside the box, the nearest edge outside — and the chrome's
  // highlight lights it for the hovered instance
  ink(channels, block, frame, params, i) {
    const g = scoreFrame(block, frame, params)
    placeScore(channels, g, i)
    return { left: g.left, top: g.top, width: g.width, height: g.height }
  },
}
```

What each member is held to:

- **`pass`** is `slangPass` over the generated module plus a `pack`. The
  instance count comes from the buffer size: a packer that allocates
  `n * INSTANCE_STRIDE_BYTES` has stated `n`. A region with nothing to draw
  releases its buffer through an empty pack.
- **`writeUniforms`** uses the generated packer (`shader.writeUniforms`), which
  writes every field. The scratch buffer outlives the frame, so a field left out
  of a manual offset write would redraw with last frame's value. The `bpRangeX`
  triple comes from `bpRangeXTuple`, never by hand, because it carries the
  reversed pivot and a hand-written pivot is where the bugs come from. Widths
  are CSS px (`clip.scissorW`, the block column), so a min-width floor is one
  CSS pixel on every DPR.
- **`placeScore`** places one instance. The painter and the ink both call it, so
  the box geometry is written once. It reads the per-block values from a frame.
  `bpProjection(block)` and `projectBp` mirror bp→px on a reversed block the
  same way the negated `bpRangeX` does. `spanLeft` grows a widened span away
  from its anchor in both orientations.
- **`paintBlock`** is the Canvas2D fallback **and the SVG export**. Both a real
  2D context and the SVG context satisfy the context type it takes
  (`MarkContext2D`).
- **`ink`** returns the rect the painter fills for one instance, or undefined
  for an instance the painter skips. render-core derives `hitNearest` from it.
  `inkOnRect` reports the point of the box nearest `(x, y)` and the distance,
  and `nearestInk` keeps the closest. Only a strictly nearer candidate replaces
  the best, so a caller iterating back to front gets the mark on top. The
  display chooses the candidate set: every instance, or the instances a spatial
  index returned. A shape declares `hitNearest` itself when its ink is not a box
  (a ribbon, an arc), or when its hit rule differs from its box (`point`, where
  a cluster of glyphs resolves to the nearest centre).

A shape can also define two optional members.
`paintsBlock(block, frame, params)` is a draw predicate, and both backends and
the hit test skip a block when it returns false. Use it for a setting that turns
a layer off, or a marker that exists only at a canvas edge. `texture` on the
mark declares a 256-entry colour ramp that the pass samples.

## Step 4: The mark list

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMarks.ts#marks -->

```ts
// Which of the payload's arrays feed which of the shape's lanes, and which
// render-state values reach its uniforms: two lenses, run once per block per
// frame. The encoder's payload already carries the shape's lane names, so the
// channel lens is the payload itself. Everything that draws comes from the
// shape.
export const SCORE_MARKS = [
  defineMark({
    shape: scoreMark,
    channels: (d: ScoreRegionData) => d,
    params: (s: ScoreRenderState) => ({ color: s.color, domain: s.domainY }),
  }),
]
```

`channels` may return `undefined` for a region where the mark has nothing to
draw, so one list can serve a display whose cells are a union. `defineMark` has
three more options, used by shapes in the tree: `bufferOf` for a mark that draws
from another mark's uploaded buffer, `texture` for the ramp above, and `band`
for a display that stacks strips on one canvas. A first shape needs none of
them.

## Step 5: The parity gate

The painter and the ink each describe where an instance paints, and a change to
one can leave the other out of date. `sweepMarkAgainstHit` takes a mark, so the
test binds the shape to fixed params with `defineMark`. The sweep paints a block
into a recording context and checks `ink` against what the painter drew: the
painting lies inside the box, and every edge of the box is within a pixel of the
painting. It then walks the block in half-pixel steps and checks the hit test
against both. A point on a box returns that box, a hit's `x`/`y` lies inside the
box it names, and no answer is nearer than its painting. Run the sweep in both
orientations:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMark.test.ts -->

```ts
import { defineMark } from '@jbrowse/render-core/marks'
import { sweepMarkAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'

import { scoreMark } from './scoreMark.ts'

import type { ScoreChannels } from './scoreMark.ts'

// 1000 bp over 200 px, so the 1 bp box is a fifth of a pixel and takes the
// MIN_WIDTH_PX floor; the first two boxes overlap and the tallest is full
// height, which puts its top on the canvas edge.
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 20,
  screenEndPx: 220,
  reversed: false,
}

const frame = { canvasWidth: 240, canvasHeight: 60 }

const channels: ScoreChannels = {
  x: Uint32Array.from([100, 300, 500, 900]),
  x2: Uint32Array.from([400, 450, 501, 1000]),
  y: Float32Array.from([0.5, 0.25, 1, 0.1]),
  count: 4,
}

// The draw-against-hit gate: every point the painter inked answers the box it
// is on, a hit's ink lies on its box, and no answer is nearer than the box. In
// both orientations, at containment and with a grab radius.
describe('score: every drawn box answers its own hit', () => {
  for (const reversed of [false, true]) {
    for (const maxDistSq of [Number.MIN_VALUE, 16]) {
      test(`reversed ${reversed}, bound ${maxDistSq}`, () => {
        expect(
          sweepMarkAgainstHit(
            defineMark({
              shape: scoreMark,
              channels: (c: ScoreChannels) => c,
              params: () => ({ color: 0xff0000ff, domain: [0, 1] }),
            }),
            channels,
            { ...block, reversed },
            frame,
            { maxDistSq },
          ),
        ).toEqual([])
      })
    }
  }
})
```

`scoreMarks.test.ts` beside it is the mark-level suite. It tests which payload
array reaches which lane, the uniforms a block writes through `MockHal`, what
the painter draws for one feature, and what the display's hit test returns. The
two suites together replace the pixel comparison that a GPU-vs-Canvas2D check
would otherwise need.

## Step 6: MST model

Compose `MultiRegionDisplayMixin` (which includes `RenderLifecycleMixin` and the
fetch autoruns), store the worker output in an `rpcDataMap`, and wire the render
lifecycle with `installUpload`. This is the **per-region streamed** upload
pattern from the
[architecture spec's upload patterns](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#upload-patterns),
which fits when each region's data is independent (no cross-region layout
coupling).

[Plotting features, Step 3](/docs/developer_guides/plotting_features#step-3-the-mst-model)
builds this model in full (`rpcDataMap`, `rpcProps`, `renderState`,
`fetchNeeded`). The model names no shape and no shader. Its one action that
touches the backend is:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#startRenderingBackend -->

```ts
// called once by DisplayChrome when the backend is created, and again
// after a context loss. One installer streams each region into the
// backend and draws every frame from renderState; it is the only part of
// the model that knows a backend exists, and it is the same whether that
// backend is the GPU or the Canvas2D one.
startRenderingBackend(backend: ScoreRenderingBackend) {
  installUpload(self, backend, {
    cells: () => self.rpcDataMap,
    render: b =>
      b.renderBlocks(
        self.renderBlocks,
        self.rpcDataMap,
        self.renderState,
      ),
  })
},
```

`installUpload` wires the
[render lifecycle](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#the-core-contract)
for you. It remembers what it last sent for each key and uploads only what
changed, so N regions streaming in cost N uploads rather than N². The key is
whatever your map is keyed by. Here it is a `displayedRegionIndex`. On a canvas
several displays share, it is a sibling display's `sharedBackendKey`. On a
display that holds one payload for the whole view, it is a slot name
(`oneCell('data', payload)`). Only displays that lay features into Y-rows
_across_ regions (`LinearBasicDisplay`, alignments) pass a whole-map computed in
place of the raw `rpcDataMap`.

If an encode needs more than the region's data, such as a color scheme or a
scale, declare that value as `inputs`. A change to `inputs` re-encodes every
loaded region. Reading the value inside `encode` does not work, because the
helper invalidates only on `inputs` and on the region's data.

Three settings buckets (see the
[`rpcProps()` / `gpuProps()` pattern](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#rpcprops--gpuprops-pattern)):

- **`rpcProps()`** refetches in the worker, so scroll and zoom must stay out of
  it.
- **`renderState`** is recomputed per frame and refetches nothing.
- **`gpuProps()`** holds a setting that needs a main-thread buffer _re-encode_
  but no refetch, such as a color or a scale.

## Step 7: React component

`DisplayChrome` creates the backend through `useRenderingBackend`, calls
`model.startRenderingBackend(backend)` once it is live, and hands back the
`canvasRef` to attach to your `<canvas>`. The factory it takes is the only
import on the mark path that reaches the HAL:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/ScoreDisplayComponent.tsx#factory -->

```ts
// The only import on the mark path that reaches the HAL. It lives here, on the
// lazily loaded component, and not in the model: a state model is eager, so
// naming the backend there would load the GPU stack at plugin install.
// createMarkBackend tries WebGPU, then WebGL2, then Canvas2D, and every backend
// walks the same mark list.
function createScoreBackend(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, SCORE_MARKS)
}
```

`@jbrowse/render-core/marks/backend` is a separate subpath from
`@jbrowse/render-core/marks` so that only the component loads the GPU stack. A
state model may import a display's declaration, painter and hit test, and a
state model loads eagerly. Importing the backend loads the whole GPU stack, so
only the lazily loaded component imports it.

On hover, the display asks render-core's `nearestMarkHit` for the nearest
instance. It passes every instance of every block under the cursor to the mark's
`hitNearest`, which render-core derives from `ink`, and stores the result:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/findScoreHit.ts#hit -->

```ts
// `nearestMarkHit` walks the blocks under the cursor and asks the mark's
// `hitNearest`, which measures the cursor against the rect its `ink`
// declares. What the display chooses is the candidates: every instance here,
// back to front so a tie goes to the box painted on top, which is enough at a
// few thousand boxes. A display with hundreds of thousands asks the encoder for
// its `index` lane — a Flatbush over (bp, score) — and answers with what that
// finds between the reach's `bpMin`/`valueMin` and `bpMax`/`valueMax` instead
// (`findManhattanHit` in plugins/gwas is the worked form).
export function findScoreHit(
  xPx: number,
  yPx: number,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, ScoreRegionData>,
  state: ScoreRenderState,
): ScoreHit | undefined {
  const hit = nearestMarkHit(
    SCORE_MARKS,
    blocks,
    index => regions.get(index),
    state,
    xPx,
    yPx,
    {
      radiusPx: HIT_RADIUS_PX,
      candidates: data => backToFront(0, data.count),
    },
  )
  return hit
    ? {
        start: hit.region.x[hit.index]!,
        end: hit.region.x2[hit.index]!,
        score: hit.region.y[hit.index]!,
        x: hit.x,
        y: hit.y,
        regionIndex: hit.block.displayedRegionIndex,
        instance: hit.index,
      }
    : undefined
}
```

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/ScoreDisplayComponent.tsx#hover -->

```tsx
// measured against the chrome container, which the canvas fills, so the
// pointer lands in canvas px with no offset
onPointerPosition={state => {
  model.setHoveredFeature(
    state
      ? findScoreHit(
          state.x,
          state.y,
          model.renderBlocks,
          model.rpcDataMap,
          model.renderState,
        )
      : undefined,
  )
}}
```

The highlight reuses the hit. A model defines `hoverInk` by passing the hovered
instance through the mark list's `ink` with `inkOfInstances`. `DisplayChrome`
then draws a positioned box in the palette's hover shade, and the model places
nothing itself:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#hoverInk -->

```ts
// the box the hovered bar painted, which DisplayChrome lights: the
// display names the instance and the shape's `ink` says where it is
get hoverInk(): HighlightRect[] {
  const hit = self.hoveredFeature
  return hit
    ? inkOfInstances(
        SCORE_MARKS,
        self.renderBlocks,
        index => self.rpcDataMap.get(index),
        self.renderState,
        index =>
          index === hit.regionIndex
            ? [{ mark: 0, index: hit.instance }]
            : undefined,
      )
    : []
},
```

## Step 8: SVG export

The mark already provides the export. `paintMarkBlocks` runs each mark's painter
against the SVG context, and `renderDisplaySvg` handles the readiness gate and
the terminal states around it. The whole file:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/renderSvg.tsx#render-svg -->

```tsx
export async function renderSvg(
  model: ScoreSvgModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, ScoreSvgBody)
}

// The same painter the Canvas2D backend runs, handed an SVG context. The
// export's width is the shell's, not the on-screen renderState's, which
// subtracts the track outline the export does not draw. The shell clips the
// body to its box.
function ScoreSvgBody({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<ScoreSvgModel>) {
  const state = { ...model.renderState, canvasWidth, canvasHeight: height }
  return (
    <PaintLayer
      width={canvasWidth}
      height={height}
      opts={opts}
      paint={ctx => {
        paintMarkBlocks(ctx, SCORE_MARKS, model.rpcDataMap, renderBlocks, state)
      }}
    />
  )
}
```

The model's `renderSvg` action loads it lazily, so the export code is in no
eager chunk. [](/docs/developer_guides/svg_export) has the pipeline.

## Step 9: Register the display

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/index.ts#register -->

```ts
export default function LinearScoreDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearScoreDisplay',
      configSchema,
      // a thunk, so the model and everything it names load when a track first
      // shows this display or a session names it, not at plugin install
      stateModel: () =>
        import('./model.ts').then(m => m.modelFactory(configSchema)),
      displayName: 'Score display (example)',
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: ScoreDisplayComponent,
    })
  })
}
```

The model and the component both load late. Anything registered at plugin
install loads everything it names by value, so a state model passed directly
would load eagerly. Passing `stateModel` as a thunk keeps the display's mixins,
its `installUpload` and their imports out of every host's startup bundle. They
load when a track first shows the display or a session names it.

## The WebGL2 context ceiling

Each display has one backend canvas, and `WebGL2Hal` creates a WebGL2 context
per canvas with no pooling. Browsers cap how many contexts a page may hold (16
on Chrome). Past the cap, context eviction and re-acquisition repeat in a
cascade and block the main thread. **A single ordinary view reaches the cap**:
17 GPU tracks on one linear genome view. Budget one context per open GPU track.

Adding chromosomes costs no contexts. A whole-genome view of one track is still
one canvas, with one GPU buffer per `displayedRegionIndex`.

View-level lazy mount and bounded auto-recovery in `useRenderingBackend` limit
the problem. Tracks inside a mounted view are not virtualized, so a view can
still reach the cap.

WebGPU has no per-canvas cap, because `gpuDevice.ts` shares one device across
displays. The trade-off is the opposite failure: one `device.lost` takes down
every display at once. **If one track broke, suspect WebGL2. If every track
broke at once, suspect WebGPU**.

[](/docs/developer_guides/memory#gpu-memory-is-guarded-per-object-not-per-session)
lists what each backend refuses to allocate.

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
- A shape holds no state. The model's `rpcDataMap` is the single source of truth
  and is passed into `renderBlocks`; `installUpload` releases each departed key
  through `hal.deleteRegion(key)`.
- The shape defines geometry and picking. The display holds its data and the
  mapping from data to channels. The installer handles only the diff. Moving any
  of these responsibilities into another layer lets the painter and the hit test
  disagree.
- Render the canvas through `DisplayChrome`, never by calling
  `useRenderingBackend` in your own component, and reach the HAL only through
  `@jbrowse/render-core/marks/backend`, only from the component.

The
[What NOT to do](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#what-not-to-do)
section of the architecture spec is the full quick-scan list.

## See also

- [](/docs/config_guides/mark_display)
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
