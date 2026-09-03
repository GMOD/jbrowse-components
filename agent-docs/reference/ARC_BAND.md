---
name: arc-band
description: The alignments arc band draws two mark families — curved/flat arcs and interchromosomal connector ticks — into one rect, one Y scale and one palette, so paint order, hit-test priority, support floors and the tick's stroke are all one subsystem rather than per-mark choices. Also holds why an interchromosomal arc is the only arc with breakend feet, and the two producers that disagree on which direction a foot points. Read before adding a mark to this band, changing what hides an arc, or re-deriving an arc's geometry at a call site.
audience: internal
---

# The alignments arc band

Curved/flat arcs (`arc`, `arcFlat`, `arcMarker`) and interchromosomal connector
ticks (`arcLine`) share one rect, one Y scale and one palette, and they overlap
freely. That sharing is what makes the band a subsystem: which mark a hover
resolves to, which one is hidden by a setting, and which one paints over the
other are all one question asked in three places, and the answers have to agree.

The display's own rules — the five names a call site actually reaches for — stay
in `plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`.

## Which family an interchromosomal connection joins

Decided **per connection, by whether both of its feet are in displayed regions**.
Both → one arc, in the cross-region overlay; otherwise → the two ticks. A tick's
whole claim is "there is a connection to somewhere you cannot see", which is
precisely false when the far end is on screen, and the arc's feet are the two
tick positions, so no position is lost.

Three things ride on that, each of which ships a silently wrong picture on its
own:

- **Arc mode only.** The read cloud's Y axis IS insert size, and an
  interchromosomal pair has none — it carries TLEN 0, so `computeArcShape` falls
  back to the endpoint gap, which becomes a real `maxFlatArcSpanBp`, which
  `arcsYDomainBp` maxes across groups, which `insertSizeTickSections` PRINTS on
  the ruler. One connection would rescale the cloud to a 107 Mb "insert size".
  Arc mode's axis is genomic radius, where the band ceiling is already where a
  maximally-far same-chromosome pair clamps (`INTERCHROM_ARC_YBP`).
- **`drawInter` and `minInterchromSupport` gate both marks**, from one hoisted
  condition. They used to sit inside the tick push, so an arc branch beside them
  would inherit neither — "Show inter-chromosomal pairs: off" still drawing arcs,
  and the mismapping floor bypassed for a mark BIGGER than the ticks it replaced.
- **The hover needs two refNames.** `formatArcTooltip` builds a range from
  `min`/`max` of the two bp, which across chromosomes is a locstring naming one
  and a coordinate from the other; `endRefName` switches it to two positions and
  no distance. This is also the one thing a tick's hover was worth more than an
  arc's, so an arc replacing ticks must not lose it.

## A far pair keeps its direction for three screen widths

**`ARC_FAR_SCREEN_WIDTHS` is 3, not the 1 that would mean "both endpoints fit on
screen".** Past it a paired arc's ellipse becomes a true circle and the band clips
it to near-vertical legs at each real endpoint — which throws the pair's DIRECTION
away, because a circle's tangent at its foot is vertical whatever its radius. The
band only ever shows the first `availH` px of the rise, so the leg leans by
`availH^2 / 2r`: 10 px over a 152 px band for a pair 1.6 screens wide, which reads
as a bar. The ellipse at the same pair is `rx` wide and `0.75 * destY` tall, so it
arcs across the whole view and its lean says which way the mate lies. On
`volvox-sv` at `ctgA:1-20,000` the 19 pairs of its 32 kb event draw as a bundle of
verticals at 1 and as a fan of arcs at 3.

**The limit is TESSELLATION, not geometry, and that is what picks the number.** An
ellipse spends its 64 segments over its whole half, so the share landing on the
visible slice near the foot falls as `2/(PI*sqrt(N))` — 24 segments at N=3, 13 at
N=10, one at N=1000. A far circle's legs dodge that with `legSweepAngle`, which
puts every segment inside the band, and dodge the float32 cancellation that
reconstructing a huge `centre + cos(a)*r` runs into. Neither dodge is needed at 3.

