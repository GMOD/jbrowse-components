---
name: a-mark-line-reads-its-ramp-along-itself
description: On the mark display, a `line` under a linear color over the plotted field colors each segment one flat color, its instance's value, so a rise across the ramp is one color; the wiggle display's line reads the ramp at each fragment's height. Extending render-core's `lineColorAlongY` to ramps needs the y scale inverted per fragment, since the color ramp keeps its own domain.
---

# A mark line reads its ramp along itself

The wiggle display colors a line under a gradient by the ramp at each
fragment's centre-line y (`lineColorAt` in `wiggleCommon.slang`), and Canvas2D
strokes the ramp as thin bands (`rampAsBands`), WIGGLE_DISPLAY.md §"A line
plot is one line, colored along itself".

render-core's `line` mark reads color along y only under a threshold
(`lineColorAlongY` in `packages/render-core/src/shaders/lineCommon.slang`,
ADR-185). Under a ramp, `markScaleColor` resolves one color per instance in
the vertex stage (`lineStepMark.slang:69`, `lineCenterMark.slang:62`), so a
step line's riser and every interpolated segment take one end's color.

## What the change needs

- `lineColorAlongY` true for the ramp modes when `colorFromY` is set, and
  `lineFragmentColor` sampling the ramp.
- The value under a fragment: the mark display's color ramp keeps its own
  domain (`rampMin`, `rampMax`), unlike wiggle's, which follows the y domain,
  so the fragment inverts the y scale (`valueScale`, log and symlog included)
  at its color y, then normalizes into the ramp's domain.
- The Canvas2D painter (`lineMark.ts`, `bandSpan`) stroking a ramp as bands,
  as wiggle's `rampAsBands` does, uniform-only on the GPU side.
