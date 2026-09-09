---
title: GPU displays
description:
  Write a shape of your own when no shared one fits, and declare it as a mark
  the WebGPU, WebGL2 and Canvas2D backends all draw
guide_category: Plugins
---

**TL;DR:** A display declares what it draws as a list of **marks**: a shape
bound to the display's payload and render state. `createMarkBackend` turns the
list into the WebGPU, WebGL2 and Canvas2D backends, and the same painter is the
SVG export. A **shape** is written once — one `.slang`, one uniform write, one
Canvas2D painter, one hit test, all over one set of channel arrays — and only
when neither shared shape fits. This guide writes one.

:::note

Start from [](/docs/developer_guides/plotting_features): it builds the same
plugin — the fetch chain, the model, the mark list, the component — and this
page replaces only the shape it names. If `spanMark` or `pointMark` draws what
you have, you never come here.

`@jbrowse/render-core` and `@jbrowse/shader-tools` are on npm. Both are
`@experimental`, so pin an exact version and expect to rebuild on upgrade.
`render-core`'s GPU surface is static-import-only, which is what makes a GPU
display a [build-step plugin](/docs/developer_guides/simple_plugin).

:::

## Architecture overview

<Figure caption="The whole idea, before any of the machinery. The worker sends the data to the GPU when the region changes, and it stays there; every frame after that just redraws what the GPU already holds. Panning and zooming never refetch or reparse — that is what makes a GPU display different from a Canvas2D one, and everything named in the next figure exists to keep it true." src="/img/gpu_display_tldr.png" />

<Figure caption="The three dashed doors are where a change re-enters: rpcProps() above the worker, gpuProps() at the upload autorun, everything else at the frame, and what is left below a door is what that change costs. Every upload calls renderNow(), which bumps renderTick and closes the loop; a draw that reports it painted flips canvasDrawn, which readiness testids and DisplayChrome wait on." src="/img/gpu_display_lifecycle.png" />

The model keeps two autoruns running at all times (owned by
`RenderLifecycleMixin`, installed by `installUpload`):

- One upload autorun fires when any `rpcDataMap` entry or the backend changes;
  it diffs the map against what it last sent and calls `backend.upload()` only
  for regions that moved. That diff keeps a streaming whole-genome fetch at O(N)
  uploads instead of O(N²).
- The render autorun fires when `renderTick` bumps (after every upload) or when
  frame-level state like scroll position changes; it calls
  `backend.renderBlocks()`.

The backend is a HAL (Hardware Abstraction Layer) that dispatches to WebGPU,
WebGL2, or Canvas2D at runtime. Your shape talks to the HAL through its mark,
never to WebGPU or WebGL2 directly. See the
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#gpu-rendering-architecture)
for the full lifecycle and `packages/render-core/CLAUDE.md` for HAL invariants.

## Shapes and marks

A **shape** (`MarkShape<TChannels, TParams>`) owns geometry and picking, in four
members that all read the same channel arrays:

- `pass` — the `.slang` shader and the packer that fills its instance buffer
- `writeUniforms` — what reaches the GPU per block
- `paintBlock` — the Canvas2D painter, which is also the SVG export
- `hitNearest` — where the ink is nearest a cursor, for hover and click

A **mark** (`defineMark({ shape, channels, params })`) binds a shape to one
display: `channels` names which of the payload's arrays feed which lane, and
`params` names which of the render state's values reach the uniforms. Both are
lenses that pick fields; neither does work.

Two shapes are shared, and a display whose drawing is one of them writes no
shader, no painter and no hit test:

- **`spanMark`** — a coloured rectangle from `x` to `x2` on the band of `row`.
  Features laid into rows, MAF's alignment cells, anything that is a box on a
  row.
- **`pointMark`** — a glyph (disc, triangle, diamond) at `x` on a linear
  `domain` of `y`, widening to a bar where `x2 - x` is wider than the glyph. A
  scatter plot, Manhattan's points, any datum placed by a value.

