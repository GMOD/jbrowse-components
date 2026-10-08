---
status: Accepted
summary: "The alignments display's sashimi arcs draw through render-core's `link` mark, two marks per section (`up` over the coverage histogram, `down` in the strip below it): a dome from donor to acceptor whose `y` is the junction's span as a fraction of its band and whose `size` is its stroke from the read count. The feed is in bp, so a pan or zoom rebuilds no feed, where each arc was an SVG `<path>` patched one `d` per frame: a 120-frame pan over 76 junctions went from about 8,700 DOM mutations to 823. Hover, click and the selection outline go through the marks' own hit test, the SVG export through the shared painter, and the count labels stay a DOM layer placed at the apex the mark reports"
---

# ADR-222: Sashimi arcs are link marks

## Status

Accepted (2026-10-08), Colin's go-ahead on the analysis of where
`plugins/alignments` could lean further into the grammar. Continues
[ADR-170](adr-170-the-read-connections-band-is-a-marks-list.md), which moved
the read-connections band onto the link mark and left sashimi as the display's
one arc layer outside the marks.

## Context

Sashimi drew through a React SVG stack of its own: `projectSashimiArcs` turned
merged junctions into path strings on every pan and zoom frame,
`SashimiArcsOverlay` gave each path its own hover and click handlers, and
`SashimiArcsSvg` repeated the paths for the export. The stroke rule, the hover
widening and the selection outline were each spelled there and nowhere else.

[ADR-163](adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md) §Consequences
already wrote the recipe for this picture: thickness by score is
`encoding.size`, a label a `text` layer beside it, a score floor a filter.
`SVG_EXPORT.md` refuses "interactive" as a reason for a hand-rolled SVG twin,
and `ZoomRenderCensus.test.tsx` carried an arm counting the per-arc DOM rate as
the input to this decision.

## Decision

- **A junction is a `link` instance.** `features/sashimi/bandFeed.ts` builds
  one `SashimiBandFeed` per displayed region and lane: `x` and `x2` are the
  donor and acceptor in bp, `x2Region` the displayed region holding the
  acceptor, `y` the span's fraction of the band (`sashimiArcHeightFraction`, on
  a linear `[0, 1]` scale), `size` the stroke in px (`sashimiStrokeWidth`) and
  `color` the junction's strand.
- **Two marks, `SASHIMI_MARKS`, one per side.** `up` stands on the coverage
  histogram's zero line and clips to the coverage band; `down` hangs from the
  top of the strip the layout reserved and clips to it (`sashimiBandsOf`). A
  side whose band has no height draws nothing.
- **Both renderers and the export walk that list** after every other band, so
  a junction paints over the histogram it overlays.
- **The marks' hit test answers the gestures.** `resolveSashimiHover` asks
  `nearestMarkHit`; a junction outranks the arc band and the pileup because it
  paints last. Hover lights the supporting reads, a click opens the junction,
  and `ArcHoverOverlay` strokes the hovered and the selected junction.
- **Policy stays the display's** (rule 4 of
  [GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md)): the merge,
  the splice-motif classification, the side assignment and the supporting-read
  lookup in `features/sashimi/` feed the channels and are unchanged.
- **The count labels stay a DOM layer**, as the mark display's text is
  ([ADR-162](adr-162-a-text-mark-is-a-dom-layer-placed-by-one-rule.md)), and
  the mark places them: `sashimiLabels` asks render-core's `linkApex` for each
  junction, so a count stands where its arc peaks and nowhere an arc does not
  draw. The labels read the pan, and only while `showSashimiLabels` is on.
- **A track with no junction pays nothing.** The view's region table, which
  reads the pan, is asked for only while a lane has a junction
  (`drawsSashimi`), so `renderState` stays one object across a pan on a track
  of unspliced reads. Gating it on the setting, which is on by default,
  rebuilt it on every frame of every alignments track
  (`sashimiFrameSplit.test.ts`).

## Consequences

