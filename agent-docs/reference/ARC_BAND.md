---
name: arc-band
description: The alignments arc band draws two mark families — curved/flat arcs and interchromosomal connector ticks — into one rect, one Y scale and one palette, so paint order, hit-test priority, support floors and the dashed tick are all one subsystem rather than per-mark choices. Also holds why an interchromosomal arc is the only arc with breakend feet, and the two producers that disagree on which direction a foot points. Read before adding a mark to this band, changing what hides an arc, or re-deriving an arc's geometry at a call site.
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
always the later ink. `bestMark`'s on-ink winner is simply the **last candidate
considered**, both feeds arriving in paint order and both scans running ascending
— it used to rank on `support`, which was the same thing only while support _was_
the sort key, so a fixture built out of feed order now tests a state production
cannot reach.

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

**A support FLOOR is offered for the INTERCHROMOSOMAL family — either mark — and
deliberately not for the same-chromosome arcs.** `minInterchromSupport` counts a
MATE link's reads over a window of one fragment length on _both_ sides
(`clusteredInterchromSupport`), never at a coordinate: mates straddle a breakpoint
rather than landing on it, so `arcKey`'s exact count is 1 for essentially every
interchromosomal PAIR and a floor over it would delete a real translocation
as thoroughly as the mismapping. The window comes from `stats.upper`, so it tracks
the library instead of a constant — and a SPLIT junction takes window 0 whatever
the chromosomes, for the reason below. The same clusters are what BOTH
interchromosomal marks are DRAWN with — see below. The same floor on
same-chromosome arcs was
measured and declined — at depth it is a density filter, not an evidence filter.
Both results are in [DEEP_COVERAGE.md](DEEP_COVERAGE.md).

## Support, and why a tick is dashed

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

**A tick is DASHED, and that is what separates it from an arc's foot.** The two
land on the same x whenever a breakpoint reaches one acceptor the view shows and
another it does not — the ordinary shape of a translocation seen through two
windows, and the ordinary shape of a fusion whose transcript has more than one
acceptor. Both marks are `ARC_COLOR_INTERCHROM` and both run the band's height
there, so solid they read as one mark: on `cancer_sv/k562_bcr_abl_split` that hid
a junction carrying six times the drawn arc's support behind what looked like the
arc's own leg, and the figure shipped that way.

**Support cannot do this job**, which is the part worth knowing before reaching
for it: `arcLineWidth` caps at 4x the base width around 44 reads, so a 206-read
tick and a 37-read one are the same 8 device px. Re-framing a figure to thin the
bar cannot work, and two people have now expected it to.

The pattern is declared in `arcLine.slang` (`ARC_LINE_DASH_PX` /
`ARC_LINE_GAP_PX`) and the CPU side imports the generated twin, adr-051's rule.
Its period is deliberately not arcFlat's `[3, 3]` split-line dash — the other
dashed mark in this band, and in read-cloud mode both can be on screen at once.
`SvgCanvas.setLineDash` carries it into the export, so the third renderer needs
nothing of its own. `tickDash.test.ts` pins the pattern in force AT each stroke
rather than that `setLineDash` was called, since a call after the stroke it was
meant to dash would pass the weaker test.

The hover carries the same fact in words: `partnerOffView` on
`ArcLineTooltipPayload` prints "Outside the displayed regions". Naming the mate
chromosome is the whole content of a tick and it is actively misleading when that
chromosome is on screen. **The claim is safe unconditionally in arc mode and false
in read cloud** — the cloud ticks every interchromosomal connection, displayed
partner or not — so the caller reads `readConnections`, the same setting
`resolveArcs` branches on, rather than assuming.

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
insert size".** Both flat variants draw as a bar, and only `ARC_SHAPE_FLAT` — the
mate link — has a TLEN. `computeArcShape` gives `ARC_SHAPE_FLAT_SPLIT`
`spanBp = |p2Bp - p1Bp|`, which is exactly the arc's own span, so gating the
tooltip's insert-size row on the drawing predicate printed the Distance line over
again under a name a split read cannot carry. The two questions look like one
because the read cloud is the only mode either is asked in.

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
  `agent-docs/TODO.md`, "Give the interchromosomal ticks breakend feet too". Same
  reasoning as the arcs': their colour channel is spent too, and a tick has no
  second endpoint to read an orientation off at all.

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
its region's seam, and the obvious bound (by the other foot) clamps the merge case
instead: `agent-docs/TODO.md`, "Bound a breakend foot by its displayed region".

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
- `contextMenuFieldsForHit` answers `show: false` from its `default`, the same
  answer coverage gets, so an arc falls through to the BROWSER's menu — which is
  what a mark with nothing to offer should do. No `preventDefault`.

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