The hull was the other candidate limit and is not one. Reproducing the pass's
triangle strip against `sdEllipse` over ry 4-114 and half-widths 0.5-2, the share
of inked samples the 64 quads miss is flat from N=1 to N=40 — 12.2% to 14.2%,
against a same-checker N=1 control, so the absolute figure is the checker's and
only the flatness is the result. The aspect ratio a raised threshold creates is
not what the tessellation is spent on. `ellipseDistance`'s own note already puts
the solver past 88:1, which a 25 px band reaches at N=1.

**The two tests that pin this derive their boundary from the constant** rather
than writing it out (`arcRadiiParity.test.ts`, `arcHitTest.test.ts`), because what
they are for is that the branches sit either side of the threshold and that the
split reads the BLOCK's width — not where the threshold currently is. Both broke
on the move, which is how a fixture built out of `2 * 320 > 640` announces that it
was pinning the number.

## Paint order is an interest ranking, not a data order

Stated in two places, for the two things that overlap:

- Between the families, in `ARC_PASSES`: ticks under arcs. A translocation is the
  one claim here a single window cannot support on its own, and on deep
  short-read data mismapped pairs put a full-height opaque vertical at a large
  share of loci — straight through the arcs that carry insert size and
  orientation.
- Within the arcs, in `arcPaintOrder`: `arcPaintRank` (categorized over
  uncategorized) first, `support` second, dedup key last. A deep pileup is
  overwhelmingly concordant pairs and they all paint the baseline slot, so
  support-ascending alone let grey punch through the few arcs that mean
  something.

  **BOTH halves take it**, which is why it is one exported comparator rather
  than a sort per feed. The cross-region overlay ranked on support alone, on the
  ground that "nothing cross-region is routine" — and the opposite is true: arcs
  reach that overlay by straddling a SEAM, so they are the ordinary fragments
  lying across it and the 9138-of-9204 ratio arrives there too. SVG document
  order is paint order and `pointerEvents: 'stroke'` gives the top path the
  tooltip, so a two-read grey pair both covered and answered for the
  interchromosomal arc under it; and `CROSS_REGION_ARC_CAP`, which keeps the
  tail, dropped that arc first.

`hitTestArcBand` is the single entry point for the band, because which mark a
hover resolves to is a question about that order, and the answer belongs beside
the scan rather than at each call site. Both renderers run the line pass **first**
(`drawArcsPass`; `drawArcs` strokes the ticks before the curves), so an arc is
always the later ink. `bestArcMark`'s on-ink winner is simply the **last
candidate considered**, both feeds arriving in paint order and both scans running
ascending — it used to rank on `support`, which was the same thing only while
support _was_ the sort key, so a fixture built out of feed order now tests a
state production cannot reach. The ranking itself is `@jbrowse/sv-core`'s, since
`plugins/arc` resolves its own semicircles and beziers by it and shares none of
the geometry.

The rule is two-tier — on-ink beats near-ink either way, the arc wins among
on-ink, and a near-ink tie goes the same way — because "arc always" would make a
tick unhoverable wherever any arc crosses it.

The endpoint squares have no hit test of their own, covered by the bar's
tolerance because `ARC_MARKER_PX / 2 <= ARC_HIT_SLOP_PX`. That is arithmetic, not
design, so `hitTest.test.ts` pins it.

## What may hide an arc

**"Concordant" has one definition and two settings spend it.**
`isConcordantPairRead` (`shared/buildBaseFeatureData.ts`) is the aligner's verdict
— flagged proper, not supplementary, mates facing — and it is called by both the
worker's read filter behind "Show proper pairs" (`isProperPairChain`) and the arc
filter behind "Show concordant-pair arcs" (`resolveArcs`). One hides the reads,
the other their arcs; `concordantPairParity.test.ts` holds the read filter's real
answer against the predicate so the two cannot drift.

