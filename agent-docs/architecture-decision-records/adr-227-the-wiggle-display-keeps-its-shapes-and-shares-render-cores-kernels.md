---
status: Rejected
summary: "Moving LinearWiggleDisplay's bars, points, lines and density off its own five shaders and Canvas2D painters onto render-core's bar, point, line and span marks is declined, in full and as a bars-and-points first step. Wiggle's color depends on the row and the value at once (a source's own color above the cut and the shared negative color below it, and density fading to each row's own color), which render-core's one-field color and whole-row override cannot say, and wiggle draws per-source layers whose order nests the min-max bars, where a mark takes one flat channel set a region. The port would delete about 1,500 lines for new render-core channels with one user and no user-visible change. The display keeps its shapes and converges on render-core's kernels wherever the two compute the same thing, as ADR-199 has MAF do. It can be reconsidered when a second display needs color from the row and the value, when render-core's painters reach 1.00x of wiggle's, or when wiggle's payload becomes the flat worker table anyway"
---

# ADR-227: The wiggle display keeps its shapes and shares render-core's kernels

## Status

Rejected (2026-10-12), Colin's call after two reviews of the parked idea
`wiggle-onto-bar-and-point`: a re-size at 8.5-12.5 days and an independent
review that judged that figure low. The idea doc is retired into this record.
It can be reconsidered; the conditions are below. Amended 2026-10-20: the
density fade to each row's own color went (a heatmap reads its color scale,
WIGGLE_DISPLAY.md), so of the color reasons below only the line's row color
above the cut stands; and render-core's line reads a ramp along y as wiggle's
does, so the two lines now color alike. Amended 2026-10-27: a subtrack's
color paints both sides of the cut
([ADR-251](adr-251-a-wiggle-color-over-source-paints-each-subtrack-whole.md)),
so that last color reason is gone too.

## Context

The idea moved the quantitative display's plots onto the marks the grammar's
mark display draws, keeping `LinearWiggleDisplay` as a display type. By
2026-10-12 most of the arithmetic was already shared: `wiggle.slang` imports
render-core's antialias, `hpmath`, `colorPack`, `colorRampLut`, `pointGlyph`,
`scoreScale` and `clipStrip` modules, a line picks its band through
`markColor.slang`'s `thresholdBandAtYPx`, and both Canvas2D lines stroke
through render-core's `BandPen` and compare cuts through `thresholdBandOf`.
What stays in wiggle's shaders is where wiggle means something the marks do
not.

## Why the port is hard

- **A color from the row and the value at once.** A line paints a source's
  own color above the cut and the shared negative color below it
  (`buildSourceRenderData.ts`, "Do NOT fix this"; `bandColorAt` in
  `wiggleCommon.slang`), and density fades from white to each row's own color
  (`wiggleDensity.slang`). render-core's color is one field through one scale,
  and its row table either replaces a row's whole color (`rowTable.slang`) or,
  for an overridden row, turns off a line's color along y
  (`lineColorAlongY` in `lineCommon.slang`). Carrying wiggle's meaning means a
  second row-table color plane and a per-row density fade: new channels with
  one user, which ADR-040's two-consumer bar refuses.
- **Per-source layers against one flat channel set.** Wiggle keeps a layer per
  source and band, aliasing the payload arrays, and the layer order is what
  nests the signed min-max bars, darker toward the origin and lighter at the
  extreme (`wiggleLayers.ts`). A mark takes one flat set of channels a region,
  and render-core's channel functions only pick fields, so a thousand sources
  would be joined at encode time and kept. That retained copy is what
  [ADR-127](adr-127-line-stays-wiggles.md) and
  [ADR-152](adr-152-wiggle-stays-off-the-column-encoder-until-two-lanes-go.md)
  measured and refused.
- **The painters' speed.** A declared form lands at 1.00x the hand-written
  path (GRAMMAR_OF_GRAPHICS.md, rule 3). ADR-127 measured the shared line's
  Canvas2D paint at 1.08-1.12x, and `barMark.paintBlock` does the same
  per-instance row and color work; no plan reached 1.00x. `pointMark`'s
  record is 24 bytes against wiggle's 20, about 17% off scatter's zoom
  ceiling at a thousand sources.

## What it would have bought

About 1,500 net lines (`wiggleMarks.ts`, `wiggleInstanceBuffer.ts`, most of
`wiggleDrawFunctions.ts` and four shaders), against render-core growing a
symlog ramp, a second row color plane, a per-row fade and a faster painter
path. `wiggleLayers.ts`, `buildSourceRenderData.ts`, the min-max line band and
the hit test stay either way. Nothing user-visible. Sharing code was not the
port's to win: the float32 cut bug of 2026-10-12 sat in render-core's own
line painter as well as wiggle's, and the shared `thresholdBandOf` fixed both.

## Decision

- The wiggle display keeps its five shaders, its Canvas2D painters and its
  per-source layers.
- Where wiggle and render-core compute the same thing they share one
  implementation, as ADR-199 has the MAF display do: the threshold compare,
  the band pen and the band pick moved on 2026-10-12, and the next candidates
  are named when someone finds two copies.
- On 2026-10-28 the color-y and cut placement (`valueToYPxUnclamped`,
  `colorCutYsPx`), the bar's slab (`slabVertexYPx`, `slabCoverage`), the clip
  strip's top (`clipStripTopPx`) and the centre line's capsule corner
  (`clipXCapsuleCorner`) moved. They sit in render-core modules with no
  uniform struct, because `wiggleCommon` and `lineCommon` each declare
  `Uniforms` and slangc refuses a shader that imports both. Wiggle's shaders
  and render-core's still convert y to clip space each their own way, and the
  two results differ by up to one float32 rounding step. The step line's quad
  is the copy left.
- On 2026-10-31 wiggle's Canvas2D step and centre lines moved onto
  render-core's `traceStep` and `traceCenter`, which read a layer's
  interleaved positions at stride 2 rather than a split copy, through one
  normalizer hoisted per block. The recorded paths stayed bit-identical, and
  the paint measured 1.00-1.05x of the hand-written tracers.
- Two pieces stand on their own and need no port: wiggle's shaders can read
  render-core's row table for the row's slot and visibility, so a sort, a
  cluster or a hidden row would upload a texture rather than re-encode every
  region; and the worker could stop interleaving bbi's starts and ends.
  Neither is scheduled.

## When to reconsider

- A second display declares a need for color from the row and the value, such
  as the mark display drawing a multi-BigWig with per-source bicolor bars. The
  new channel then has two users.
- A bench shows `barMark` and `pointMark` painting Canvas2D at 1.00x of
  wiggle's painters with per-instance row and color.
- Wiggle's payload becomes the flat worker table for another reason, which
  removes the per-layer join and most of the cost.

## Rejected alternatives

- **The full port**, at 10-15 days once the flattening and the painters' speed
  are priced in.
- **Bars and points first** (3.5-4.5 days). It would leave two uniform
  systems and two payload paths in one display, and `packFillInstances` stays
  while density borrows the fill buffer.
- **The min-max extent as three translucent bar marks**, the 2026-09-30 plan.
  The colors would come from alpha over the background rather than the tints
  the display draws now; a single bar mark over today's packed layers would
  keep the picture, if the port ever reopens.
