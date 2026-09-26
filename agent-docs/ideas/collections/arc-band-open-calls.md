---
name: arc-band-open-calls
description: Four parked calls on the read-connection band and the read cloud, cut from TODO.md on 2026-08-26 for missing the v5.0.0 bar; a fifth, the clipped parked row, was settled by the band's port onto the link and point marks. Three are marks and geometry, one is a menu. Read alongside reference/ARC_BAND.md, the settled half.
---

# The arc band's open calls

Items cut from `TODO.md` on 2026-08-26, when the backlog was reduced to
what v5.0.0 turns on. [reference/ARC_BAND.md](../../reference/ARC_BAND.md) is the
settled description of this band, and everything below is what it deliberately
does not answer. All are visual calls, which is why they are filed rather than
fixed — a fixture test cannot settle what a reader concludes. Two measurements
this list carried — whether single-linkage chains a cluster past its window,
and how many arcs cross a seam at 300x — were read on 2026-09-10; the first
lives in ARC_BAND.md §"Support". The band now draws on render-core's link and
point marks (ADR-170), so the costs below are priced against those.

## Marks and geometry

### Draw one mark per interchromosomal cluster

It changes what every published translocation figure looks like, which is the
last thing to take inside a release window, and three position rules are
unchosen.

An N-pair translocation draws **N marks per side, each claiming N**. The
clustering's own premise is that mate pairs never share a coordinate — 862 of 865
were the sole occupant of theirs — so `arcKey` and `pushLine` coalesce nothing,
every connection becomes its own mark, and `resolveArcs` hands each of them the
whole cluster's size. An 8-pair event is 8 arcs (or 8 + 8 ticks), each stroked as
though it alone carried 8 reads and each hovering "supported by 8".
`compute.test.ts` pins the current answer as `[5,5,5,5,5,5,5,5,5,5]` for five
pairs, and `ARC_BAND.md` describes the trade as "two coordinates of one event",
which is what it would be if the marks were 2.

The ink is O(N) marks at `arcStrokeScale`'s width for N where the evidence is one junction —
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
  is not localized: a tick widened to the cluster's own bp extent. The link's
  stem is a line at one x, so this needs a mark that takes a span, which makes
  it the expensive one — but it is the only option that does not have to choose
  a lie.

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

**The surface it crosses**, which is why this is not small: a link has one x
per foot, so a mark gains an extent rather than a coordinate; the feed's hover
records are per instance, so what an index means changes; `formatArcTooltip`
reports two exact bp and would report a range; and a cluster's members can
disagree on arm direction where today each mark carries its own read's. Take it with a real
dataset open rather than off the fixtures — `cancer_sv/k562_bcr_abl_split` and
the HG002 300x window at 1:2,000,000 (`reference/DEEP_COVERAGE.md`), in that
order. Every argument here is an argument about what a reader concludes, and
the fixture tests cannot settle it.

### Give the interchromosomal ticks breakend feet too

Unfinished, not wrong: a tick that says nothing about direction is worse than
one that does, and no worse than the last release's.