The arc filter adds a second condition the read filter has no use for: the arc
must also be painting the **baseline colour slot** (`arcPaintRank`). Without it
the setting hides arcs the display is drawing as a category — a proper-flagged
pair whose |TLEN| is below the band paints short-insert, and 42 of 48 pink arcs
disappeared in testing. Nothing coloured may be hidden as routine, and keying on
`arcPaintRank` makes "hidden" and "grey" the same set by construction under
whatever `colorByType` is selected.

Not to be confused with the read cloud's `isConcordantFRPair`, which asks whether
|TLEN| sits in the modal band rather than what the aligner concluded. Both
readings are deliberate; each function's comment names the other.

**A support FLOOR is offered for the INTERCHROMOSOMAL MATE LINK — either mark —
and deliberately not for the same-chromosome arcs, nor for split junctions.**
`minInterchromSupport` counts a MATE link's reads over a window of one fragment
length on _both_ sides (`clusteredInterchromSupport`), never at a coordinate:
mates straddle a breakpoint rather than landing on it, so `arcKey`'s exact count
is 1 for essentially every interchromosomal PAIR and a floor over it would delete
a real translocation as thoroughly as the mismapping. The window comes from
`stats.upper`, so it tracks the library instead of a constant — and a SPLIT
junction takes window 0 whatever the chromosomes, for the reason below. The same
clusters are what BOTH interchromosomal marks are DRAWN with — see below. The
same floor on same-chromosome arcs was measured and declined — at depth it is a
density filter, not an evidence filter. Both results are in
[DEEP_COVERAGE.md](DEEP_COVERAGE.md).

**THE FLOOR HAS THE SAME AXIS AS THE WINDOW, and only the window had it.**
`windowFor` splits mate links from split junctions because the two localize their
evidence differently; `clearsInterchromFloor` is that same split applied to the
threshold, and it exempts split junctions outright. A floor over scattered mate
pairs means "this breakpoint gathered evidence", and the windowing exists so that
it can. Over a split junction — counted at window 0 — it means "fewer than N reads
broke at this exact base", which nothing measured and which the count cannot
support: two reads whose aligner placed one junction three bases apart are two
clusters of one. `DEFAULT_MIN_INTERCHROM_SUPPORT` is measured on mate pairs (844
of 856 breakpoints carrying one read), and mismapping is what that measures; a
chimeric read is not indirect evidence that scatters, it CROSSES the breakpoint.
Inherited, the mate floor drew nothing at all for a translocation carried by one
split read — which on unpaired long-read data is the only evidence there is.

**WHERE the floor is applied differs per mark, because the two spend the count
differently.** An arc is one cluster, so its gate sits beside the push and tests
the very number `arcLineWidth` will spend. A tick is a SUM over the clusters
reaching its coordinate, so testing each addend was testing one term of the
number it draws: on one donor with a 3-read and a 1-read acceptor the donor
coordinate reported 4 at `all` and 3 at the default floor of 2, over four reads
that cross that base either way — a display filter rewriting what the hover said
about the data. It also deleted marks the floor had no quarrel with: two reads at
one breakpoint whose partners land 3 bp apart are two clusters of one, so nothing
drew where two reads agree. The ticks are therefore pushed unfiltered and the
floor is taken against `line.support` after coalescing. `arcClustering.test.ts`
holds both.

**The clustering is SINGLE-LINKAGE OVER BOTH COORDINATES AT ONCE**, not the rule
run hierarchically on one axis and then the other. Those are different relations,
and the hierarchical one is not symmetric in the two contigs: a `bpA` gap splits a
run before `bpB` is ever consulted, and which coordinate is `bpA` is decided by
which contig NAME sorts first. The same three connections scored `[2, 1]` one way
round and `[1, 1, 1]` transposed — and the `2` was a pair 1000 bp apart on `bpA`,
further apart than the window, merged because a third connection bridged the run
and then dropped out on `bpB`. That is the "manufacturing support out of local
density" failure this pass cites as the reason for requiring both sides, happening
inside it. What single-linkage still owns either way is that the window bounds the
GAP and not the DIAMETER: 40 pairs spaced exactly one window apart chain into one
cluster spanning 39 of them, where the prose reads as a diameter claim. That one is
filed rather than fixed — `agent-docs/TODO.md`.

