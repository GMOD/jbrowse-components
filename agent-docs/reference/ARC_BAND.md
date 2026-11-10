---
name: arc-band
description: The alignments read-connection band draws arcs, read-cloud bars, squares and interchromosomal ticks as link and point marks sharing one rect, y scale and palette, so paint order, hit priority and support floors are one subsystem. Read before adding a mark to it.
audience: internal
kind: spec
---

# The alignments arc band

The band is a marks list (ADR-170), `ARC_BAND_MARKS` in
`LinearAlignmentsDisplay/renderers/arcMarks.ts`: interchromosomal ticks as link
stems, the arcs (a `dome` link) or the read cloud's bars (a `line` link), and
the cloud's endpoint squares as a point mark. They share one rect, one y scale and one palette and
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
- **The `connection.interchrom` and `breakpoint.reads` filter fields gate both marks** from one hoisted
  condition, so neither mark escapes the setting or the mismapping floor. The
  curved connectors over the pileup take the same verdict from the collection
  stage (`collectArcs`' `belowFloor`), by QNAME, even with the band off.
- **The hover needs two refNames.** `formatArcTooltip` builds a range from the
  min and max of the two bp, which across chromosomes names one chromosome with a
  coordinate from the other. `endRefName` switches it to two positions and no
  distance.

**Where it draws is the feet; what it is, the pair.** A translocated mate's
supplementary can sit beside its partner, so both drawn ends share a chromosome
while the pair's RNEXT names another. That mate link draws as an ordinary arc
but paints `ARC_COLOR_INTERCHROM` and answers `connection.interchrom`
(`PairedPendingArc.interchrom`), as the read fill and the pileup connector over
the same two reads do. Its pair orientation was computed across references and
means nothing.

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
worker's `svSignal` read filter (`discordantBit`, ADR-229) and the "Show
ordinary pairs" arc filter (`resolveArcs`) both call it, and
`concordantPairParity.test.ts` holds them together. The arc filter also requires
the arc to paint the baseline color slot (`arcPaintRank`), so "hidden" equals
"grey" under any `colorByType`. The read cloud's `isConcordantFRPair` is a
different, deliberate reading: |TLEN| in the modal band.

**A support floor exists only for interchromosomal mate links** (either mark),
not for same-chromosome arcs or split junctions. `minInterchromReads` counts a
mate link's reads over a window of one fragment length on both sides
(`clusteredInterchromSupport`), never at a coordinate: mates straddle a
breakpoint, so `arcKey`'s exact count is 1 for nearly every interchromosomal pair
and a floor over it would delete real translocations. Clusters count over every
lane at once (`interchromClusters`), since grouping by strand scatters a
breakpoint's pairs. The same floor on same-chromosome arcs was measured and
declined as a density filter, not an evidence filter
([DEEP_COVERAGE.md](DEEP_COVERAGE.md)).

**An interchromosomal connection draws only between placed records** (MAPQ
above 0): a mate link's two primaries, a split read's two pieces (the SA
piece's MAPQ read off its tag, `SegAln.placed`), and an off-screen mate, which
also needs its mate placed where the MQ tag says (`READ_MATE_UNPLACED`, a
category bit beside the tier). `shared/placedReads.ts` is the one test; the
band's producers in `arcChains.ts` and the connectors' `connectorFilterOf` both
ask it. ADR-229 counts a MAPQ-0 record as no evidence. On HG008-T Illumina at
195x every tick drawn over SV channels' "No SV evidence" band came from a
MAPQ-0 read: 173 records at CDKN2A, 163 at chr19:11.2 Mb. Same-chromosome arcs
keep MAPQ-0 reads; the gate is for the family the floor above already treats
as mismapping-prone. Without MQ tags a mate counts as placed, as `svSignal`
counts it.

**Support counts fragments, not records.** A mate link whose two ends' unclipped
5' positions and strands repeat another's (`fragmentEndsKey`: aligned 5' edge,
the clip before it, strand; `PairedPendingArc.p1Clip`) is a PCR or optical
copy. It still draws and keeps its cluster and QNAME, so `belowFloor` and the
connectors agree, but adds nothing to a cluster's size or a coalesced arc's
support. The key is built only where connections already coincide, an
interchromosomal cluster of two or more or a second connection on one `arcKey`,
never in the per-read collection loop. The clip is in the key because every
read crossing one junction shares the aligned edge there: without it a
breakpoint's distinct molecules collapse. Split junctions are never copies; reads agreeing on
one to the base are its evidence. HG008-T Illumina at 195x is four lanes merged
and never duplicate-marked (no 0x400 flags); there the copies were 50 of the 51
ticks this removed at chr19:11.17-11.245 Mb and 47 of 51 at CDKN2A: records
sharing one start, CIGAR and mate position, most on one flowcell tile.

**A supplementary with no primary in view draws no mate link**
(`resolveReadGroup`). Its RNEXT names the whole fragment's mate, joined to the
off-screen primary, so a tick from it claims an adjacency the molecule does not
have; its own junction draws through the SA chain. At chr19:11,187,840, where
34 bp supplementaries of chr15 reads land, the tick named 13 partner loci
beside chr15 (chr14, chr1, chr7, ...), each the mate of a read whose primary is
on chr15; it now names chr15 alone, the split reads' junction.

**MAPQ 20 was measured and declined.** It thinned the partner band further, but
a tick at MAPQ 1-19 is uncertain, not wrong, and minimap2 scores short
supplementaries below 20, so it would hide real templated-insertion pieces on
long reads (COLO829's der(3)). The two rules above each remove a tick the reads
show to be false.

## Support, and why a tick can hide behind an arc's foot

**A tick is solid, and nothing in the mark separates it from an arc's foot.** The
two land on the same x when a breakpoint has one acceptor the view shows and
another it does not, and both draw `ARC_COLOR_INTERCHROM` at band height, so a
junction with six times the arc's support hid behind the arc's apparent leg. The
tick was dashed to solve this and is solid again by Colin's call (2026-09-02).
**Do not re-dash it without asking.** No mark in the band is dashed: the read
cloud's split bars draw solid like its pairs, color carrying the split class,
and a dashed lane for them was cut (2026-10-31).

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

**A connection between two chromosomes draws breakend feet, and no other arc
does**, a same-chromosome link painted inter-chromosomal included. A short
horizontal tick at each foot lies over the arm that foot's junction keeps:
outward feet are a deletion-type junction, inward a duplication-type, parallel an
inversion. A tick draws the one foot at its own end, so a tick is a breakend,
keyed on position and kept side (`pushLine`): two junctions on one base keeping
opposite sides draw two ticks, each with its own foot and support.

## The gesture guard

**An arc outranks the band it is painted over, and it says so as a result
variant.** `runHitTest` returns `arc ?? performHitTest(...)`, so `ArcMarkHit` is a
member of `MarkHitResult` beside the pileup's five. In up mode `laneBands`
gives the band `top: 0`, which is the coverage band, and `hitTestInterbase`
answers over it, so a per-gesture `if` guard let a right-click on an arc open the
interbase menu while the tooltip said "Read connection".

