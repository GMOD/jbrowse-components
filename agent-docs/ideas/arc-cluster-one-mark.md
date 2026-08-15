---
name: arc-cluster-one-mark
description: A windowed interchromosomal cluster draws one mark per supporting pair, each stamped with the whole cluster's weight — so the picture says N junctions where the data says one. What a single mark would cost, and why making the clustering zoom-dependent is the wrong shape for it.
---

# One mark per cluster, not N marks at the cluster's weight

`clusteredInterchromSupport` groups an interchromosomal MATE link's supporting
pairs over a fragment-length window, and every connection in the cluster is then
drawn as its own mark carrying the whole cluster's `support`. A hundred-pair
translocation draws **a hundred arcs (or ticks), each four times base width, each
hovering "Supported by 100 reads"**.

Every mark is individually true and the ensemble is not: a reader sees a hundred
junctions where the data says one.

## Scope, after the window-0 fix

Smaller than it was. A SPLIT junction now clusters at window 0, so its
exactly-coincident reads coalesce under `arcKey` into **one** arc and one tick
already — K562's 154-read acceptor is one mark of weight 154, which is the right
picture. What is left is interchromosomal **mate-pair** evidence, where the
supporting reads genuinely land on a hundred different coordinates.

So this is one family of one mark kind, not a band-wide problem.

## Why "merging would have to invent a position" does not hold

That is the reason `resolveArcs` currently gives, and it is the weak link. A
cluster HAS a position: its members' extent, and a centre inside it. Drawing one
mark from the donor cluster's extent to the acceptor cluster's extent is a
statement the data supports — it is how SV callers draw a breakpoint, confidence
interval and all. What is not supported is a hundred marks each claiming the
whole cluster.

The `arcKey` rule this borrows from is about a different thing and should not be
read across: it refuses to MERGE DISTINCT JUNCTIONS on a tolerance, and it is
right, because five events inside 2.3 kb are five events. Here the cluster has
already been decided to be one event — by the same pass, on both sides, with the
floor spending that decision. Refusing to draw it as one is refusing to act on a
conclusion already drawn.

## The zoom question, and why the obvious answer is the wrong shape

Two questions get conflated, and separating them is most of the design:

- **What is one event?** A library-scale fact, in bp. Zoom-independent, and it
  belongs exactly where it is.
- **What should be drawn as one mark?** A rendering fact, in px. Zoom-dependent,
  and it belongs at draw time.

So "make the clustering depend on zoom" is the right instinct pointed at the
wrong pass. `arcsResult` deliberately does not read `view.bpPerPx`: it is
invalidation tier 4 (rebuilt on data, settings and navigation) while zoom is tier
5 (repaint). Feeding zoom into it would rerun `groupReadsByName`, the SA walk and
the whole per-read connection resolution on **every zoom step** — the display's
CLAUDE.md names that tier boundary as the thing not to break, and this would
break it for every lane at once.

The zoom-dependent half, if wanted, is a **draw-time** coalescer: given marks
already carrying a cluster id, collapse those closer than a few px. That is a
render-tier pass over the packed feed, costs no refetch, and is the honest place
for "these are too close to distinguish". It is also strictly optional — one mark
per cluster fixes the wrong-picture problem on its own, at every zoom.

## What it would cost

Not large, but it crosses the band's whole surface, which is why it is filed
rather than done:

- **Geometry.** A mark gains an extent rather than a coordinate — a foot that is
  a range. `arcMark`'s `ArcDome` has one x per foot today.
- **Hit test.** `hitTestArcBand` scans per-instance arrays; one mark per cluster
  changes what an index means and what `arcLinePositions` holds.
- **Tooltip.** "Supported by N reads" gains a position range, and
  `formatArcTooltip` currently reports two exact bp.
- **Breakend feet.** A cluster's members can disagree on arm direction; today
  each mark carries its own read's.
- **Figures.** `cancer_sv/*` and the arc-band snapshots all change.

## Recommendation

Take it only with a real dataset open — this is a judgement about a picture, and
every argument above is an argument about what a reader concludes. The fixture
tests cannot settle it. `cancer_sv/k562_bcr_abl_split` and the HG002 300x window
at 1:2,000,000 (reference/DEEP_COVERAGE.md) are the two to look at, in that
order.