## Support, and why a tick can hide behind an arc's foot

**Both families carry `support` and both spend it the same way.** An arc and a
tick are each ONE junction that `resolveArcs` coalesced, and `arcLineWidth` is the
one curve turning that count into ink for Canvas2D, the SVG export and both GPU
passes (resolved CPU-side at pack time; no shader evaluates it). Coalescing
without keeping the count left a 40-read translocation drawing exactly like one
mismapped pair.

**They do not COUNT it the same way, and the axis is the EVIDENCE, not the
mark and not the chromosomes.** A window is right for a MATE LINK, whose two
reads straddle a breakpoint they never land on, and wrong for a SPLIT JUNCTION,
whose read knows the breakpoint to the base. So an interchromosomal MATE link is
windowed — the number drawn and the number `minInterchromSupport` filters on
cannot disagree — and everything else counts exact coincidences.

**A split junction is never windowed, on either chromosome**, and the cost of
getting that wrong is specific rather than theoretical. `arcKey` refuses a
tolerance citing five distinct events inside 2.3 kb on the HG002 chr12 fold-back
— every gap under the default window. K562's BCR-ABL1 is one donor and **24
acceptors** over ~154 kb ([DEMO_DATASETS.md](DEMO_DATASETS.md)), where "is the
154-read site a real alternative acceptor" is the question the figure exists to
put to the reader; chaining acceptors under a fragment-length window answers it
for them. Window 0 through the same single-linkage walk is how a split junction
gets `arcKey`'s coincidence count while the floor, the arc's weight and the
tick's sum keep reading one number.

Counting coincidences on a MATE link read 1 over a hundred-pair translocation —
that is the measurement the floor exists because of — so the channel was empty in
the family that needs it most. The pass therefore runs at every setting, not only
above the floor. One arc is one junction is one cluster, so coalescing has
nothing to add on that arm.

**An interchromosomal TICK sums the distinct clusters reaching its coordinate**,
which is where the two marks' arithmetic differs. A tick is HALF a junction: a
coordinate whose far side the view cannot show and, `partnerRefNames` being
plural, possibly several far sides at once. Neither obvious number works — the
reads AT the coordinate is the count already shown to read 1 for 862 of 865
mate-pair connections, and one cluster's own size reports the larger, 1, where
two singleton events share a base. Each cluster contributing its size once
survives both, which is why `clusteredInterchromSupport` returns a cluster
IDENTITY per connection rather than a count.

**The ticks are the half that matters more**, and the arc change reached them
only through the floor. A translocation is usually looked at from ONE
chromosome, where both feet cannot be on screen, so the mark is always a tick;
the arc carries a cluster only in the two-region view. And `minInterchromSupport`
already gated a tick on its cluster, so a five-pair breakpoint cleared a floor of
2 and then drew, and hovered, as a single read — the same two-numbers-free-to-
disagree, on the more common path.

Two coordinates of one event do both report the whole event. That is the trade
the arc already makes and for the same reason — the mark is the junction, the
POSITION is its own read's — rather than a residue of this rule.

**It is 2N coordinates, not 2, and that is an open question rather than a
settled trade.** The premise of the windowing is that mate pairs never share a
coordinate (862 of 865 were the sole occupant of theirs), so nothing coalesces:
an N-pair translocation emits N marks per side, and every one of them is handed
the cluster's N. An 8-pair event draws 8 arcs — or 8 + 8 ticks — each stroked as
though it alone carried 8 reads and each hovering "supported by 8". The ink is
O(N) marks at width(N) where the evidence is one junction, which is the opposite
of what coalescing is for, and `compute.test.ts` pins it as `[5,5,5,5,5,5,5,5,5,5]`.
Filed with the options in
[ideas/draw-one-mark-per-interchromosomal-cluster.md](../ideas/draw-one-mark-per-interchromosomal-cluster.md)
— it changes what every published translocation figure looks like, so it is a
decision and not a fix.

