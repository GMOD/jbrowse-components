---
name: arc-band-open-calls
description: Nine parked calls on the read-connection arc band and the read cloud, cut from TODO.md on 2026-08-26 for missing the v5.0.0 bar. Two are numbers nobody has read, four are marks and geometry, three are colour, a menu and an asymmetry nothing pins. Read alongside reference/ARC_BAND.md, which is the settled half.
---

# The arc band's open calls

Nine items cut from `TODO.md` on 2026-08-26, when the backlog was reduced to
what v5.0.0 turns on. [reference/ARC_BAND.md](../reference/ARC_BAND.md) is the
settled description of this band, and everything below is what it deliberately
does not answer. Most are visual calls, which is why they are filed rather than
fixed — a fixture test cannot settle what a reader concludes.

## Two numbers nobody has read

### Bound an interchromosomal cluster's diameter

The measurement that would justify a change has not been taken, and the
alternative on the table is the failure mode the current rule exists to avoid —
so it is not established that anything here should be built.

`clusteredInterchromSupport` is single-linkage, so the window bounds the GAP
between neighbours and not the DIAMETER of the cluster: 40 pairs spaced exactly
one window apart chain into one cluster spanning 39 fragment lengths
(`arcClustering.test.ts` has the probe shape). The prose beside it reads as a
diameter claim — "how far a supporting read can sit from the breakpoint is one
fragment length" — so the rule delivered is a density threshold and the rule
described is a distance one.

At depth the difference is not cosmetic. The pass's own measurement puts 865
interchromosomal connections in 200 kb at 300x, i.e. ~231 bp apart on the source
contig against a typical `stats.upper` of 500-700 — so the first coordinate chains
nearly everything in the window and the partner coordinate does all of the
discriminating. Whether that matters depends on how concentrated real mismapping
is on the PARTNER side, which is the thing to measure: mismapping goes to repeats,
and repeats are localized, so "both sides agree" may be weaker evidence than it
reads.

Do not change the rule before measuring it. The obvious alternative — cap a
cluster's diameter at the window and split beyond it — trades chaining for
arbitrary cut points, which is the failure mode the current form was adopted to
escape (the one-open-cluster version scored a four-read breakpoint as 1 and 3).
Measure on HG002 300x and on a sample with a known translocation, and report the
cluster size distribution under both rules before touching either.

### Read the cross-region arc count at 300x, which the arc cap is sized from

A wrong number here degrades a picture that is a wash of ink either way.

`CROSS_REGION_ARC_CAP = 600` (`features/arcs/crossRegionOverlay.ts`) is sized for
the same-chromosome multi-seam case, which is the one that is actually unbounded.
Its input is an **estimate**: 52 of 381 arcs (13.6%) were cross-region on one
seam of HG02768's inverted duplication, a ~30x paired-end sample, and that count
was then scaled by an assumed ~10x for depth and again for the number of seams.
Only the 30x half was measured.

Reading the real number is cheap — `crossRegion.length` off the model, on the
HG002 300x window split in two — and it decides whether 600 is two deep seams'
worth, as the comment claims, or off by an order of magnitude in either
direction. Note what it does *not* decide: at that depth the reader's own lever
already exists and is the one they are using, `drawProperPairArcs: false`
dropping 9138 of 9204 arcs, so the cap is a floor under the frame rate rather
than a filter, and a wrong number here degrades a picture that is a wash of ink
either way.

Three companion counts were taken at the same time and have been re-read but
never re-run, so treat them the same way: that HG02768 view yields 0
cross-region arcs both as one region and as two regions 2 Mb apart — the 52 came
from splitting it 300 bp apart — and 865 of 9204 arcs are interchromosomal at
`1:2,000,000` on HG002 300x.

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

### Give the interchromosomal ticks breakend feet too

Unfinished, not wrong: a tick that says nothing about direction is worse than
one that does, and no worse than the last release's.