`plugins/gwas/src/LinearManhattanDisplay/manhattanMarks.ts` is the whole of
Manhattan's drawing, over `pointMark`. The score box — start to end wide, grown
up from the bottom to its value — is neither a row band nor a glyph, so the
example writes its own. A shape lives in `render-core` once two displays share
it; until then it stays beside the display that declares it, which is where this
one goes.

## Files to create

The same `example-plugins/score-example/` the plotting guide builds. Every file
serves both backends; the shape and its shader are the two this page adds detail
to:

<!-- EXAMPLE_PLUGIN_TREE START -->

```
src/
  index.ts                       the plugin class; installs the display, the RPC method and the feature panel
  LinearScoreDisplay/
    configSchema.ts              config slots (color, scoreColumn)
    findScoreHit.ts              the display's hit walk: hands every instance of each block to the mark's `hitNearest`
    index.ts                     registers the display type; the model and the component both load lazily
    model.ts                     MST model: rpcDataMap, renderState, fetchNeeded, startRenderingBackend, renderSvg
    renderSvg.tsx                SVG export: the mark list painted through renderDisplaySvg
    scoreMark.ts                 the `score` shape: score.slang's pass, its uniform write, its painter (also the SVG export) and its hit test
    scoreMarks.ts                ScoreRenderState, the mark list (one `score` mark over the RPC payload) and the backend type
    components/
      ScoreDisplayComponent.tsx  React: DisplayChrome wrapping the canvas; builds the backend from the mark list
    shaders/
      score.slang                the `score` shape's shader: one box per feature, compiled by gen:shaders
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

The worker's payload, one region at a time, in absolute genomic uint32:

<!-- include: example-plugins/score-example/src/ScoreRPC/rpcTypes.ts#region-data -->

```ts
// One region's worth of features packed into parallel typed arrays. Positions
// are absolute genomic uint32 (never region-relative) so they cross the worker
// boundary without precision loss and the renderer can map them directly.
export interface ScoreRegionData {
  starts: Uint32Array
  ends: Uint32Array
  // score normalized to 0..1 (fraction of the region's max), driving box height
  scores: Float32Array
  numFeatures: number
}
```

And the render state, recomputed cheaply every frame. The colour is resolved to
the packed form the shader's uniform takes, once, in the model — a shape takes
packed colours and the display resolves them, so the uniform write and the
painter are handed one number:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMarks.ts#render-state -->

```ts
// Recomputed cheaply every frame without fetching. Carries the canvas
// dimensions (required, to size the backing store) plus the one setting the
// drawing reads.
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  // packed ABGR (`cssColorToABGR`), resolved once in the model so both backends
  // are handed the same number
  color: number
}
```

## Step 2: Write the shader

Create a `.slang` file. JBrowse uses a Slang-derived shader language that
compiles to both WGSL (WebGPU) and GLSL (WebGL2). Modules are referenced by bare
name (`import hpmath;`), not file path; the shared helpers live in
`packages/render-core/src/shaders/` (`hpmath` for the high-precision
genomic→pixel transform, `colorPack` for unpacking packed colors). Beside those
arithmetic atoms sit the shared _shapes_ — `capsule`, `rowRect`, `pointGlyph`,
`diagonalGrid` — which carry a mark's geometry and its antialias contract
together;
[the shader shape library](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SHADER_SHAPE_LIBRARY.md)
says what each draws, who imports it, and which parts are deliberately not
shared. The example declares its uniforms inline; if several passes share a
struct, put it in a sibling module (`scoreUniforms.slang`, starting
`module scoreUniforms;` with a `public struct`).

The geometry decision — how tall a box is, how narrow one may paint — is written
here **once**. `//! js-export` lifts a function into a TypeScript twin and
`//! export-consts` lifts a constant, and the painter and the hit test in Step 3
read those rather than restating the arithmetic:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/shaders/score.slang -->

