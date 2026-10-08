---
name: wiggle-onto-bar-and-point
description: Move the wiggle display's plots onto render-core's bar, point, line and span marks, keeping LinearWiggleDisplay as a display type. The line (ADR-184), the pivot as a shader-side threshold (ADR-185), the heatmap as a span (ADR-113's amendment) and a constant color as one number (ADR-198) have landed. Colin's 2026-09-30 approval settled the rest of the shape - the row lane stays per instance, and whiskers become three translucent bar marks, shown as captures first. Left are a symlog ramp in markColor.slang, `resolution`, GC content's value domain, per-source color on the plot, wiggle's all-sources tooltip and a typed table for MultiWiggleAdapter. Sized at 7-10 days.
---

# Wiggle's plots onto render-core's marks

A review sized this on 2026-09-27, and nobody has re-measured the sizes. Colin
answered "not now" on 2026-09-30.

## What is already out of the way

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

## What is still real

- `markColor.slang` has no symlog.
- `resolution`, the fetch tier multiplier, has no counterpart on the mark
  display.
- GC content's adapter declares the domain its values lie in
  ([ADR-176](../../architecture-decision-records/adr-176-gc-content-is-a-track-the-wiggle-display-draws.md)),
  which the mark display's unpinned ends do not read.
- Per-source color paints the plot through the row table's color plane,
  where the mark display's row color tints only the label.
- Wiggle's tooltip lists every source's min, mean and max at the cursor; the
  mark display hovers one instance. A `tooltip` channel would be the general
  form ([GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md)
  §"Gaps against the grammar").
- `MultiWiggleAdapter` has no `getFeatureTable`, so multi-source rows arrive
  as `Feature`s, which
  [ADR-193](../../architecture-decision-records/adr-193-an-adapter-answers-the-mark-pipeline-its-typed-arrays.md)
  measured at 1.80x wiggle on one BigWig.

## First step

Un-interleave the positions: 1-1.5 days, about 25 files, no pixels moved, held
by `wiggleInstanceBuffer.test.ts` and the pack benches at 1.00x or better.