**A tick is SOLID, and nothing in the mark separates it from an arc's foot.**
The two land on the same x whenever a breakpoint reaches one acceptor the view
shows and another it does not — the ordinary shape of a translocation seen
through two windows, and the ordinary shape of a fusion whose transcript has
more than one acceptor. Both marks are `ARC_COLOR_INTERCHROM` and both run the
band's height there, so they read as one mark: on
`cancer_sv/k562_bcr_abl_split` that hid a junction carrying six times the drawn
arc's support behind what looked like the arc's own leg, and the figure shipped
that way.

The tick was dashed for exactly this reason and is solid again by Colin's call
(2026-09-02) — the dash was disliked on sight, and that decision outranks the
collision. **Do not re-dash it without asking.** What is still true is the
collision and the reason the obvious alternative does not work.

**Support cannot do this job**, which is the part worth knowing before reaching
for it: `arcLineWidth` caps at 4x the base width around 44 reads, so a 206-read
tick and a 37-read one are the same 8 device px. Re-framing a figure to thin the
bar cannot work, and two people have now expected it to.

Solid is stated at each of the three renderers rather than left to the context:
`drawArcs` sets an empty dash before the tick loop (the arc loop after it sets a
dash per split connector), `arcLine.slang`'s fragment carries no
`dashCoverage`, and `resolveArcBandHover` leaves `ArcHighlight.dash` undefined
for a tick. `tickSolid.test.ts` pins the pattern in force AT each stroke rather
than that `setLineDash` was called, since a call after the stroke it governs
would pass the weaker test. arcFlat's `[3, 3]` split-line dash is now the only
dashed mark in this band.

The hover carries the claim in words: `partnerOffView` on
`ArcLineTooltipPayload` prints "Outside the displayed regions". Naming the mate
chromosome is the whole content of a tick and it is actively misleading when that
chromosome is on screen. **The claim is safe unconditionally in arc mode and false
in read cloud** — the cloud ticks every interchromosomal connection, displayed
partner or not — so the caller reads `readConnections`, the same setting
`resolveArcs` branches on, rather than assuming.

## The read cloud draws a bar only between two places on screen

**A flat mark whose partner is outside every LOADED region collapses onto the
end the view can place and sits on the band's zero anchor**
(`ARC_SHAPE_FLAT_UNPLACED`). Two things go wrong at once when it does not, and
the parked row is one answer to both.

The bar is drawn between two feet, so a partner the view has no block for is
extrapolated: the line runs off the screen edge to a coordinate nothing covers
and paints the full width of the band, saying nothing its near foot does not. And
the same connection's span sets `arcsYDomainBp`, which every lane shares and
`insertSizeTickSections` prints at the top of the axis.

Measured on HG002 300x (`NHGRI_Illumina300X_AJtrio`, hs37d5) over 47 20 kb
windows across chr1, 2, 5, 11, 17 and 20 — 5,281 cloud arcs after the
concordant-FR drop:

```
span decade | arcs | in a >=3-pair cluster | biggest cluster
1e3         | 1574 | 1516 (96%)            | 24
1e4         |    3 |    0                  |  1
1e5         |   61 |   46 (75%)            | 46
1e6         |  102 |   55 (54%)            | 35
1e7         |  219 |    0                  |  2
1e8         |   58 |    0                  |  1
```

379 arcs (7.2%) have a partner more than 1 Mb away, spread uniformly over the
chromosome — 6% of them in the 1e6 decade, 42% in 1e7, 52% in 1e8, which is what
a mate placed at random on a 60-250 Mb contig looks like — and past 10 Mb not one
of 277 has two other pairs agreeing on its junction. The median window's axis
topped out at 73 Mb, so the range every real pair sits in was squeezed into the
top third of the band, and each of those pairs drew a screen-wide bar: 96 of them
in one 200 kb window, which is the solid mass along the bottom.

