---
name: wiggle-onto-bar-and-point
description: Move the wiggle display's plots onto render-core's bar, point, line and span marks, keeping LinearWiggleDisplay as a display type. The line (ADR-184), the pivot as a shader-side threshold (ADR-185), the heatmap as a span (ADR-113's amendment) and a constant color as one number (ADR-198) have landed. Colin's 2026-09-30 approval settled the rest of the shape - the row lane stays per instance, and a min-max extent becomes three translucent bar marks, shown as captures first. Re-sized on 2026-10-12 at 8.5-12.5 days. The display keeps its model, fetch, hit test and tooltip, so `resolution`, GC content's domain and the tooltip need no work; the critical path is per-source color, which render-core's row table cannot paint on one side of a cut. Bars and points alone take 3.5-4.5 days and pay off by themselves.
---

# Wiggle's plots onto render-core's marks

A review sized this on 2026-09-27 and Colin answered "not now" on
2026-09-30. It was re-sized on 2026-10-12 (below).

## What is already out of the way

`MultiWiggleAdapter.getFeatureTable` landed on 2026-10-12: one `ColumnTable`
over every member's arrays, `source` a category column, 2.8-7x faster than
the `Feature` route on 12 volvox BigWigs at the raw tier.

Of the four blockers sized on 2026-09-26, the bin-midpoint one is gone (ADR-181
centres a point), the interleaved positions live only in the payload
(`plugins/wiggle/src/util.ts`; the GPU record already matches `bar`'s x/x2),
and the row's f32-against-u32 is about an hour. Since then the line landed as
a mark (ADR-184), and the bicolor pivot is a threshold over `y` resolved in the
shader (ADR-185): a rise across the pivot changes color at it, the color
costs no lane because it reads the `y` lane, and a pivot edit refetches
nothing. The density heatmap is a `span` under a color scale (ADR-113's
2026-09-28 amendment), the white fade a diverging `range` with `domainMid`.
[ADR-198](../../architecture-decision-records/adr-198-a-constant-color-rides-as-a-scalar.md)
lets `EncodedChannels.color` be one number, so a constant-color bar holds
wiggle's 12 payload bytes a feature.

## Settled by the 2026-09-30 plan

- **The row lane stays per instance.** `barMark.slang` reads `row` for every
  instance and `rowLane` fills zeros where a layer sends none, so riding `row`
  as a per-layer constant, the call this doc used to wait on, would save only
  the payload's four bytes an instance on multi-source tracks. Against
  wiggle's own GPU record of 12 bytes a `bar` instance is 20; measure that at
  the port.
  [wiggle-instance-records-carry-per-row-constants](wiggle-instance-records-carry-per-row-constants.md)
  measures per-row constants from the GPU side.
- **Whiskers are three translucent bar marks** over `maxScore`, `score` and
  `minScore`, all three columns of the BigWig table
  (`plugins/wiggle/src/BigWigAdapter/bigWigFeatureTable.ts:26-27`), each one
  translucent hue with ADR-185's threshold at the pivot. The overlap count is
  the magnitude on both sides of the pivot, the rule
  `plugins/wiggle/src/shared/wiggleLayers.ts:91-99` states, with no sign split
  and no draw order. They cannot paint a band darker than the base, so the
  base reads dark and the single layer light: captures go to Colin before the
  port lands. Six marks behind sign filters would run a jexl `filter` per mark
  per row, about 250 ms a million rows each (ADR-191's table).
- **The line-mode band** is a filled min–max area, which needs `y2` (declined
  on 2026-09-23 for the range bar and on 2026-09-30 with the stack), so min and
  max lines stand in.

## Re-sized 2026-10-12

Wiggle already draws through render-core's `defineMark` list
(`plugins/wiggle/src/shared/wiggleMarks.ts`), and SVG export paints the same
list, so the port swaps shapes inside the display and the display keeps its
fetch, hit test, all-sources tooltip, `resolution` and GC content's domain,
and the port leaves those as they are.

| Step | Days |
| --- | --- |
| Un-interleave the positions (39 files name `featurePositions`) | 1.5-2 |
| Bars and points onto `barMark` and `pointMark` | 1.5-2 |
| A symlog ramp in `markColor.slang` and the shapes' uniform blocks | 0.5 |
| A second row-table color plane | 1-1.5 |
| Density onto `span`, with the white fade | 1-1.5 |
| Lines onto `lineStepMark` and `lineCenterMark`, per-source `gapBp`, Canvas2D paint at 1.00x | 2-3.5 |
| Tests and docs | 1.5-2 |

- **Per-source color is the critical path.** On a multi-source plot the
  display paints each source in its own color above the cut and in the shared
  negative color below it (`buildSourceRenderData.ts`, "Do NOT fix this"). render-core's row
  table replaces a row's whole color (`rowTable.slang`, `p.color`) and turns
  off a line's along-y threshold for an overridden row (`lineColorAlongY` in
  `lineCommon.slang`), and density fades to each row's own color, which one
  shared LUT cannot hold. A second color plane changes how every mark display
  reads a row color, so Colin decides it separately.
- **The min-max extent may not need three translucent bars.**
  `packFillInstances` already writes every layer, back to front, into one
  buffer with packed per-instance colors, so one `bar` mark fed the same
  layers draws today's tinted nesting with no translucency and no captures
  gate. This departs from the 2026-09-30 plan, so it waits on Colin.
- **The line-mode band stays wiggle's** (`wiggleBand.slang`) as a shape in
  the same mark list, since a filled area waits on the declined `y2`.
- **Speed to judge:** `pointMark`'s record is 24 bytes against wiggle's 20,
  about 17% off scatter's zoom ceiling at 1000 sources; ADR-127 measured the
  line's Canvas2D paint at 1.08-1.12x; `colorBits` and `rowLane` allocate a
  count-sized lane for a constant on every pack. Benches:
  `plugins/wiggle/benches/runInstanceBufferScenarios.sh` and
  `multiWiggleFacet.bench.ts`.

## First step

Un-interleave the positions, then bars and points onto `barMark` and
`pointMark`, then the symlog ramp: 3.5-4.5 days, no pixels moved, deleting
`wiggle.slang`, `packFillInstances`, `drawXYPlot` and `drawScatter`. Scatter's
four extra bytes need a bench verdict first, or points stay on the fill
shader.