An interchromosomal arc draws a foot at each end — a short horizontal tick lying
over the sequence that end keeps, so outward reads as a deletion-type junction,
inward as a duplication-type and parallel as an inversion
(`features/arcs/mark.ts`, `arcPath.ts`, and
[reference/ARC_BAND.md](../reference/ARC_BAND.md):296, whose `:352` also has the
foot's unconditional length). An interchromosomal connection whose partner is
**off screen** draws as a pair of TICKS instead, and those have no feet.

That is unfinished, not declined. A tick means "the partner is somewhere you
cannot see", and the direction at the near foot is exactly as informative there
— arguably more, since there is no second endpoint to read the orientation off.

It was left out because the two draws are not the same kind of thing. The feet
live in the SVG cross-region overlay, which re-traces `arc.mark` in TypeScript;
`arcLine` is a GPU/Canvas2D pass. So this one needs a per-instance direction
attribute, geometry in `arcLine.slang` plus `pnpm gen:shaders`, the Canvas2D
mirror, the SVG export, and a decision about whether a foot is part of the
tick's hit-test target. Roughly a day. Nothing in the landed arc work blocks it,
and `LinearAlignmentsDisplay/components/arcBreakendFeet.test.ts` exists now,
which is where a tick-foot direction assertion lands.

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

### The read cloud's parked row is clipped by the band edge

Both backends lose the same half, so nothing diverges, and an inset means the
shaders learning that a shape sits somewhere other than where its `yBp` says.

A read-cloud connection the view cannot place draws as one mark on the band's
zero anchor (`ARC_SHAPE_FLAT_UNPLACED` — see
[reference/ARC_BAND.md](../reference/ARC_BAND.md), "The read cloud draws a bar
only between two places on screen"). The anchor IS a band edge —
`arcAnchorY` returns `arcsTop` in down mode and `arcsTop + arcsH` in up mode —
and both renderers clip to the band rect, so a mark centred on it loses half of
itself.

Measured: `ARC_MARKER_PX` is 5, so 2.5 px survive. The marks read as thin
coloured dashes lying on the band's edge rather than as squares. On HG002 300x
at `chr1:2,010,000-2,022,000` that is three of them, in the insert-size and
orientation colours, hard against the coverage band above.

**It is not a divergence.** Canvas2D clips through `withClip` and the GPU
through `devicePxBand`'s scissor, so both backends lose the same half. Whatever
is decided here keeps them agreeing for free.

#### The call

Nothing is obviously right, which is why this is filed rather than fixed:

- **Leave it flush.** A mark sitting ON the baseline is arguably what "parked at
  y=0" should look like, and a row of coloured ticks along the band edge reads
  as a lane rather than as clipped squares.
- **Inset it by half a marker**, so the square is whole. This is the one that
  costs something — see below.
- **Give the row its own glyph** rather than the endpoint square the plotted
  marks use, on the grounds that it is not a point on the axis at all.

#### Why an inset is not a one-liner

The parked mark's Y is `yBp = 0` resolved through `arcBandDestY`, which is
`alignmentsUniforms.slang`'s and is what `arcFlat.slang` and `arcMarker.slang`
both read. So an inset cannot be expressed as a `yBp`: `arcYFraction` is
logarithmic and floors at 1, and any value large enough to move the mark a few
px depends on `arcsYDomainBp`, which changes with the data.

The 8 px `ARC_HEIGHT_MARGIN` is no help either — `arcAvailH` subtracts it at the
FAR edge, so the anchor edge has no reserved room. Moving the anchor itself is
not on: it is insert size 0, and `computeInsertSizeTicks` places the ruler
against the same `arcAnchorY`.

So an inset means the shaders learning that this shape sits somewhere other than
where its `yBp` says — a per-instance bit or a uniform, `pnpm gen:shaders`, and
the Canvas2D and SVG mirrors — plus `arcMark`, since the hit test and the hover
highlight resolve through it. Half a day, and it wants the visual call first.

### Read cloud ticks every interchromosomal connection as a full-band vertical

Reported from use rather than measured as wrong, and a tick carries two things —
the partner name and the support width — that the obvious replacement does not.

In read-cloud mode `resolveArcs` sends **every** interchromosomal connection to
the connector-tick family, displayed partner or not — the exclusion
[reference/ARC_BAND.md](../reference/ARC_BAND.md) spells out under "Which family
an interchromosomal connection joins". The reason is sound: the cloud's Y axis is
|TLEN|, an interchromosomal pair carries TLEN 0, and `computeArcShape` would fall
back to the endpoint gap — about 1.07e8 for a real chr9/chr22 junction — which
becomes a genuine `maxFlatArcSpanBp` and rescales the whole cloud.

A tick is a solid vertical spanning the band (`arcLine.slang`). Reported from
use: over a read cloud they are hard to read, because a vertical crossing every
plotted row looks like it belongs to each of them and belongs to none.

They are not numerous — `minInterchromSupport` drops 98.2% of them, leaving
about 16 in a 200 kb window at 300x ([DEEP_COVERAGE.md](../reference/DEEP_COVERAGE.md))
— so this is about legibility rather than density.

#### What changed that makes this worth revisiting

The band now HAS a home for "a connection with no place on the insert-size
axis": the parked row on the zero anchor, which is exactly the statement an
interchromosomal connection is making. Before that row existed there was nowhere
else for these to go, and the full-band vertical was the only mark available.

#### The call, and what a square would cost

Two things a tick carries that a parked mark does not, both of which have to be
answered before moving them:

- **Its hover names the partner chromosome** (`partnerRefNames`, plural for a
  breakpoint reaching several). That is the whole content of a tick — its own
  position says only where the breakpoint is — and it is the one thing a tick's
  hover was worth more than an arc's.
- **Its width is its read support**, through `arcLineWidth`, the same curve the
  arcs spend. An endpoint square has no width channel, so a 40-read
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

## Colour, menus and one asymmetry

### What colour is an arc with no pair orientation

Two greys where there should be one, in a legend that has carried both for every
release so far.

The last meaning still split between the read fills and the arc overlay. A pair
with `po === 0` is `nonSplit` to the reads — deliberately the neutral grey,
"distinct from the strand-colored split segments" — and the arcs have no such
slot, so they fall to their baseline, `pairLR`. `swatchPaletteKeys` maps those
to `colorNeutralRead` (`#c8c8c8`, `palette.ts:385`) and `colorPairLR`
(`#d3d3d3`, `palette.ts:353`): two greys, not the same grey, and two legend rows
for one thing. Pinned by the last `describe` in
`shaders/overlayPaletteParity.test.ts:142`.

Two ways to close it, and the choice is visual rather than structural:

- **Give the arcs a `nonSplit` slot.** Correct, and the wider change: the Slang
  `arcColor` uniform grows by one entry, `ARC_SLOT_CATEGORY` gains a row, and
  the shader's own CI job covers it. An unknown-orientation arc then draws the
  same grey as the read under it.
- **Stop distinguishing it on the read side.** Smaller, and gives up a
  distinction the read fills document as deliberate.

Everything else these two classifiers once disagreed about now derives from one
table, so this is the whole of what is left. The theme half of the same
palette question is [dark-theme-palette-gaps.md](dark-theme-palette-gaps.md).

### Give an arc's right-click something to offer

The fall-through is the right rule today, so what is proposed is a product call
nobody has made — and the invariant in its way is one a class of bugs put there.

A right-click on an arc or a tick falls through to the browser's menu, because
`contextMenuTargetForHit` returns `undefined` for `type: 'arc'`. The fall-through
itself is the right rule — an empty menu is worse — so what is open is whether a
junction really has nothing, and it does not look that way: `ArcHitResult`
carries `x1`/`x2` in absolute genomic bp and the `support` count behind the
stroke width, and `ArcLineHitResult` carries `bp` plus `partnerRefNames`, which
is exactly the "where does this reach" a tick's own geometry cannot show. Center
on the mate, open the far side in a new view, copy the junction — all reachable
from what the hit already resolved.

Two things are in the way, and the second is the design question. `ArcMarkHit`
narrows the hover to `{tooltip, highlight}` and drops the `ArcBandHitResult`
behind them, so the coordinates do not survive to the menu builder — cheap to
fix. Then `ContextMenuHit` **requires** `block` and `genomicPos`, and its comment
says why: "a menu built without one was never a real state", which the split-state
sort bugs earned. An arc resolves an `ArcHitRegion`, not a `ResolvedBlock`, so
either arcs get a real block or that invariant needs a considered second shape.
Don't relax it casually.

Decide the item set first — it is a product call, not an implementation one.

### Chain mode flags an unmapped mate but not an interchromosomal one

One line, and it is not established that the asymmetry is even wrong.

`readColorCategory` gives `unmappedMate` its own bucket under the plain `normal`
scheme when chain mode is on (`isOrientationScheme || (colorScheme ===
ColorScheme.normal && isChain)`), and the `interchrom` test one line below is
gated on `isOrientationScheme` alone. Both produce the same thing on screen — a
chain drawn with a partner that never arrives — so the asymmetry is either a
deliberate call nobody wrote down or an omission. `colorUtils.test.ts` covers
only the orientation-scheme half of each, so nothing pins it either way.