```slang
// The score shape: one box per instance, spanning startBp->endBp and grown up
// from the canvas bottom to score (0..1) x canvasHeight, every box in the one
// uniform ABGR color. The box height is written here once and lifted into a
// TypeScript twin, which the painter and the hit test read.
//! targets: wgsl, glsl
//! export-consts: MIN_WIDTH_PX
//! js-export: scoreBarHeightPx

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

// Narrowest a box paints, in CSS px, so a 1bp feature still shows at
// chromosome zoom. Both backends floor at this constant.
static const float MIN_WIDTH_PX = 1.0;

struct ScoreInstance {
  uint  startBp : ATTR0;
  uint  endBp   : ATTR1;
  float score   : ATTR2;
};

struct Uniforms {
  // hpmath genomic->clip transform (hi, lo, +/-clippedLengthBp)
  float3 bpRangeX;
  float  zero;
  // CSS px of the block column clip space spans, not the whole canvas
  float  viewportWidth;
  float  canvasHeight;
  uint   color;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

float scoreBarHeightPx(float score, float canvasHeight) {
  return clamp(score, 0.0, 1.0) * canvasHeight;
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
  // reversal-safe: it is baked into bpRangeX's negated length, so x2 < x1 on a
  // reversed block and the widening grows the same way
  x2 = extendToMinWidthX(x1, x2, MIN_WIDTH_PX, u.viewportWidth);
  float x = local.x < 0.5 ? x1 : x2;

  float barHeightPx = scoreBarHeightPx(inst.score, u.canvasHeight);
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

One `.slang` file with entry points produces up to four modules, and **which one
you import from decides what your users download**. A bundler treats a namespace
import (`import * as shader from './score.generated.ts'`) as using every export,
so a module is included or excluded whole — whatever the smallest eager consumer
of a module wants, the always-loaded chunk pays for all of it.

| Module                      | Holds                                                             | Import it from                                                            |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `score.generated.ts`        | the compiled WGSL/GLSL strings, and a re-export of the next two   | the shape, which needs the shader source anyway                           |
| `score.iface.generated.ts`  | uniform + instance layout, the typed packers, `VERTEX_ATTRIBUTES` | code that packs or reads a buffer                                         |
| `score.consts.generated.ts` | the `//! export-consts` values, and nothing else                  | a state model, a hit test, a Canvas2D twin — anything that wants a number |
| `score.js.generated.ts`     | the `//! js-export` functions as scalar TypeScript                | the painter and the hit test, which run the shader's own math             |

So a display model reading one threshold reaches for the `.consts.` module, not
the shader module that re-exports it.

What lands in `score.generated.ts`, and what a plugin imports from it. It
re-exports the interface and consts modules, so the table below is the union of
all three:

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

Only what a given shader needs is emitted: no compute entry point for a
render-only shader, and an `*_OFFSET_*` map only for the typed-array views its
fields actually take.

Genomic positions travel as absolute `uint` attributes; convert them with the
`bpToClipX` wrapper above and nothing else. The `bpHi`/`bpLo` split it hides
exists because float32 can't represent every base past ~16.7 Mbp, and it stays
confined to that one line; in TypeScript outside uniform writes, use plain
`bp - bpStart`.

## Step 3: The shape

The shape's own vocabulary is its channels — parallel typed arrays plus a count
— and its params, everything else the drawing needs. Then the four members.
There is no constructor: a shape is an object literal, and it is admitted by
having a consumer rather than by completeness.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMark.ts -->

