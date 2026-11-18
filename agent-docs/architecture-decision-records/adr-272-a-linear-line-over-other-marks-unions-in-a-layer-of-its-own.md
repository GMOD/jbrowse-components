---
status: Accepted
summary: "A linear line declared after another mark draws `union`: its capsules max-blend into a one-sample layer of their own, which the HAL composites source-over at the line's place in draw order. A line-first display and wiggle keep the max path and allocate nothing"
---

# ADR-272: A linear line over other marks unions in a layer of its own

## Status

Accepted (2026-11-17), on a reviewer's ruling over a reproduced defect.
Extends [ADR-184](adr-184-a-line-is-a-mark.md), whose linear line max-blends
its capsules.

## Context

`lineCenterMark` draws one round-capped capsule per instance, and neighbours
overlap at every joint. A max blend unions them, where source-over darkens
each joint. Into the frame, though, max keeps per channel the brighter of the
line and whatever an earlier mark drew there. The mark display draws `marks[]`
in declared order into one target, so with `marks: [bar, line(linear)]` a dark
line vanished over light bars on WebGPU and WebGL2 while Canvas2D stroked it
on top. The `mark-line-linear-over-bars` pixel fixture measured it: worst pixel
0.714, and 552 / 1237 / 1828 pixels off by more than 0.1 at four samples at
dpr 1 / 1.5 / 2, against 8 / 11 / 17 for the line alone. The volvox
`marks_line` track, a step line then a tomato linear one, drew it too.

## Decision

- **`BlendState` gains `{ op: 'union' }`.** A union pass's fragments
  max-blend into a one-sample canvas-sized layer of their own, cleared at the
  pass's first draw of a frame, and each of its draws composites that layer premultiplied
  source-over under its scissor, through `layerOver.slang`. Its pipeline is
  built at one sample whatever the display's count (`pipelineRecipe`).
- **On WebGPU the layer renders before the frame.** Its content never depends
  on the frame's target, so each layer has its own command encoder and render
  pass, begun at the pass's first draw and submitted ahead of the frame's in
  one `queue.submit`. The frame keeps its single render pass, its one resolve
  and `storeOp: 'discard'`. WebGL2 binds an RGBA8 framebuffer per layer and
  draws in order.
- **The pass's draws must scissor apart, and blocks meeting mid-pixel do
  not.** `clampBlockScissor` floors a block's start and ceils its end, so two
  displayed regions meeting at a fractional px share a column. Because the
  WebGPU layer holds every block's draws before any composite reads it, a
  draw composites only the columns no earlier draw of the pass composited
  where that draw's scissor spans its height (`uncomposited`), so the shared
  column is composited once.
- **`lineMarkOf(interpolate, overMarks)` gives the linear line `union` only
  where `buildMarkList` has built a per-block mark before it.** Text builds
  none, and a link spans the view and draws after every block. A line-only or
  line-first display, a step line and the whole wiggle display keep the max
  path: no layer, no second encoder, one command buffer a frame.
- **`layerOver` carries a one-field instance, the layer's size.** The codegen
  builds no vertex pass without an instance struct, and slangc's WGSL for
  `Load` on a combined sampler fails Tint, so the fragment samples its own
  position over the size through a nearest filter. Its uniform block is
  declared for the HALs' binding shape and read by no stage.
- **`scripts/gpu-pixels` draws a fixture with others through `WebGPUHal`
  itself**, so a union fixture scores the HAL's own layer, pass order and
  composite rather than a copy of them.

## Consequences

- **Memory:** a display with a later linear line holds one canvas-sized layer
  per such line, 4 B per device px, uncounted like the MSAA target: 2.0 MB
  for a 1266x100 CSS px track at dpr 2, 17.0 MB at 1266x840
  ([ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)). A
  `[point, line]` display goes from none to one.
- **Per frame:** one more encoder and render pass per layer on WebGPU, two
  framebuffer switches per block per layer on WebGL2, and a block-sized
  composite at the display's sample count, so the cost grows with track area.
  Through `WebGPUHal` on Dawn at dpr 2 and four samples, 1266 bars and 1266
  capsules, timed from `beginFrame` to `onSubmittedWorkDone` over interleaved
  rounds of ten frames, minimum / median ms per frame:

  | GPU, CSS px canvas      | bars        | bars + max line | bars + union line |
  | ----------------------- | ----------- | --------------- | ----------------- |
  | RTX A6000, 1266x100     | 0.157 / –   | 0.179 / –       | 0.238 / –         |
  | Intel UHD 630, 1266x100 | 1.21 / 1.35 | 1.43 / 1.63     | 1.70 / 1.98       |
  | Intel UHD 630, 1266x840 | 4.90 / 5.08 | 5.17 / 5.40     | 5.97 / 6.22       |

  On a tile-based
  GPU each WebGL2 switch stores and reloads the multisampled default buffer;
  unmeasured.
