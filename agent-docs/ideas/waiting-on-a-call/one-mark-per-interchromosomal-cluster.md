---
name: one-mark-per-interchromosomal-cluster
description: An N-pair translocation draws N arcs or ticks per side, each stroked and hovered as though it alone carried all N reads; drawing one mark per cluster needs a position rule chosen and changes every published translocation figure.
---

# One mark per interchromosomal cluster

A visual call [reference/ARC_BAND.md](../../reference/ARC_BAND.md) leaves
open. The band draws on render-core's link and point marks (ADR-170), so the
costs below are priced against those.

An N-pair translocation draws **N marks per side, each claiming N**. Mate pairs
never share a coordinate (862 of 865 were the sole occupant of theirs), so
`arcKey` and `pushLine` coalesce nothing, every connection becomes its own mark,
and `resolveArcs` hands each of them the whole cluster's size. An 8-pair event
is 8 arcs (or 8 + 8 ticks), each stroked as though it alone carried 8 reads and
each hovering "supported by 8". `compute.test.ts` pins the current answer as
`[5,5,5,5,5,5,5,5,5,5]` for five pairs; one mark per cluster would be 2 per
event. The ink is O(N) marks at `arcStrokeScale`'s width for N where the
evidence is one junction, the opposite of what coalescing was introduced for on
the same-chromosome arm, and it lands hardest on the full-height opaque tick.

`compute.test.ts` states the blocker: the cluster "is not merged, because
merging would have to invent a position for it". A representative member
invents nothing; it is one of the reads' own coordinates. So the call is which
one:

- **The junction-facing extreme.** A mate-pair cluster brackets the breakpoint
  from one side, so the innermost supporting read is the tightest defensible
  point estimate, and `p1Dir` already says which side that is.
- **The median member.** Robust, says nothing about direction, and reads as
  "the cluster is here".
- **An interval instead of a point**: a tick widened to the cluster's own bp
  extent. The link's stem is a line at one x, so this needs a mark that takes a
  span, which makes it the expensive one, but it is the only option that does
  not have to choose a position.

Whichever wins, the hover says the localization (`±window`), and the arc arm
takes the same treatment as the tick arm.

- **The `arcKey` rule is no argument against it.** That rule refuses to merge
  distinct junctions on a tolerance, since five events inside 2.3 kb are five
  events. Here the same pass has already decided, on both sides, that the
  cluster is one event.
- **Not a zoom-dependent clustering.** What is one event is a library-scale
  fact in bp and stays where it is. `arcsResult` does not read `view.bpPerPx`:
  it is invalidation tier 4 where zoom is tier 5, so feeding zoom in reruns
  `groupReadsByName`, the SA walk and the per-read connection resolution on
  every zoom step. A draw-time coalescer over marks already carrying a cluster
  id is the optional zoom-dependent half.
- **The surface it crosses**: a mark gains an extent rather than a coordinate;
  the feed's hover records are per instance, so what an index means changes;
  `formatArcTooltip` reports two exact bp and would report a range; and a
  cluster's members can disagree on arm direction.

Take it with real data open rather than the fixtures:
`cancer_sv/k562_bcr_abl_split`, then the HG002 300x window at 1:2,000,000
([DEEP_COVERAGE.md](../../reference/DEEP_COVERAGE.md)). It changes what every
published translocation figure looks like, so land it deliberately and
re-render the `cancer_sv` set
([DEMO_DATASETS.md](../../reference/DEMO_DATASETS.md)).