```ts
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { makeBpMapper, spanLeft } from '@jbrowse/render-core/canvas2dUtils'
import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { inkOnRect, nearestInk } from '@jbrowse/render-core/marks/hit'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'
import { scoreBarHeightPx } from './shaders/score.js.generated.ts'

import type { MarkShape } from '@jbrowse/render-core/marks'

// The shape's own vocabulary: parallel typed arrays plus a count. A display
// binds its payload's arrays to these lanes in `defineMark`.
export interface ScoreChannels {
  startBp: Uint32Array
  endBp: Uint32Array
  score: Float32Array
  count: number
}

// Everything else the drawing needs. It reaches the GPU as uniforms and the
// painter as arguments, so the two backends read one set of values.
export interface ScoreParams {
  // packed ABGR (`cssColorToABGR`), the form the shader's uniform takes; the
  // painter unpacks it
  color: number
}

// One box per instance: startBp..endBp wide, grown up from the canvas bottom to
// score x canvasHeight. The shader owns the geometry; the painter and the hit
// test read its generated twin (`scoreBarHeightPx`) and constant
// (`MIN_WIDTH_PX`), so the three cannot drift.
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
      color: params.color,
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { startBp, endBp, score, count } = channels
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    ctx.fillStyle = abgrToCssRgba(params.color)
    for (let i = 0; i < count; i++) {
      const xa = toX(startBp[i]!)
      const xb = toX(endBp[i]!)
      const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
      const h = scoreBarHeightPx(score[i]!, canvasHeight)
      ctx.fillRect(spanLeft(xa, xb, width), canvasHeight - h, width, h)
    }
  },

  // The rect `paintBlock` fills is the hit target, so a hit's `x`/`y` is a
  // point on the box and `distSq` is 0 inside it
  hitNearest(channels, block, frame, _params, xPx, yPx, candidates, maxDistSq) {
    const { startBp, endBp, score } = channels
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    return nearestInk(candidates, maxDistSq, i => {
      const xa = toX(startBp[i]!)
      const xb = toX(endBp[i]!)
      const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
      const h = scoreBarHeightPx(score[i]!, canvasHeight)
      return inkOnRect(
        xPx,
        yPx,
        spanLeft(xa, xb, width),
        canvasHeight - h,
        width,
        h,
      )
    })
  },
}
```

What each member is held to:

- **`pass`** is `slangPass` over the generated module plus a `pack`. The
  instance count is the buffer's own — a packer that allocates
  `n * INSTANCE_STRIDE_BYTES` has stated `n`, and an empty pack is how a region
  with nothing to draw releases its buffer.
- **`writeUniforms`** uses the generated packer (`shader.writeUniforms`), which
  makes the set total: the scratch buffer outlives the frame, so a field left
  out of an offset-poke would silently redraw with last frame's value. The
  `bpRangeX` triple comes from `bpRangeXTuple`, never by hand — it carries the
  reversed pivot, which is the part that goes wrong. Widths are CSS px
  (`clip.scissorW`, the block column), so a min-width floor is a CSS pixel on
  every DPR.
- **`paintBlock`** is the Canvas2D fallback **and the SVG export**: the context
  it takes (`MarkContext2D`) is satisfied by a real 2D context and by the SVG
  one. `makeBpMapper(block)` mirrors bp→px on a reversed block the same way the
  negated `bpRangeX` does, and `spanLeft` places a widened span growing away
  from its anchor on both orientations.
- **`hitNearest`** measures the cursor against the rect the painter fills:
  `inkOnRect` says where instance `i`'s ink is nearest `(x, y)` and how far, and
  `nearestInk` keeps the closest — only a strictly nearer candidate replaces the
  best, so a caller iterating back to front gets the mark on top. The candidate
  set is the display's, not the shape's: hand in every instance, or what a
  spatial index answered.

Two optional members, for a shape that needs them:
`paintsBlock(block, frame, params)` is a draw predicate both backends and the
hit test skip on — a setting that turns a layer off, a marker that exists only
at a canvas edge — and `texture` on the mark declares a 256-entry colour ramp
the pass samples.

## Step 4: The mark list

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMarks.ts#marks -->