An interchromosomal arc draws a foot at each end — a short horizontal tick lying
over the sequence that end keeps, so outward reads as a deletion-type junction,
inward as a duplication-type and parallel as an inversion (the link mark's
`feet` lane, and [reference/ARC_BAND.md](../../reference/ARC_BAND.md) §"Breakend
feet"). An interchromosomal connection whose partner is **off screen** draws as
a TICK instead, and ticks carry no feet.

That is unfinished, not declined. A tick means "the partner is somewhere you
cannot see", and the direction at the near foot is exactly as informative there
— arguably more, since there is no second endpoint to read the orientation off.

The drawing half is now free: a tick is a link stem, and the link draws a foot
at a stem's placed end from the same `feet` lane, in every backend, the export
and the hit test. What is left is the direction, below, and setting the lane
in `buildArcBandFeeds`. `LinearAlignmentsDisplay/components/arcBreakendFeet.test.ts`
is where a tick-foot direction assertion lands.

The direction itself is already computed and already correct for this case:
`readTrailingBodyDir` is a property of the junction rather than of the read, so a
tick coalescing several reads on one coordinate has one answer — but note that a
`ComputedLine` deliberately carries none today, and two junctions sharing a
breakpoint would otherwise take whichever read arrived first. Decide that before
packing a direction into the tick buffer.

Whichever direction a tick's foot ends up taking, it is the OFF-SCREEN-partner
case, so `pairOuterDir`'s distinction applies to it too: the mate-link producers
answer with the read's direction negated, because their endpoint is the
fragment's outer edge rather than the junction.

### Read cloud ticks every interchromosomal connection as a full-band vertical

Reported from use rather than measured as wrong, and a tick carries two things —
the partner name and the support width — that the obvious replacement does not.

In read-cloud mode `resolveArcs` sends **every** interchromosomal connection to
the connector-tick family, displayed partner or not — the exclusion
[reference/ARC_BAND.md](../../reference/ARC_BAND.md) spells out under "Which family
an interchromosomal connection joins". The reason is sound: the cloud's Y axis is
|TLEN|, an interchromosomal pair carries TLEN 0, and `computeArcShape` would fall
back to the endpoint gap — about 1.07e8 for a real chr9/chr22 junction — which
becomes a genuine `maxFlatArcSpanBp` and rescales the whole cloud.

A tick is a solid vertical spanning the band (a link stem `stemPx` the band's
height). Reported from
use: over a read cloud they are hard to read, because a vertical crossing every
plotted row looks like it belongs to each of them and belongs to none.

They are not numerous — `minInterchromSupport` drops 98.2% of them, leaving
about 16 in a 200 kb window at 300x ([DEEP_COVERAGE.md](../../reference/DEEP_COVERAGE.md))
— so this is about legibility rather than density.

#### What changed that makes this worth revisiting

The band now HAS a home for "a connection with no place on the insert-size
axis": the parked row at the scale's floor, which is exactly the statement an
interchromosomal connection is making. Before that row existed there was nowhere
else for these to go, and the full-band vertical was the only mark available.

#### The call, and what a square would cost

Two things a tick carries that a parked mark does not, both of which have to be
answered before moving them:

- **Its hover names the partner chromosome** (`partnerRefNames`, plural for a
  breakpoint reaching several). That is the whole content of a tick — its own
  position says only where the breakpoint is — and it is the one thing a tick's
  hover was worth more than an arc's.
- **Its width is its read support**, through `arcStrokeScale`, the same curve
  the arcs spend. An endpoint square has no width channel, so a 40-read
  translocation and a single mismapped pair would draw identically. Note the
  ceiling already caps that curve at 4x around 44 reads, so the channel is
  coarse — but it is not nothing.

A translocation is also usually looked at from ONE chromosome, where both feet
cannot be on screen, so the tick is the only mark it ever gets. Making it a 5 px
square among dozens of parked marks is a real loss of weight for the one claim
in this band a single window cannot support on its own.

Options, none costed yet: keep the verticals; move them to the parked row in
cloud mode only and give the row a support-scaled glyph; keep them but make them
shorter than the full band so they stop crossing every plotted row; or keep them
and lean on paint order.

Whichever way it goes it is **cloud-mode only** — arc mode's ticks are drawn
against a genomic-radius axis and nobody has reported them as confusing.

## Menus

### Give an arc's right-click something to offer

The fall-through is the right rule today, so what is proposed is a product call
nobody has made — and the invariant in its way is one a class of bugs put there.

A right-click on an arc or a tick falls through to the browser's menu, because
`contextMenuTargetForHit` returns `undefined` for `type: 'arc'`. The fall-through
itself is the right rule — an empty menu is worse — so what is open is whether a
junction really has nothing, and it does not look that way: `ArcHit`
carries `x1`/`x2` in absolute genomic bp and the `support` count behind the
stroke width, and `TickHit` carries `bp` plus `partnerRefNames`, which
is exactly the "where does this reach" a tick's own geometry cannot show. Center
on the mate, open the far side in a new view, copy the junction — all reachable
from what the hit already resolved.

Two things are in the way, and the second is the design question. `ArcMarkHit`
narrows the hover to `{tooltip, highlight}` and drops the `ArcBandHit`
behind them, so the coordinates do not survive to the menu builder — cheap to
fix. Then `ContextMenuHit` **requires** `block` and `genomicPos`, and its comment
says why: "a menu built without one was never a real state", which the split-state
sort bugs earned. An arc's hit carries its region index, not a `ResolvedBlock`,
so either arcs get a real block or that invariant needs a considered second
shape.
Don't relax it casually.

Decide the item set first — it is a product call, not an implementation one.
