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

`compute.ts` and its stages decide which connections exist, what supports each
and its category; `buildArcBandFeeds` (`features/arcs/bandFeed.ts`) turns that
into each region's channels. The link's geometry, far-pair legs and region table
are render-core's (ADR-163). The display's own rules live in
`plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`.

## Which family an interchromosomal connection joins

Decided per connection by whether both feet are in displayed regions. Both: one
arc, in the cross-region overlay. Otherwise: the two ticks. A tick claims "there
is a connection to somewhere you cannot see", which is false when the far end is
on screen. Three things ride on that, each a silently wrong picture if missed:

- **Arc mode only.** The read cloud's Y axis is insert size, and an
  interchromosomal pair has none (TLEN 0), so `computeArcShape` falls back to the
  endpoint gap, which `arcsYDomainBp` maxes and the ruler prints as an insert
  size. Arc mode's axis is genomic radius, where `INTERCHROM_ARC_YBP` is the band
  ceiling.
- **`drawInter` and `minInterchromSupport` gate both marks** from one hoisted
  condition, so neither mark escapes the setting or the mismapping floor.
- **The hover needs two refNames.** `formatArcTooltip` builds a range from the
  min and max of the two bp, which across chromosomes names one chromosome with a
  coordinate from the other. `endRefName` switches it to two positions and no
  distance.

## Where each connection draws from

**Every arc is filed under one loaded region**, the one holding its first foot,
else its second (`arcOwner`), and draws once across the whole canvas from that
region's feed. Handing it to every region it touches would paint it once per
region at a different extrapolated place.

**Its far foot places through the displayed region holding it**, so a connection
crosses a seam whole. A far foot on no displayed region places along its own
region's axis, and the arc draws block by block under that block's clip
(`ARC_CLIPPED_MARKS`) so it runs off the window edge rather than onto a region
that does not hold its mate.

**A far pair keeps its direction for three screen widths**
(`LINK_FAR_SCREEN_WIDTHS`, 3 not 1). Past the threshold a pair's ellipse becomes
a circle and the band clips it to near-vertical legs, which discards the pair's
direction. The width is the canvas the link draws across, never a block's
(ADR-163): against a block the threshold moves as a region edge scrolls, and a
settled arc would repaint as a different mark mid-pan.

## Paint order is an interest ranking, not a data order

- Between marks, in `ARC_BAND_MARKS`: ticks paint under everything, and both
  renderers draw each mark over every region's feed before the next mark, so no
  region's ticks paint over another region's arcs.
- Within arcs, in `arcPaintOrder`: `arcPaintRank` (categorized over
  uncategorized), then `support`, then dedup key. A deep pileup is overwhelmingly
  concordant pairs painting the baseline slot, so support alone let grey punch
  through the few arcs that mean something.

`resolveArcBandHover` is the single entry point for the band. It asks each mark's
hit test through `nearestMarkHit`, last mark first, so a tie goes to the mark
painted on top, and traces the hit through its own painter (`recordPath`) so the
highlight lies on what was painted.

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

- **The floor shares the window's axis.** `windowFor` splits mate links
  (windowed) from split junctions (window 0); `clearsInterchromFloor` exempts
  split junctions. A chimeric read crosses the breakpoint rather than scattering
  around it, so the mate floor would draw nothing for a translocation carried by
  one split read, the only evidence on unpaired long-read data.
- **The floor applies differently per mark.** An arc is one cluster, so its gate
  tests the number `arcStrokeScale` spends. A tick sums the clusters reaching its
  coordinate, so testing each addend would rewrite what the hover says about the
  data. Ticks push unfiltered and the floor tests `line.support` after
  coalescing. `arcClustering.test.ts` holds both.
- **Clustering is single-linkage over both coordinates at once.** Hierarchical
  clustering on one axis then the other is not symmetric in the two contigs
  (which coordinate is `bpA` depends on which contig name sorts first). The window
  bounds the gap, not the diameter, but measured on real deep data the chain does
  not form. `benches/interchromClusters.probe.ts` re-measures it against the
  fixed-cell alternative, which cuts a real translocation wherever a cell
  boundary falls.

## Support, and why a tick can hide behind an arc's foot

**Both families carry `support`** and spend it through `arcStrokeScale`, the link
mark's size scale that every backend, the export and the hit test read.
Coalescing without keeping the count drew a 40-read translocation like one
mismapped pair.

