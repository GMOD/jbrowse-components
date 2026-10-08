---
name: arc-band
description: The alignments read-connection band draws arcs, read-cloud bars, squares and interchromosomal ticks as link and point marks sharing one rect, y scale and palette, so paint order, hit priority and support floors are one subsystem. Read before adding a mark to it.
audience: internal
kind: spec
---

# The alignments arc band

The band is a marks list (ADR-170), `ARC_BAND_MARKS` in
`LinearAlignmentsDisplay/renderers/arcMarks.ts`: interchromosomal ticks as link
stems, the arcs (a `dome` link) or the read cloud's bars (a `line` link), the
cloud's split-read connectors as a second, dashed link, and the cloud's endpoint
squares as a point mark. They share one rect, one y scale and one palette and
overlap freely, so which mark a hover resolves to, which one a setting hides and
which one paints on top are one question asked in three places. The answers have
to agree.

## Which family an interchromosomal connection joins

Decided per connection by whether both feet are in displayed regions. Both: one
arc, in the cross-region overlay. Otherwise: the two ticks. A tick claims "there
is a connection to somewhere you cannot see", which is false when the far end is
on screen. Three things ride on that, each a silently wrong picture if missed:

- **Arc mode only.** The read cloud's Y axis is insert size, and an
  interchromosomal pair has none (TLEN 0), so `computeArcShape` falls back to the
  endpoint gap, which `arcsYDomainBp` maxes and the ruler prints as an insert
  size. Arc mode draws the arc unvalued (`arcCrossLink`), half as tall as its
  feet are apart, since it has no genomic radius.
- **`showInterchrom` and `minInterchromSupport` gate both marks** from one hoisted
  condition, so neither mark escapes the setting or the mismapping floor.
- **The hover needs two refNames.** `formatArcTooltip` builds a range from the
  min and max of the two bp, which across chromosomes names one chromosome with a
  coordinate from the other. `endRefName` switches it to two positions and no
  distance.

## Paint order is an interest ranking, not a data order

- Between marks, in `ARC_BAND_MARKS`: ticks paint under everything, and both
  renderers draw each mark over every region's feed before the next mark, so no
  region's ticks paint over another region's arcs.
- Within arcs, in `arcPaintOrder`: `arcPaintRank` (categorized over
  uncategorized), then `support`, then dedup key. A deep pileup is overwhelmingly
  concordant pairs painting the baseline slot, so support alone let grey punch
  through the few arcs that mean something.

## What may hide an arc

**"Concordant" has one definition.** `isConcordantPairRead`
(`packages/alignments-core/src/orientation.ts`) is the aligner's verdict. The
worker's "Show proper pairs" filter (`isProperPairChain`) and the "Show
concordant-pair arcs" filter (`resolveArcs`) both call it, and
`concordantPairParity.test.ts` holds them together. The arc filter also requires
the arc to paint the baseline colour slot (`arcPaintRank`), so "hidden" equals
"grey" under any `colorByType`. The read cloud's `isConcordantFRPair` is a
different, deliberate reading: |TLEN| in the modal band.

**A support floor exists only for interchromosomal mate links** (either mark),
not for same-chromosome arcs or split junctions. `minInterchromSupport` counts a
mate link's reads over a window of one fragment length on both sides
(`clusteredInterchromSupport`), never at a coordinate: mates straddle a
breakpoint, so `arcKey`'s exact count is 1 for nearly every interchromosomal pair
and a floor over it would delete real translocations. Clusters count over every
lane at once (`interchromClusters`), since grouping by strand scatters a
breakpoint's pairs. The same floor on same-chromosome arcs was measured and
declined as a density filter, not an evidence filter
([DEEP_COVERAGE.md](DEEP_COVERAGE.md)).

## Support, and why a tick can hide behind an arc's foot

**A tick is solid, and nothing in the mark separates it from an arc's foot.** The
two land on the same x when a breakpoint has one acceptor the view shows and
another it does not, and both draw `ARC_COLOR_INTERCHROM` at band height, so a
junction with six times the arc's support hid behind the arc's apparent leg. The
tick was dashed to solve this and is solid again by Colin's call (2026-09-02).
**Do not re-dash it without asking.** The read cloud's `[3, 3]` split connector is
the only dashed mark in the band.

## The read cloud draws a bar only between two places on screen

A flat mark whose partner is outside every loaded region collapses onto the end
the view can place and sits at the floor of the band's scale
(`ARC_SHAPE_FLAT_UNPLACED`, inset `ARC_BAND_INSET_PX`). Otherwise the bar
extrapolates off the screen edge to a coordinate nothing covers, and that span
sets `arcsYDomainBp`, which every lane shares: mismapped mates squeezed every
real pair into the top third of the axis.

- **It is a placement test, not a span threshold.** A pair 5 Mb apart with both
  ends in displayed regions draws between two real pixels and belongs on the
  axis; a pair 30 kb apart in a 20 kb window does not.
- **Ask the loaded list, not `displayedRegions`.** An ordinary LGV's one displayed
  region is the whole chromosome, so every mate would read as placeable.
  `cloudUnplaced.test.ts` pins the distinction.

## Breakend feet

**An interchromosomal arc draws breakend feet, and no other arc does.** A short
horizontal tick at each foot lies over the arm that foot's junction keeps:
outward feet are a deletion-type junction, inward a duplication-type, parallel an
inversion.

## The gesture guard

**An arc outranks the band it is painted over, and it says so as a result
variant.** `runHitTest` returns `arc ?? performHitTest(...)`, so `ArcMarkHit` is a
member of `MarkHitResult` beside the pileup's five. In up mode `computeArcBand`
gives the band `top: 0`, which is the coverage band, and `hitTestInterbase`
answers over it, so a per-gesture `if` guard let a right-click on an arc open the
interbase menu while the tooltip said "Read connection".