**IT IS A PLACEMENT TEST, NOT A SPAN THRESHOLD**, and that is the part to not
"simplify". A pair 5 Mb apart in a view showing BOTH of its ends — two
discontiguous displayed regions at the two breakpoints, the view read connections
exist for — draws its bar between two real pixels and belongs on the axis; a pair
30 kb apart in a 20 kb window does not. No ordering of spans reproduces those two
answers. The picture follows the view: zoom out, or open a second region at the
partner's locus, and the same connection joins the axis.

**Asked of the LOADED list, and `displayedRegions` will not do.** An ordinary LGV
shows one displayed region and it is the whole chromosome, so a mate 214 Mb away
resolves to a region and reads as perfectly placeable — the rule would be a no-op
in the case it exists for. The loaded list is the fetch (the blocks on screen plus
the half-screen each side `planRegionFetch` buffers), which is the data a bar
could be drawn between. `cloudUnplaced.test.ts` pins the distinction, and a
sabotage swapping the lists is the one it catches.

**And it REACHES PAST that list, by `CLOUD_OFFSCREEN_REACH` times the fetched
span.** Strict containment threw away the case the band is most worth looking at
along with the mismapping: a real event just off the window edge, whose pairs all
agree on one span and so draw one clean row. Sweeping the reach over the same 47
windows and splitting what each newly admits into clustered evidence and
singletons, nothing but singletons appears below 14x, the clustered evidence is
all in by 14x, and past ~50x the uniform tail starts coming back with the axis
behind it — `cloudReachBp` carries the table. 20x sits inside that band rather
than on its lower edge, which one 409 kb cluster sets.

It is often a no-op, which is the point: the 200 kb window at 1:2,000,000 holds
no arc at all between 10 kb and 1 Mb, so its picture is the strict one either
way. What it does buy back everywhere is the EDGE RING — pairs straddling the
loaded boundary, at ordinary spans, which strict containment parked for having a
partner a few hundred bp outside the fetch. On the 24 kb window at 1:2,010,000
that is 5 of the 7 parked marks.

**The collapse is in bp, in `resolveArcs`, before anything is projected**, which
is what lets all four renderers draw the mark with no geometry of their own:
`arcMarkFrom` resolves a zero-length bar to `ARC_FLAT_MIN_PX` centred on the foot,
the two endpoint squares land on each other there, and the hit test measures the
same stub. It also narrows `arcTouchesRegion` to the one region, so an unplaced
connection stops being packed into every region on its chromosome. The cost is
the far coordinate, which the hover reports as a distance instead
(`unplacedPartnerBp`) — its two feet are one coordinate, so the location range and
the distance between them would read as zero-width over a partner megabases away.

**`plotsOnInsertSizeAxis` is the other half.** Taking the bar away is not the fix
if the span still sizes the axis, so `maxFlatArcSpanBp` reads the two shapes that
plot ON the axis rather than `isFlatArcShape`, which is the right predicate for
"does this draw as a bar" and admits all three.

## Questions asked of the band, and of the lanes

**Ask `hasArcBandInk`, not `numArcs`.** A lane whose only interchromosomal partner
is off-region carries ticks and no arcs, so an arc-count gate reserves the band,
paints it, and then treats it as empty. The one deliberate exception is
`resolveArcBandDebug`, which answers "why is this arc this shape" and so has
nothing to say about a tick.

**A question asked ACROSS the lanes is answered by `computeArcsByGroup`, not by a
walk of `arcsByGroup`.** There are three — the lanes with any ink
(`inkGroupKeys`), the colour slots drawn (`colorSlots`), the read cloud's Y domain
(`maxFlatArcSpanBp`) — and all three used to be walks of that one feed. Splitting
the cross-region arcs out of it broke two at once and would have broken the third:
a band unreserved for a lane whose ink had moved, a legend swatch missing for a
colour still on screen. They are not three slips; "which arcs does this lane draw"
had stopped having one answer, and a fourth half would break them again.
`ArcsByGroupResult` also says why all three are computed AFTER regionization: an
arc reaching no displayed region is dropped, so keying a swatch off the
pre-regionization set names a colour nothing draws.