```ts
// What this display draws, as a declaration: which of the payload's arrays
// feed which of the shape's lanes, and which of the render state's values reach
// its uniforms. Both are lenses that run once per block per frame. The pass and
// its packer, the painter (which is also the SVG export) and the hit test all
// come from the shape.
export const SCORE_MARKS = [
  defineMark({
    shape: scoreMark,
    channels: (d: ScoreRegionData) => ({
      startBp: d.starts,
      endBp: d.ends,
      score: d.scores,
      count: d.numFeatures,
    }),
    params: (s: ScoreRenderState) => ({ color: s.color }),
  }),
]
```

`channels` may answer `undefined` for a region the mark has nothing in, which is
how one list serves a display whose cells are a union. Three more options on
`defineMark` exist for the shapes in tree: `bufferOf` for a mark that draws off
another mark's uploaded buffer, `texture` for the ramp above, and `band` for a
display that stacks strips on one canvas. A first shape wants none of them.

## Step 5: The parity gate

The painter and the hit test are two spellings of where the ink is, and they
drift. `sweepDrawAgainstHit` paints a block into a recording context, walks it
in half-pixel steps, and holds `hitNearest` to what the painter put down: a
point on a box answers that box, a hit's `x`/`y` lies inside the box it names,
and no answer is nearer than its painting. Run it in both orientations:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMark.test.ts -->

```ts
import { sweepDrawAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'

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
  startBp: Uint32Array.from([100, 300, 500, 900]),
  endBp: Uint32Array.from([400, 450, 501, 1000]),
  score: Float32Array.from([0.5, 0.25, 1, 0.1]),
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
          sweepDrawAgainstHit(
            scoreMark,
            channels,
            { ...block, reversed },
            frame,
            { color: 0xff0000ff },
            { maxDistSq },
          ),
        ).toEqual([])
      })
    }
  }
})
```

`scoreMarks.test.ts` beside it is the mark-level suite: which payload array
reaches which lane, the uniforms a block writes through `MockHal`, what the
painter draws for one feature, and what the display's hit walk answers. Together
they replace the pixel comparison a GPU-vs-Canvas2D gate would need.

## Step 6: MST model

Compose `MultiRegionDisplayMixin` (which includes `RenderLifecycleMixin` and the
fetch autoruns), store the worker output in an `rpcDataMap`, and wire the render
lifecycle with `installUpload`. This is the **per-region streamed** upload
pattern from the
[architecture spec's upload patterns](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#upload-patterns),
the right shape when each region's data is independent (no cross-region layout
coupling).

