---
status: Accepted
summary: "The alignments read-connections band's four private shapes are the grammar's marks: the dome is `link` under `linkShape: 'dome'`, the read cloud's flat connector is `linkShape: 'line'` — GenomeSpy's fourth value, which ADR-163 skipped — the endpoint square is a `point` glyph, and the interchromosomal tick is the link's own stem. The view-scope region table lifts out of the mark display so any mark places a foot through it, which retires `CrossRegionArcsOverlay` and its SVG twin outright. `cloud` stops being a boolean: arc mode and the read cloud differ in mark shape, y scale and one filter. The connector takes its category colour, the feet stay on interchromosomal arcs by choice, and `readConnectionsDown` becomes the y scale's direction"
---

# ADR-170: The read-connections band is a marks list

## Status

Accepted (2026-09-25), Colin's calls of 2026-09-25 on the second of the three
[pending-calls](../handoffs/pending-calls.md) decisions, and his answers on the
connector's colour and the breakend feet.
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) and
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) carry the operational
description. Continues
[ADR-163](adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md), which named
the band as the link mark's next consumer.

## Context

`arcMarks.ts` already defines the band through `defineMark`, so the band is a
marks list whose four shapes are private: `arc`, `arcFlat`, `arcLine` and
`arcMarker`, with `hitTestArcBand`, `drawCanvas.ts` and `mark.ts` mirroring each
one for the painter, the export and the hover. `linkMark.slang` is a copy of
`arc.slang`'s geometry, written that way in ADR-163 so the band could adopt it.

Two things were missing rather than different. GenomeSpy's link mark is
`linkShape: "arc" | "diagonal" | "line" | "dome"`, and ADR-163 took two of the
four — so the read cloud's flat connector reads as a second geometry when it is
the same mark's fourth shape. And the view's displayed-region table, which is
what lets a curve cross a region holding neither foot, sits on the mark
display's model as a getter, private to `link`. Keeping it there is what forces
every other shape in the band to reach the DOM overlay to cross a seam.

## Decision

- **Each private shape is a mark the grammar already spells.** The dome is
  `link` under `linkShape: 'dome'`; the read cloud's flat connector is
  `linkShape: 'line'`; the endpoint square is a `point` glyph; and the
  interchromosomal tick, drawn where the mate lies on no displayed region, is
  the link's own stem, whose length becomes a param since the band's spans its
  whole height.
- **`linkShape: 'line'` is GenomeSpy's fourth value**, not a flat case bolted
  onto the dome. Both feet place through the region table, so a cloud bar
  crosses a seam the way a dome does.
- **The region table lifts into `display-kit`**, and any mark drawing at view
  scope places a foot through it. `CrossRegionArcsOverlay`,
  `CrossRegionArcsSvg` and `crossRegionOverlay.ts` go with it, and so does
  `hitTestArcBand`, whose answer is `nearestMarkHit`.
- **`cloud` stops being a boolean.** Arc mode and the read cloud differ in three
  declarations: the mark's shape, the y scale (a genomic radius on a linear
  axis, or `|TLEN|` on a log one) and a filter to discordant pairs. The setting
  picks which marks the band derives.
- **The read cloud's connector takes its category colour.** The neutral line
  under coloured endpoint squares was samplot's picture; one colour encoding
  covers the link and the points, and the bar reads at the zooms where the
  squares are all that is drawn.
- **Breakend feet stay on interchromosomal arcs.** They draw there today
  because the DOM overlay is what draws them and an interchromosomal junction
  is always cross-region; after the port that boundary is gone, so the same
  picture becomes a channel the band feeds interchromosomal arcs and no others.
  Colin's call, over giving every deletion, duplication and inversion its own.
- **`readConnectionsDown` becomes the y scale's direction.** `arcYScale.ts`
  records that the anchor flip was written five times; a direction on the scale
  is the one place that rule lives, and the insert-size ruler reads the same
  scale the marks do.
- **What stays is policy.** `compute.ts`, `arcChains.ts`, `arcClustering.ts`,
  `arcColors.ts` and `arcRegions.ts` decide which arcs exist, what supports
  each one and which category it falls in. Those feed `x`, `x2`, `y`, `size`
  and `color`; rule 4 of the grammar handoff keeps them the display's.

## Consequences

- A junction's support count reaches the stroke through `encoding.size` on a
  log scale, and the band's nine-slot palette through `encoding.color`, so the
  legend, the hover, the SVG export and the hit test read one object each.
- A cloud bar and an endpoint square cross a region seam, which neither does
  today except through the overlay.
- The band draws through `markPaint`, so a zoom writes the region table and
  touches no DOM, the way ADR-163's links do.
- `arc.slang`, `arcFlat.slang`, `arcLine.slang`, `arcMarker.slang`,
  `arcBandUniforms.slang`, `drawCanvas.ts`, `mark.ts`, `arcPath.ts`,
  `shapes.ts` and `hitTest.ts` go, along with the two cross-region components
  and `crossRegionOverlay.ts`.
- The review round's open item 3 — `linkRegions` summing bp while a circular
  ring lays slices out with `spacingPx` between them — becomes one place to fix
  rather than two.

## Rejected alternatives

- **A `rule` mark for the flat connector.** Vega-Lite's rule is the right shape
  for a segment at a constant y, but GenomeSpy puts this picture on the link
  mark, and a connector between two loci that places each foot through the
  region table is the link's job. A second mark would spell it twice.
- **Porting the curved arcs only, leaving the cloud on its own pass.** The
  overlay survives to draw cross-region bars, so two drawing paths, two hovers
  and two exports survive with it — and retiring the overlay is what the port
  is for.
- **Giving every arc its breakend feet.** Colin's call went the other way; a
  deletion and a duplication inside one region read their type from the arc's
  colour, and the fan over a well-supported junction is already dense.
- **`clampApex` and `arcHeightFactor` as link properties**, which is how
  GenomeSpy spells the apex rule our `dome` and `arc` fuse. Nothing in the tree
  asks to set either: `linkMark.slang` already carries the band's 0.75 apex
  fraction and its clamp, so both would land with one consumer and no picture
  that needs them.