**Counting differs by evidence, not by mark.** A window suits a mate link, whose
reads straddle a breakpoint they never land on, and misleads for a split
junction, whose read knows the breakpoint to the base. A split junction is never
windowed on either chromosome: chaining acceptors under a fragment-length window
answers "is this a real alternative acceptor" for the reader
([DEMO_DATASETS.md](DEMO_DATASETS.md)'s K562 BCR-ABL1). Window 0 through the same
single-linkage walk gives a split junction `arcKey`'s count while the floor, arc
weight and tick sum read one number. The clustering pass runs at every setting,
not only above the floor.

**An interchromosomal tick sums the distinct clusters reaching its coordinate.**
Reads at the coordinate read 1 for nearly every mate pair, and one cluster's size
misreports where two singleton events share a base; each cluster contributing its
size once survives both, so `clusteredInterchromSupport` returns a cluster
identity per connection, not a count. Ticks matter more than arcs here: a
translocation is usually viewed from one chromosome, where both feet cannot be on
screen.

**Open call:** an N-pair event emits N marks per side, each stroked and hovered as
carrying all N reads, and `compute.test.ts` pins that. Whether to draw one mark
per cluster is filed in
[ideas/collections/arc-band-open-calls.md](../ideas/collections/arc-band-open-calls.md)
§"Draw one mark per interchromosomal cluster".

**A tick is solid, and nothing in the mark separates it from an arc's foot.** The
two land on the same x when a breakpoint has one acceptor the view shows and
another it does not, and both draw `ARC_COLOR_INTERCHROM` at band height, so a
junction with six times the arc's support hid behind the arc's apparent leg. The
tick was dashed to solve this and is solid again by Colin's call (2026-09-02).
**Do not re-dash it without asking.** The read cloud's `[3, 3]` split connector is
the only dashed mark in the band.

The hover carries the claim in words: `partnerOffView` on
`ArcLineTooltipPayload` prints "Outside the displayed regions". The claim is safe
in arc mode and false in read cloud, which ticks every interchromosomal
connection, so the caller reads `readConnections`, the setting `resolveArcs`
branches on.

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
- **The test reaches past the loaded list by `CLOUD_OFFSCREEN_REACH` times the
  fetched span**, so a real event just off the window edge still draws; the sweep
  is in `cloudReachBp`.

The collapse happens in bp in `resolveArcs`, before projection, so the marks draw
it with no geometry of their own. `plotsOnInsertSizeAxis` is the other half:
`maxFlatArcSpanBp` reads the shapes that plot on the axis, not `isFlatArcShape`.

## Questions asked of the band, and of the lanes

**Ask `hasArcBandInk`, not `numArcs`.** A lane whose only interchromosomal partner
is off-region carries ticks and no arcs.

**A question asked across lanes is answered by `computeArcsByGroup`**, not a walk
of `arcsByGroup`: `inkGroupKeys`, `colorSlots` and `maxFlatArcSpanBp`.
Cross-region arcs live outside that feed. `ArcsByGroupResult` explains why all
three compute after regionization: an arc reaching no displayed region is
dropped, and a pre-regionization set would name colours nothing draws.

**Three shape predicates answer three questions.** `isFlatArcShape` asks whether
it draws as a bar; `plotsOnInsertSizeAxis` whether it sizes the axis; only
`ARC_SHAPE_FLAT`, the placed mate link, has a TLEN. `ARC_SHAPE_FLAT_SPLIT` has
`spanBp` equal to its own arc span, so gating the tooltip's insert-size row on the
drawing predicate printed Distance twice.

## Breakend feet

**An interchromosomal arc draws breakend feet, and no other arc does.** A short
horizontal tick at each foot lies over the arm that foot's junction keeps:
outward feet are a deletion-type junction, inward a duplication-type, parallel an
inversion.

- **Scope.** Every interchromosomal connection paints `ARC_COLOR_INTERCHROM`, so
  orientation has no other channel. Same-chromosome arcs keep theirs
  (`unpairedOrientationColor`, and the pair-arc colours in the legend), and every
  foot would land on the baseline. Widening feet to pair arcs was measured and
  declined. The ticks deserve feet and are filed:
  [ideas/collections/arc-band-open-calls.md](../ideas/collections/arc-band-open-calls.md)
  §"Give the interchromosomal ticks breakend feet too".
- **Interchromosomal is always cross-region**, so `buildArcBandFeeds` sets the
  link's `feet` lane on all of it. Feet on same-chromosome cross-region arcs would
  appear and vanish as a reader pans a junction across a seam.
- **The direction belongs to the junction, not the read**, which makes it safe on
  a coalesced arc: reading the molecule from the other end flips both strands and
  the two cancel (`readTrailingBodyDir`, `@jbrowse/cigar-utils`). A `ComputedLine`
  carries none, because a tick coalesces on one coordinate and two junctions
  sharing it would take whichever read came first.
- **The arm, not the foot's own aligned body.** A split junction's endpoint is the
  junction, so `connectionEndpointBps` passes `dir1`/`dir2` through. A mate link's
  endpoint is the fragment's outer edge with the read body pointing back at it, so
  `pairOuterDir` negates the read's direction. Mirroring the two ternaries drew FR
  pairs "duplication" while split reads over the same junction drew "deletion".
  `arcBreakendFeet.test.ts` holds the families against each other.

The feet live in the link mark, so painter, hit test and hover highlight all draw
them. Their sign is the opposite of `tangentSign` (`core/util/bezierConnector.ts`),
the direction a per-read connector leaves the endpoint: a foot lies over the
retained arm and the curve departs across the junction. Neither should be "fixed"
to match the other. A foot clips to its own region's screen extent
(`linkFootLenPx`), and two close feet merge into one bar, which is correct, so a
foot never bounds on the other foot's anchor. `linkMark.test.ts` holds the seam
clip.

## The gesture guard

**An arc outranks the band it is painted over, and it says so as a result
variant.** `runHitTest` returns `arc ?? performHitTest(...)`, so `ArcMarkHit` is a
member of `MarkHitResult` beside the pileup's five. In up mode `computeArcBand`
gives the band `top: 0`, which is the coverage band, and `hitTestInterbase`
answers over it, so a per-gesture `if` guard let a right-click on an arc open the
interbase menu while the tooltip said "Read connection".

- `hoverStateForResult` does not compile without `case 'arc'` (TS2366); that is
  the only compile-time enforcement.
- `handleClick` matches no pileup case for an arc; the explicit `case 'arc':
  return` guards against a future `default:`.
- `contextMenuTargetForHit` returns `undefined` for an arc, so the browser's menu
  opens. The missing items are filed:
  [An arc's right-click offers nothing](../ideas/collections/arc-band-open-calls.md).

`arcGestureGuard.test.ts` works the one pixel where an arc's ink lies over an
interbase bar, finding it by asking the hover rather than projecting the dome.
`mouseGestures.test.ts`'s `cancelAnimationFrame` stub is load-bearing, since
stubbing only `requestAnimationFrame` lets the held callback run.