- A pan or zoom re-merges nothing and rebuilds no feed
  (`sashimiFrameSplit.test.ts`); the `sashimi-frame-split` measurement
  describes the SVG overlay this replaces. While a lane has a junction the
  region table and `renderState` do rebuild per frame, as they do under the
  read-connections band, and a selected junction's outline is re-traced.
- A band-height drag rebuilds the feeds, since `sashimiJunctionSections` maps
  `renderSections`. Unmeasured.
- A junction whose feet lie in two displayed regions, the collapsed-intron
  case, draws as one arc across the seam through the view's region table.
- The curve is the link's half-ellipse where the overlay drew a cubic. Both
  leave the feet vertically and peak at the same apex.
- A junction wider than three canvas widths draws as the link's far-pair legs
  near its feet. The overlay drew a near-flat line across the view at apex
  height.
- The thinnest stroke is the link's floor, 1.5 device px, where the overlay
  floored at 1 CSS px.
- Hover and selection stroke over the arc at 0.55 opacity, in the overlay the
  read-connection arcs use. The SVG widened the hovered arc's own stroke by
  2 px and outlined the selected one underneath it.
- A junction answers within 2 px of its stroke (`SASHIMI_HIT_SLOP_PX`), ahead
  of the coverage band it overlays. The SVG answered on the stroke alone.
- A press clears a hovered junction or connection, so a pan does not re-ink
  the supporting reads per frame or leave the highlight where the cursor was.
- `plotOnly` exports now carry the arcs, as they carry the read connections:
  the option samples the canvas, and the arcs are on it.
- `SashimiArcsOverlay`, `SashimiArcsSvg`, `projectSashimiArcs`,
  `overlaySections.ts` and the `sashimiArcSections` getter go.
  `SashimiLabelsOverlay` and the `sashimiLabels` getter hold what is left.
- A junction track of its own
  ([a-quantitative-splice-junction-track-of-its-own](../ideas/waiting-on-a-call/a-quantitative-splice-junction-track-of-its-own.md))
  is now a feed and two marks away from the mark display, not a new renderer.

## Known limits

- **A junction zoomed past three canvas widths shows its legs alone.** Inside
  a long intron the SVG drew a flat line overhead; the link's far-pair rule
  draws a circle through the feet, which the band clips to legs off screen, so
  nothing says a junction passes over. Captured before and after at volvox
  `ctgA:35,000-39,000`. The rule is render-core's (`linkIsFar`), shared with
  the read-connections band.
- **A junction in a displayed region past index 255 draws a stem.** The link
  shader's region table holds 256 entries (`LINK_MAX_REGIONS`) and places a
  far foot through it even when the foot is in the instance's own region. The
  read-connections band has the same limit.

## Measured

Production build, headless Chrome on the Canvas2D backend, 1400 px view, a
120-frame pan of 3 px a frame out and back, three runs after a warm-up. The
arms ran one after the other on a shared machine, so the times are indicative
and the mutation counts are the result.

| view | junctions | DOM mutations, before | after | script ms, before | after | median frame ms, before | after |
| ---- | --------: | --------------------: | ----: | ----------------: | ----: | ----------------------: | ----: |
| volvox `spliced.bam`, `ctgA:1-50,000` | 11 | 2,462-2,471 | 1,241-1,261 | 213-286 | 99-171 | 31-35 | 18-24 |
| K562 Iso-Seq, `chr22:23,180,000-23,330,000` | 76 | 8,671-8,693 | 823 | 1,011-1,615 | 624-680 | 75-93 | 55-56 |

## Verification

Driven in the dev build on Canvas2D and WebGL2 over volvox `spliced.bam`:
eleven junctions drew on each, ungrouped and under a strand facet in `down`
mode, the hover named the junction under the cursor and lit its reads, and a
click opened the junction's widget and outlined it. One forward region only;
a reversed region and a junction across two displayed regions are covered by
`sashimiHitTest.test.tsx`. WebGPU was not driven.