**`isFlatArcShape` answers "does this draw as a bar", never "does this have an
insert size" and never "does this size the axis".** All three flat variants draw
as a bar, and only `ARC_SHAPE_FLAT` — the placed mate link — has a TLEN;
`plotsOnInsertSizeAxis` and `isUnplacedArcShape` are the other two questions.

`computeArcShape` gives `ARC_SHAPE_FLAT_SPLIT` `spanBp = |p2Bp - p1Bp|`, which is
exactly the arc's own span, so gating the tooltip's insert-size row on the drawing
predicate printed the Distance line over again under a name a split read cannot
carry. The three questions look like one because the read cloud is the only mode
any of them is asked in.

## Breakend feet

**An interchromosomal arc draws BREAKEND FEET, and no other arc does.** A short
horizontal tick at each foot, lying over the ARM that foot's junction keeps:
outward feet are a deletion-type junction, inward a duplication-type, parallel an
inversion. Three things about the scope are load-bearing:

- **It is the family whose colour channel is spent.** Every interchromosomal
  connection paints `ARC_COLOR_INTERCHROM` whatever `colorByType` says, so
  orientation has nowhere else to go. A same-chromosome split junction still has
  it — `unpairedOrientationColor` paints a strand flip magenta and a co-linear
  join yellow — which is why those arcs get none.

  **Widening it to the pair arcs has been asked for and measured down.** Two
  counts against it, and the second settles it. Orientation on a pair arc IS the
  colour — green LL, navy RR, magenta split inverted, all three named in the
  legend beside them — so a foot restates a row of the key. And every foot lands
  on the baseline: `gallery/inverted_duplication` draws ~278 arcs across 3000 px
  (counted as non-white runs along one scanline of its band), so the feet would be
  ~556 marks 20 px long on one horizontal line, five pixels apart. That is a rule
  under the band, not a set of directions.

  The ticks are the half that IS worth it, and are filed rather than declined —
  [ideas/give-the-interchromosomal-ticks-breakend-feet-too.md](../ideas/give-the-interchromosomal-ticks-breakend-feet-too.md).
  Same reasoning as the arcs': their colour channel is spent too, and a tick has
  no second endpoint to read an orientation off at all.

- **Interchromosomal is the one family that is ALWAYS cross-region**, so drawing
  the feet in `CrossRegionArcsOverlay` covers all of it. Feet on the
  same-chromosome cross-region arcs would appear and disappear as a reader panned
  the identical junction across a seam.
- **The direction is a property of the JUNCTION, not of the read**, which is what
  makes it safe on a coalesced arc: reading the same molecule from the other end
  swaps which segment is trailing and flips both strands, and the two cancel
  (`readTrailingBodyDir`, `@jbrowse/cigar-utils`). A `ComputedLine` still carries
  none, because a tick coalesces on one coordinate and two junctions sharing a
  breakpoint would take whichever read arrived first.
- **THE ARM, not "this foot's own aligned body", and the two producers differ on
  exactly that.** A split junction's arc endpoint IS the junction, so there the
  arm and the segment's body are the same ray and `connectionEndpointBps` hands
  its `dir1`/`dir2` straight through. A mate link's endpoint is the FRAGMENT's
  outer edge — a read length outside the junction, with the read's body pointing
  back at it — so `pairOuterDir` answers with the read's direction NEGATED.
  Mirroring the two ternaries instead made an FR pair draw its feet inward, which
  this grammar spells "duplication", while a split read over the identical
  junction drew them outward; on a translocation with both kinds of support those
  land within a fragment length of each other, in one colour, pointing opposite
  ways. `arcBreakendFeet.test.ts` holds the two families against each other, and
  the parallel case is deliberately not the only multi-foot one there, since
  negating both feet of a parallel pair is a no-op.

The feet live in the **mark** (`ArcFeet`), not in the overlay's path string, so
the hover highlight — which re-traces `arc.mark` at its own origin — draws them
too. Their sign is deliberately the opposite of `tangentSign`
(`core/util/bezierConnector.ts`), which is the direction a per-read connector
LEAVES the same endpoint in: a foot lies over the retained arm and the curve
departs across the junction, which together is what BreakpointSplitView's
`buildBreakpointPath` draws as a tick into its breakend and a line out of it.
Neither should be "fixed" to match the other.

