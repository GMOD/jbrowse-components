---
status: Accepted
summary: "A threshold colour resolves in the shader as `markColor`'s fourth mode: up to `MAX_COLOR_CUTS` (8) cut points and a colour per interval ride the valued shapes' uniform block, so a cut moved by an edit uploads no instance bytes, and the Canvas2D bake follows the same `thresholdBand` rule. A quantitative colour over the field `y` plots — a ramp or a threshold — is the `y` lane itself: the encoder aliases `colorValue` to `y`, the mark display resolves the scale table off the plotted values (`valueColor.ts`) instead of sending the colour to the worker, and an edit to its cuts, ends or colours re-stamps the regions and refetches none. A line reads the threshold per fragment along the value's unclamped y (`lineColorYPx`), so a rise across a cut changes colour at the cut; Canvas2D strokes the polyline once per band. The valued shapes take `colorScale` where they took `ramp`, and the display's `paintScales` replaces `colorRamps`"
---

# ADR-185: A colour over the plotted value reads the y lane

## Status

Accepted (2026-09-28). The stage [ADR-184](adr-184-a-line-is-a-mark.md)
named next: its line's colour was one colour per instance, and a two-colour
line on the mark display was two marks with a `filter` each.

## Context

Wiggle colours a line by the band its centre line is in: a rise across the
bicolor pivot is `negColor` below the pivot and `posColor` above it, mid-stroke.
On the mark display that split is a threshold colour over `score` with one cut
at the pivot, and before this ADR a threshold resolved in the worker
(`encodeFeatures` packed one palette entry per feature into the `color` lane),
which gave a line one colour per instance and made a pivot edit a refetch of
every region.

The same colour also cost a lane it did not need. A colour over the field `y`
plots was read from the feature a second time into `colorValue`, four bytes an
instance beside the four the `y` lane already carried, and it went to the worker
as a fetch input, so a change to its domain refetched. Wiggle's port is the
consumer that makes both costs visible: every wiggle plot colours by the value
it plots.

## Decision

- **A threshold is `markColor`'s fourth mode, resolved from uniforms.**
  `RAMP_THRESHOLD` beside `RAMP_NONE`, `RAMP_LINEAR` and `RAMP_LOG`; the
  valued shapes' uniform blocks carry `colorCutCount`, the cuts four to a
  `float4` (`MAX_COLOR_CUTS` is 8) and one colour per interval
  (`MAX_COLOR_BANDS` is 9). `markScaleColor` replaces `markInstanceColor` and
  reads the value's interval as `thresholdBand`, the count of ascending cuts
  the value is at or past — `thresholdIndex`'s rule in
  `@jbrowse/core/util/thresholdScale` and `thresholdBandOf`'s in the Canvas2D
  bake. An infinity takes the end on its side, a `RAMP_NO_VALUE_BITS` NaN and
  a text NaN the two greys, as under a ramp.
- **The shapes take `colorScale`**, a `MarkRamp | MarkThreshold`, where they
  took `ramp`; `rampUniforms` writes the whole set for either, and
  `paintColors` bakes a threshold once per scale and reuses it while the cuts
  and colours stand. The mark display's `paintScales` replaces `colorRamps`,
  building a threshold's packed colours from the legend table.
- **A colour over the plotted field is the `y` lane.** Where a mark's colour
  is a linear, log or threshold scale over the field its `y` reads,
  `encodeFeatures` aliases `colorValue` to `y` rather than copying it, and
  `encodedChannelTransferables` lists a buffer once. The mark display goes
  further: `valueColorOf` names such a colour, the request sends the default
  colour and no colour lane to the worker, and `withValueColors` stamps each
  region on the main thread with `colorValue: layer.y` and the scale table the
  worker would have built — a threshold's cuts and range, a ramp's extent off
  the plotted values and its ends off the config. The stamp sits before the
  rows are keyed and the sections offset, so the legend, the hover and the
  shaders read the lane and the table as though the worker had filled them.
  An edit to the colour re-stamps every region and refetches none.
- **A line reads a threshold per fragment.** `lineCommon.slang` places each
  cut's y in the band once per vertex (`lineCutYsPx`) and a value's colour y
  unclamped (`lineColorYPx`), so a cut outside the domain does not land on the
  band edge out-of-domain values clamp onto. The step's rise reads the colour
  at the fragment's own y and its level run at the value's y, so a thick line
  lying on a cut stays one colour; the linear variant reads along the segment
  between its two ends' colour ys. Canvas2D strokes the polyline once per band
  per row (`BandPen`), keeping the parts of each segment inside the band and
  cutting them where they cross its edges, so both backends change colour at
  the same pixel. A band owns its lower edge, so a line on a cut takes the
  colour above it on both.
- **A threshold over another field keeps its lane.** A caller naming
  `colorValue` gets the raw values and resolves the threshold as a ramp's
  uniforms are resolved; a caller naming `color` alone still gets the worker's
  packed palette, which is what the feature display's threshold reads.

## Consequences

- A two-colour line is one mark. The `marks_line_posneg` and
  `marks_line_posneg_linear` scenes join the cross-backend gate; their goldens
  land with the first update run.
- A hover over a threshold-coloured feature prints the interval's label and
  swatch off the key's rows (`MarkTooltip`), reading the raw value, since the
  lane no longer carries a packed colour.
- `drawnScales` treats a threshold with raw values as it treats a ramp: the
  keyless rows follow the values met, not the colours packed.
- `markColor.slang` still has no symlog ramp, and wiggle's per-source colour
  and row are still the open call in
  [wiggle-onto-bar-and-point](../ideas/ready/wiggle-onto-bar-and-point.md).

## Rejected alternatives

- **Resolving the threshold in the worker and splitting a line's quads at the
  cuts.** The geometry grows with the cut count, the split moves with every
  domain change, and a pivot edit still refetches.
- **Copying `y` into `colorValue`.** Four bytes an instance for a lane the
  shader can read from the value slot, and a transfer list that lists one
  buffer twice fails the transfer.
- **Keeping the colour a fetch input and diffing the request.** The worker's
  table is what the legend reads, so a main-thread edit that never reaches the
  worker has to build the table itself anyway; once it does, the request is
  the same with or without the colour.

### Amended 2026-09-30: every colour, not only one over `y`

[ADR-202](adr-202-every-mark-colour-resolves-on-the-main-thread.md) carries
this ADR's main-thread resolution to every colour but a `jexl:` callback.
`valueColor.ts` became `markColor.ts`: `valueColorOf` is `markColorOf` and
`withValueColors` is `withMarkColors`, and the text mark reads the display's
scale as the others do.