The model is the one
[Plotting features, Step 3](/docs/developer_guides/plotting_features#step-3-the-mst-model)
builds in full (`rpcDataMap`, `rpcProps`, `renderState`, `fetchNeeded`). It
names no shape and no shader; the one action that meets the backend is:

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

One installer wires the
[render lifecycle](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#the-core-contract)
for you. `installUpload` remembers what it last sent for each key and uploads
only what changed, so N regions streaming in cost N uploads rather than N². The
key is whatever your map is keyed by: a `displayedRegionIndex` here, a sibling
display's `sharedBackendKey` on a canvas several displays share, or a slot name
(`oneCell('data', payload)`) on a display that holds one payload for the whole
view. Only displays that lay features into Y-rows _across_ regions
(`LinearBasicDisplay`, alignments) hand it a whole-map computed instead of the
raw `rpcDataMap`.

An encode that needs more than the region's own data — a color scheme, a scale —
declares it as `inputs`, and a change there re-encodes every loaded region.
Reading it inside `encode` instead does not work: the helper invalidates on
`inputs` and on the region's own data, and on nothing else.

Three settings buckets (see the
[`rpcProps()` / `gpuProps()` pattern](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#rpcprops--gpuprops-pattern)):

- **`rpcProps()`** refetches in the worker, so scroll and zoom must stay out of
  it.
- **`renderState`** is recomputed per frame and refetches nothing.
- **`gpuProps()`** takes a setting that needs a main-thread buffer _re-encode_
  but no refetch — a color, a scale.

## Step 7: React component

`DisplayChrome` creates the backend through `useRenderingBackend`, calls
`model.startRenderingBackend(backend)` once it is live, and hands back the
`canvasRef` to attach to your `<canvas>`. The factory it takes is the one import
on the mark path that reaches the HAL:

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
`@jbrowse/render-core/marks` for exactly this reason. A display's declaration,
its painter and its hit test are things a state model can legitimately reach,
and a state model is eager; the backend costs the GPU stack, so it is imported
once, from the lazily loaded component, and from nowhere else.

The hover hands the shape's `hitNearest` every instance of every block under the
cursor and stores what comes back:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/findScoreHit.ts#hit -->

```ts
// Where the ink is stays with the shape: `hitNearest` measures the cursor
// against the same rect `paintBlock` fills. This display has no spatial index,
// so it hands in every instance of every block under the cursor; one with a
// worker-built index would hand in what the index answered.
export function findScoreHit(
  xPx: number,
  yPx: number,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, ScoreRegionData>,
  state: ScoreRenderState,
): ScoreHit | undefined {
  let bestDistSq = HIT_RADIUS_PX ** 2
  let best: ScoreHit | undefined
  for (const block of blocks) {
    const data = regions.get(block.displayedRegionIndex)
    if (data) {
      const hit = MARK.hitNearest?.(
        data,
        block,
        state,
        xPx,
        yPx,
        everyInstance(data.numFeatures),
        bestDistSq,
      )
      if (hit) {
        bestDistSq = hit.distSq
        best = {
          start: data.starts[hit.index]!,
          end: data.ends[hit.index]!,
          score: data.scores[hit.index]!,
          x: hit.x,
          y: hit.y,
        }
      }
    }
  }
  return best
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

## Step 8: SVG export

The export comes with the mark: `paintMarkBlocks` runs each mark's painter
against the SVG context, and `renderDisplaySvg` owns the readiness gate and the
terminal states around it. The whole file:

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
// subtracts the track outline the export does not draw.
function ScoreSvgBody({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<ScoreSvgModel>) {
  const state = { ...model.renderState, canvasWidth, canvasHeight: height }
  return (
    <SvgClipRect
      id={`score-clip-${svgNodeId(model)}`}
      width={canvasWidth}
      height={height}
    >
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          paintMarkBlocks(
            ctx,
            SCORE_MARKS,
            model.rpcDataMap,
            renderBlocks,
            state,
          )
        }}
      />
    </SvgClipRect>
  )
}
```

The model's `renderSvg` action loads it lazily, so the export code rides no
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

Both the model and the component load late. A state model is eager — anything
registered at plugin install loads everything it names by value — so a
`stateModel` handed as a thunk is what keeps the display's mixins, its
`installUpload` and everything behind them out of every host's startup bundle
until a track first shows the display or a session names it.

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
- `rpcProps` must not contain fetch results. `SettingsInvalidate` watches
  `rpcProps()`; putting derived cell data there creates an infinite fetch loop.
- Shader uniforms use CSS pixels: don't scale `canvas_width`/`canvas_height` by
  `devicePixelRatio` before writing them.
- Never edit `*.generated.ts`. Always edit `.slang` and run `pnpm gen:shaders`;
  CI enforces this with `git diff --exit-code`.
- A shape holds no state. The model's `rpcDataMap` is the single source of truth
  and is passed into `renderBlocks`; `installUpload` releases each departed key
  through `hal.deleteRegion(key)`.
- The shape owns geometry and picking, the display owns its data and the lens
  from data to channels, and the installer owns only the diff. Moving one of
  those across a boundary is how the painter and the hit test start to drift.
- Render the canvas through `DisplayChrome`, never by calling
  `useRenderingBackend` in your own component, and reach the HAL only through
  `@jbrowse/render-core/marks/backend`, only from the component.

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