A foot is `ARC_FOOT_PX` from its anchor unconditionally, so two feet closer than
that merge into one bar — which is the mark working, since they overlap precisely
because both ends keep the same stretch. What is NOT handled is a foot crossing
its region's seam, and the obvious bound (by the other foot) clamps the merge
case instead:
[ideas/bound-a-breakend-foot-by-its-displayed-region.md](../ideas/bound-a-breakend-foot-by-its-displayed-region.md).

## The gesture guard

**An arc outranks the band it is painted over, and it says so as a RESULT
VARIANT.** `runHitTest` returns `arc ?? result`, so `ArcMarkHit` is a member of
`MarkHitResult` alongside the pileup's five — one value, one discriminant, and one
place where the ranking is stated.

That shape is the fix for how this went wrong. The guard used to be an `if` in
each gesture, and when each asked for itself one of them forgot: `93af1f54f0`
guarded the click and left the right-click. In up mode `computeArcBand` gives the
band `top: 0`, which IS the coverage band, and `hitTestInterbase` answers over the
indicator strip and the bar stack inside it — so a right-click on an arc built the
interbase menu for the column underneath while the tooltip said "Read connection".
Down mode never showed it (own band, `type: 'none'`), which is why it survived
casual testing.

As a variant, each gesture is right by default instead of by remembering:

- `hoverStateForResult` **does not compile** without `case 'arc'` (TS2366 — a
  declared return type it can now fall off the end of). That is the enforcement,
  and it is worth knowing it is the only one; the others below are structural.
- `handleClick`'s switch matches no pileup case, so it does nothing. The old bug
  was `case 'none'` catching the arc and CLEARING THE SELECTION; an arc is now
  never `'none'`, so that is unreachable rather than guarded. The explicit
  `case 'arc': return` is there against a future `default:`.
- `contextMenuTargetForHit` returns `undefined` for an arc, so it falls through
  to the BROWSER's menu rather than opening an empty one. No `preventDefault`.
  The **rule** is "a mark with no items falls through", which is not arc-specific
  — it is what `'none'` gets too. What IS arc-specific is that it has no items:
  every item the menu builds wants a read or a coverage bin, and a junction is
  neither. That is a gap rather than a property of arcs, though — the hit carries
  `x1`/`x2`, `support` and a tick's `partnerRefNames`, so there is something a
  junction could offer. `ArcMarkHit` narrows to `{tooltip, highlight}` and drops
  the `ArcBandHitResult` behind them, which is what actually forecloses it
  downstream. See
  [An arc's right-click offers nothing](../ideas/give-an-arcs-right-click-something-to-offer.md).

`arcGestureGuard.test.ts` holds the behaviour, and it works the one pixel where an
arc's ink lies over an interbase bar — the mark that answers a click with a widget
AND a right-click with a menu, so one pixel states both halves. It finds that
pixel by asking the hover rather than by projecting the dome, since a fourth
placement of the arc written into the test would be free to disagree with the
three it is checking. Every case is stated against its own control: the SAME pixel
with `readConnections` off, which is the only thing separating "the guard
suppressed this" from "there was nothing here anyway". Both cases fail if
`arc ?? result` stops preferring the arc.

`mouseGestures.test.ts` covers the two handlers that are pure guard —
`handleMouseDown`, which decides between this display's pan, the LGV's shift+drag
rubberband and the browser's own menu by DECLINING two of them, and
`handleMouseLeave`. Each of the five guards there was checked by deleting it; each
is caught by exactly one case. Its `cancelAnimationFrame` stub is load-bearing
rather than tidiness: stubbing only `requestAnimationFrame` leaves the real cancel
with no id of ours to cancel, the held callback runs anyway, and the queued-hover
case reads as the leave failing when the harness never let it.

`createTestAlignmentsDisplay` (`testUtils.ts`) is the harness both use — a real
display in a measured LGV, for the cases that have to run through the model's own
chain rather than through a hand-built argument.
