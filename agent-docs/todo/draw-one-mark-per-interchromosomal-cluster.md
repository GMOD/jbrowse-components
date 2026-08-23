---
name: draw-one-mark-per-interchromosomal-cluster
description: a figure-changing decision; pick the position rule first
metadata:
  area: alignments
  category: ready
---

# Draw one mark per interchromosomal cluster

An N-pair translocation draws **N marks per side, each claiming N**. The
clustering's own premise is that mate pairs never share a coordinate — 862 of 865
were the sole occupant of theirs — so `arcKey` and `pushLine` coalesce nothing,
every connection becomes its own mark, and `resolveArcs` hands each of them the
whole cluster's size. An 8-pair event is 8 arcs (or 8 + 8 ticks), each stroked as
though it alone carried 8 reads and each hovering "supported by 8".
`compute.test.ts` pins the current answer as `[5,5,5,5,5,5,5,5,5,5]` for five
pairs, and `ARC_BAND.md` describes the trade as "two coordinates of one event",
which is what it would be if the marks were 2.

The ink is O(N) marks at `arcLineWidth(N)` where the evidence is one junction —
the opposite of what coalescing was introduced for on the same-chromosome arm
("57% of the arcs in that window were exact repeats"), and it lands hardest on the
mark that is a full-height opaque vertical.

**The blocker is stated in `resolveArcs` and it is answerable**: "merging a
cluster would have to invent a position for it, which is the thing `arcKey`'s
exact-coordinate rule exists to refuse". A REPRESENTATIVE member invents nothing —
it is one of the reads' own coordinates, which is the rule already in force. So
the decision is which one:

- **the junction-facing extreme.** A mate-pair cluster brackets the breakpoint
  from one side, so the innermost supporting read is the tightest defensible point
  estimate, and `p1Dir` already says which side that is. Closest to what an SV
  caller would report.
- **the median member.** Robust, says nothing about direction, and reads as "the
  cluster is here".
- **an interval instead of a point**, which is the honest mark for evidence that
  is not localized: a tick widened to the cluster's own bp extent. Needs
  `arcLine.slang` to take a span rather than a position, so it is the expensive
  one — but it is the only option that does not have to choose a lie.

Whichever wins, the hover should say the localization (`±window`), and the arc arm
takes the same treatment as the tick arm. **This changes what every published
translocation figure looks like**, so land it deliberately and re-render the
`cancer_sv` set: `reference/DEMO_DATASETS.md`.

**Do not read the `arcKey` rule across to argue against merging.** That rule
refuses to merge DISTINCT junctions on a tolerance, and it is right — five
events inside 2.3 kb are five events. Here the same pass has already decided,
on both sides, with the floor spending that decision, that the cluster is one
event. Drawing it as N marks is refusing to act on a conclusion already drawn.

**And "make the clustering zoom-dependent" is the right instinct aimed at the
wrong pass.** Two questions get conflated. *What is one event* is a
library-scale fact in bp, zoom-independent, and belongs exactly where it is.
*What should be drawn as one mark* is a rendering fact in px, zoom-dependent,
and belongs at draw time. `arcsResult` deliberately does not read
`view.bpPerPx`: it is invalidation tier 4 (rebuilt on data, settings and
navigation) where zoom is tier 5 (repaint), so feeding zoom into it reruns
`groupReadsByName`, the SA walk and the whole per-read connection resolution on
every zoom step — the display's CLAUDE.md names that tier boundary as the thing
not to break, and this would break it for every lane at once. The zoom-dependent
half, if wanted at all, is a **draw-time coalescer**: given marks already
carrying a cluster id, collapse those closer than a few px. That is a
render-tier pass over the packed feed, costs no refetch, and is strictly
optional — one mark per cluster fixes the wrong-picture problem on its own, at
every zoom.

**The surface it crosses**, which is why this is not small: `arcMark`'s
`ArcDome` has one x per foot, so a mark gains an extent rather than a
coordinate; `hitTestArcBand` scans per-instance arrays, so what an index means
and what `arcLinePositions` holds both change; `formatArcTooltip` reports two
exact bp and would report a range; and a cluster's members can disagree on arm
direction where today each mark carries its own read's. Take it with a real
dataset open rather than off the fixtures — `cancer_sv/k562_bcr_abl_split` and
the HG002 300x window at 1:2,000,000 (`reference/DEEP_COVERAGE.md`), in that
order. Every argument here is an argument about what a reader concludes, and
the fixture tests cannot settle it.