- **Not fixed:** inside one layer, capsules of different colours still mix
  per channel under max (crossing series, categorical colours, a threshold
  near a joint), and a dense 1 px line still reads light, max being the
  largest capsule's coverage rather than the union's.
- **The column two blocks share at a seam meeting mid-pixel** is composited
  with the first block's draw. On WebGPU it holds both blocks' ink, unioned;
  on WebGL2, which draws in order, it shows the first block's ink alone. On
  both backends the second block's earlier marks then draw over the line in
  that column. The defect is bounded to one CSS column where two regions meet
  mid-pixel.
- **The contract is only partly enforced.** `uncomposited` trims an end column
  that an earlier rect spans in full height; two draws of one union pass under
  overlapping scissors of any other shape composite the overlap twice.
- **Gates:** `mark-line-linear-over-bars`, an alpha 0.6 line over the bars,
  two line layers and a line under a later point layer carry `meanErr: 0.015`
  on their one-sample row; drawn max they score 3.0-7.5%. The cross-backend
  gate compares `marks_bars_linear_line`, the line over bars on a full-height
  light ground, against Canvas2D on WebGL2: with the max line it drifts 3.88%
  under SwiftShader, CI's rung, and 3.84% on an RTX A6000 through ANGLE's GL,
  against a 1.5% ceiling; fixed, 0.00% on both. Dawn's null backend
  validates a union pass beside a multisampled one but draws nothing.

## Rejected alternatives

- **Pass breaks around the line in the frame's own pass** (the reproducing
  agent's design). The multisampled attachment would have to `store` then
  `load` twice per block, and its per-block clear is unneeded once the layer
  renders ahead.
- **Capsules that do not overlap** (each capsule owning its joint). Exact only
  between consecutive segments; it needs 12 to 24 more bytes per instance and
  compounds wherever a pixel is within reach of two non-neighbours, which is
  the dense fixture. A translucent line then fails `twice: 0`.
- **The step line's approach, flat quads at four samples.** A translucent line
  double-blends at every joint, an all-analytic display is forced to 16 B per
  px, and a 1 px diagonal gets five coverage levels.
- **Depth max-coverage** (a pre-pass writing 1 − coverage, then an
  equal-depth draw). Saturated capsule bodies tie on `equal`; every pipeline
  in the pass needs depth state; WebGL2 needs `depth: true` at context
  creation; it costs 4 B x samples per px and draws the line twice.
- **The line first, earlier marks `behind`** (wiggle's order). Bar, point,
  span, rule, link and step declare no blend, so they blend straight alpha,
  and `behind` needs premultiplied output; no factor gives As·(1−Ad). Instance
  order inverts inside each behind layer, and a second line layer still
  cannot union.
- **Source-over for the capsules.** Measured: it breaks the line-alone gates,
  the translucent line blending 51 / 122 / 200 pixels twice at dpr 1 / 1.5 /
  2 and the dense one 388 / 942 / 1679.
- **Stencil first-wins.** Takes the first capsule's edge coverage rather than
  the largest, so joints get nicks.
- **Every linear line unions in a layer.** One path, but a line-only or
  line-first display would pay 4 B per device px and a pass for no visible
  change: the mark display clears transparent, so a first line max-blended
  into the frame matches its layer composited over nothing.
- **At the seam, composite each layer once a frame.** It needs a mark-major
  loop, and `renderBlocks` is block-major: the later blocks' bars would then
  draw over the line.
- **At the seam, scissor blocks apart at the source.** Changes
  `clampBlockScissor` for every display and for Canvas2D, to move one column
  of one mark.
- **At the seam, clear the composited column of the layer before the second
  block draws.** Impossible on WebGPU, whose layer pass ends before the frame
  reads it; on WebGL2 it blends a translucent line twice in that column.
- **At the seam, no trimming.** Composites a translucent line twice in one
  column per seam.
- **A lint refusing a line after another mark.** It writes a backend bug into
  the config vocabulary and refuses the bar-plus-line plot people want.
