# LinearAlignmentsDisplay

## Settings: storage + invalidation tiers

Track-menu display options are **config slots** (they survive hide/retick and
take a declarative default). Plain MST props / volatiles are for transient state
only — hover, selection, scroll.

Which getter reads a setting decides what it invalidates: `rpcProps()`
refetches, `groupLayoutContext` relayouts, `readColorContext` rebakes read
colors, `arcsByGroup` rebuilds arcs, `renderState` repaints. Tiers 2-5 are
auto-wired by MobX; **tier 1 is manual**, because the worker boundary defeats
MobX tracking.

The layout/color split is not cosmetic. A relayout re-places every row, remaps
every per-feature Y array, rebuilds the modification Flatbush and repacks every
GPU pass; a recolor touches two per-read arrays and one pass. A color input in
`groupLayoutContext` also loses the recolor fast path, since layout allocates a
fresh `readYs` that the renderer keys its upload memo on. Same trap for a value
the layout only _sometimes_ spends: the band overhead is a thunk so an ungrouped
display doesn't relayout on every frame of a coverage-band resize drag.

- **Never put a fetch-result derivative in `rpcProps()`** — infinite loop.
  `colorTagMap` is the canonical trap: the worker reports raw tag values and the
  main thread bakes colors at tier 2.
- **Tier 4 repaints the whole canvas**, so per-mousemove state must not be
  there. The hover highlight is a React overlay on purpose; selection stays in
  `renderState` (rare, and belongs in SVG export).
- Read color is classified once at tier 2, so `flipStrandLongReadChains` /
  `colorSupplementaryChains` are deliberately absent from `renderState`.

## A split segment's colour is framed by the chains on screen, not by its primary

`readChainHasSupp`'s 1/2 is a chain-level **frame** — "which way is red here" —
and the worker's answer is a starting point the main thread overwrites twice, in
order:

1. `reconcileChainSuppAcrossRegions` — what one molecule's own segments say,
   unioned across displayed regions. A worker call sees one region.
2. `consensusChainStrandFrames` — what the molecules say about **each other**. A
   worker call also sees one chain.

The second exists because the worker's frame is `primaryStrand`, and **on a
foldback the primary flag is arbitrary**: both arms are candidates for "longest
alignment" and which is flagged turns on where the read started. It is not
sequencing direction — `strand * primaryStrand` cancels that. No per-chain rule
fixes it; longest-alignment, first-along-the-read and leftmost-in-region
measured 58/52/61% agreement where the consensus reaches 100% (COLO829 chr3
foldback, `cancer_sv/derivative_inserts`).

Two properties of that pass are load-bearing:

- **Votes are purity-normalized, not length-weighted.** Raw length lets one
  chain's 32 kb arm outvote every 200 bp insert on screen, and since that arm is
  also the primary the pass then flips nothing. Normalizing also makes a
  foldback chain **abstain** where its own two arms cancel.
- **A chain seen at ONE locus is frozen.** There its frame and its mapping
  strand are the same statement, so re-framing it replaces the read's
  orientation with its neighbours' — deleting exactly the lone inverted
  supplementary at a breakpoint this colouring exists to show. Frozen chains
  still vote.

The global sign is anchored separately (keep the majority of chains on the frame
they arrived with), because negating every frame is equally optimal and without
the anchor the pileup can swap red for blue between two renders of identical
data.

**Panning can change a frame, and that is accepted.** Panning a chain's second
locus away drops it to one bucket, the freeze applies, and it falls back to its
primary's answer — which is what these reads showed before the pass existed, so
losing cross-locus evidence cannot land the display anywhere it could not
already have been. Holding the old frame would mean painting from reads that are
no longer visible. Both halves are pinned in `chainStrandConsensus.test.ts`
("panning").

So: **don't re-derive a frame at a call site.** Read `readChainHasSupp`.
`framesUnpairedChainStrand` is the single statement of when the framing is live
at all, and gates the pass on it.

## Three different "is it grouped?" questions

`isGrouped` (>1 section) is the scroll model. `showsGroupLabels` is the chips —
grouping that yields one section still reserves the label offset, so it must
still name that section. `rpcDataMap.size === 0` is whether data arrived; never
gate first paint on a laid-out map, since a grouped fetch over an empty region
partitions to zero groups and the overlay never clears.

**Anything dodging the chips asks `showsGroupLabels`**, not `isGrouped` — a
single named section draws a chip while `scalebarOverlapLeft` resolves to 0, so
keying the coverage y-axis (on screen and in `renderSvg`) on the section count
put the axis under it.

`hiddenGroupKeys` must be filtered out of the **cross-group** derivations too
(coverage stats, legend, sashimi, arcs) or a hidden lane sizes the axis the
visible ones share — for arcs, before `poolArcScale`.

`collapseGroupRows` puts depth in the overlap tint, so the collapsed path must
**not** run `mergeSpans`.

## Two row caps, and only one of them is an affordance

A pileup can be clipped by its group's slice of the viewport or by the
display-wide `maxHeight`. `groupClippedBy` is the single classifier:

- **`'budget'`** offers the label chip's expand, which banks a per-group
  override. Both surfaces that write `groupMaxHeightOverrides` (chip and drag
  handle) gate on `canSizeGroupHeights`.
- **`'ceiling'`** offers nothing. It draws `PileupTruncationRule` — a hairline
  and caption across the bottom of the clipped rows, scrolling with them — and
  the cap is raised from the track menu.

Offering the wrong one is a button that does nothing: an expand banks an
override OF `maxHeight`, so a lane already clipped there gets the identical cap
back while the override silences the flag.

**The ceiling notice is deliberately inert, and deliberately not a chip.** As a
chip its press set `maxHeight` to 1,000,000 — one click committed the track to
laying out every read everywhere, the notice vanished, and the only way back was
a track-menu dialog. Reads collapsing onto the bottom row is the cap working,
not a fault, so the alert tone was wrong too. Drawn at the boundary it
describes, it is met by scrolling to the end of the reads.

The 6000px default is not reached at every locus on deep data: HG002 300x at
1:2,000,000 lays out **431 rows against a cap allowing 750**.

## Read height vs track height

**`fit` is the sole `heightMode` that also drives the read-height axis** — every
special case follows from that, including that the fit cap uses the Normal
height rather than the configured one.

Naming trap: `self.featureHeight` is the **fit-squeezed** value, so editors that
mutate the size must read `configuredFeatureHeight`, which is
`resolveConf(self, 'featureHeight')` — the slot is promotable, so a raw
`getConf` hands back the `undefined` inherit sentinel. `fittedHeightPx` is a
**pitch**, `featureHeight` a **body**; the volatile bridging them breaks a MobX
cycle, so don't collapse it.

Grow mode is `HeightModeMixin`'s in full — this display supplies only
`growTargetHeight` (the stacked-sections height) and super-captures
`setHeightMode` for the two resets the mixin can't know about. The scroll clamp
is `TrackHeightMixin`'s, off `scrollableHeight`.

## Hit-testing: every draw gate needs a matching hit gate

`PILEUP_LAYERS` decides what is painted; `performHitTest` decides what answers a
hover, click and right-click. The settings that gate them are repaint-tier — the
arrays are fetched either way — so a layer switched off would keep its marks
hoverable over blank pixels. `showMismatches` and `pileupVisible` are in
`HitTestOptions` for that reason; `clip` is deliberately absent because its
layer draws unconditionally. The sharp case is `hitTestGap`: the read body is
split at skips but **not** at deletions, so an ungated gap test intercepts the
whole span of a read that draws as solid body.

**What keeps the two lists in step is `HIT_GATES`**
(`hitTestGateParity.test.ts`), exhaustive over `PileupLayerId` so a new layer is
a compile error until it states one of four stories: gated on a named
`HitTestOptions` flag, empty of data when its setting is off (`mod`,
`softclipBases` — load-bearing, so the extraction site is named),
unconditionally drawn, or a decoration inside a read body that `hitTestFeature`
already answers for. The test checks the classification against each layer's
real `enabled`. `read` is the subtle entry: it draws unconditionally and its hit
gate sits _above_ the layer list, because a collapsed band has zero height
rather than a false gate.

The converse gap is a layer with no hit test at all. Soft-clipped bases are the
one that bit: `readPositions` carries the read's TRUE aligned extent (the
soft-clip expansion goes into the layout's extents and is never written back),
so `hitTestFeature` misses the run `drawSoftclipBases` paints past the alignment
end — and a miss clears the selection on click and falls through to the
**browser's** context menu on right-click.

Priority within the chain is a decision, not scan order. Neither index-backed
test may take `hits[0]`: `Flatbush.search` returns packed Hilbert order, which
for one row's collinear points is ascending position, so `hits[0]` is the
leftmost candidate rather than the one under the cursor. `hitTestModification`
boxes points and picks by **distance**. `hitTestChain` boxes each chain's whole
extent, so every candidate is at distance 0 — it picks the **highest chain
index**, matching `hitTestFeature`'s "last drawn wins", the two arrays being
built in one ascending pass.

## Context menu: build items from the id, not the feature

`contextMenuFeature` arrives a round trip after the click. Gate items on
`contextMenuFeatureId`; items needing the read's own fields are pushed **after**
the id-built ones, so arriving late appends rather than shifting what is under
the cursor. Use `withContextMenuFeature` — reading `contextMenuFeature` live
inside an `onClick` gets nothing, `closeContextMenu` ran first.

## Layout and draw paths

Chain layout is handed **neither `sortedBy` nor `largeFeaturesFirst`** — its
rows are chains, ordered by chain distance. Every ordering/row control curates
itself out in chain mode (`canCollapseGroupRows`, `offeredGroupByTypes`, the
"Sort by..." gate and the context menu's `sort` flag); a new one that doesn't is
a silent no-op, and a tag sort additionally refetches for `sortTagValues`
nothing reads.

Layout is main-thread, and
[ADR-053](../../../../agent-docs/architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md)
has the four properties that depend on it and names the separable half worth
attacking. Read it before proposing the move. **Don't reintroduce a levels /
right-edge-only array** in `placeRect`: features arrive out of start order in
both layouts, so it would fragment layout.

On-screen and SVG export share `drawAlignmentBlocks`; don't reintroduce SVG-only
draw functions. Sashimi and linked-read bezier arcs are interactive SVG overlays
that each share one geometry source with the export — don't port them into
`drawAlignmentBlocks`. Sashimi's source is a model because the geometry depends
on pan/zoom but **not** `scrollTop`, and recomputing per scroll frame
re-projected every junction.

**No GPU pass can join two displayed regions** — one buffer per region, each
clipped to its own bp range. `bezierArcScope` is the one place that decides:
`all` when the user ticked curved connectors, `crossRegion` in chain mode
without it (chain layout puts a chain's ends on one row across regions and its
per-region line pass then joins nothing), `none` otherwise. Anything reading it
must read the getter, not `showBezierConnections` — the live overlay, the SVG
export and the legend disagreeing means a connector on screen with no key entry.
The `crossRegion` short-circuit on `laidOutPileupMap.size < 2` keeps a scope
nobody opted into off the single-region hot path.

This is not a clipping limit: **an arc across two regions was never clipped
away, it was drawn in the wrong place and then clipped**. Each block projects bp
through its OWN range, so the far foot is extrapolated as though the bp the view
skips at the seam did not exist — 150 px of error in opposite directions on the
worked case. `CrossRegionArcsOverlay` is the globally-correct curve, drawn once
in view space:

- **Its geometry is `arcMark`'s, through `arcMarkFrom`** — the same resolution
  the GPU and Canvas2D use, with the bp→x step hoisted out because each foot
  resolves through its own region. A lookalike traced beside it is drift.
- **It is a separate z-layer**, so a cross-region arc paints above every canvas
  arc and tick regardless of `arcPaintRank`. Accepted: nothing cross-region is
  routine.
- **Its hover writes `setHoverState`**, not a local hovered-key.
  `ArcHoverOverlay` is its own z-layer too, so two hover mechanisms in one band
  can show a hover twice.

**Which sub-band a sashimi arc draws in is decided once**, in genomic bp, by
`sashimiDownKeysByGroup` (→ `features/sashimi/junctions.ts`), and read by both
the layout that reserves the strip and the geometry that fills it. Don't
re-derive it in screen space: the down sub-band renders at `sashimiArcsHeight`
whether or not the layout reserved it, so two passes that disagree paint arcs
over the pileup. Junction identity is `junctionKey` — refName included, because
two chromosomes in view share nothing but a bp number line.

**A band's height MINUS its reserved margin is floored at 0**, because
`clampBandHeight` holds the drag handle and not the slot or the snapshot, so the
subtraction goes negative (`arcAvailH`, sashimi's `effectiveHeight`, the
tooltip's coverage bar). Floor it where the expression is declared, not per
consumer; if a shader computes it too, that declaration is the `.slang` one and
the CPU side imports the generated twin (adr-051).

`computeArcBand` is the single source of truth for the arc band and is decoupled
from `showCoverage` — don't reintroduce a `covH > 0` gate. Arc and sashimi
strips are reserved **per section**, so resize handles gate on the section,
never on `belowCoverageBands`. `coverageDisplayHeight` and the fit-height row
budget stay global on purpose: re-deriving them from `sections` routes the fit
volatile back through the layout it feeds.

Screen-x is not start/end-ordered — keep new sashimi geometry on the normalized
fields. In shaders use `bpToClipX`/`bpToLinear`, never
`hpClipX(hpSplitUint(…))`.

## The arc band draws two families, and answers for both

Curved/flat arcs (`arc`, `arcFlat`, `arcMarker`) and interchromosomal connector
ticks (`arcLine`) share one rect, one Y scale and one palette, and they overlap
freely. `hitTestArcBand` is the single entry point: which one a hover resolves
to is a question about **paint order**, so the answer belongs beside the scan.
Both renderers run the line pass **first** (`drawArcsPass`; `drawArcs` strokes
ticks before curves), so an arc is always the later ink. The rule is two-tier —
on-ink beats near-ink either way, the arc wins among on-ink, and a near-ink tie
goes the same way — because "arc always" would make a tick unhoverable wherever
any arc crosses it.

**Which family an interchromosomal connection joins is decided per connection,
by whether both of its feet are in displayed regions.** Both → one arc, in the
cross-region overlay; otherwise → the two ticks. A tick's whole claim is "there
is a connection to somewhere you cannot see", which is false when the far end is
on screen, and the arc's feet are the two tick positions so no position is lost.
Three things ride on it:

- **Arc mode only.** The read cloud's Y axis IS insert size, and an
  interchromosomal pair has none — TLEN 0 makes `computeArcShape` fall back to
  the endpoint gap, which becomes a real `maxFlatArcSpanBp`, which
  `arcsYDomainBp` maxes across groups, which `insertSizeTickSections` PRINTS on
  the ruler. One connection would rescale the cloud to a 107 Mb "insert size".
  Arc mode's axis is genomic radius, already clamped at `INTERCHROM_ARC_YBP`.
- **`drawInter` and `minInterchromSupport` gate both marks**, from one hoisted
  condition. Inside the tick push, an arc branch beside them inherits neither —
  "Show inter-chromosomal pairs: off" still drawing arcs, and the mismapping
  floor bypassed for a bigger mark.
- **The hover needs two refNames.** `formatArcTooltip` builds a range from
  `min`/`max` of the two bp, which across chromosomes is a locstring naming one
  and a coordinate from the other; `endRefName` switches it to two positions and
  no distance. An arc replacing ticks must not lose it.

**Paint order in this band is an interest ranking, not a data order**, stated in
two places:

- Between the families, in `ARC_PASSES`: ticks under arcs. On deep short-read
  data mismapped pairs put a full-height opaque vertical at a large share of
  loci, straight through the arcs that carry insert size and orientation.
- Within the arcs, in `resolveArcs`' sort: `arcPaintRank` (categorized over
  uncategorized) first, `support` second, dedup key last. A deep pileup is
  overwhelmingly concordant pairs all painting the baseline slot, so
  support-ascending alone let grey punch through.

`hitTestArcBand` reads that order rather than re-deriving it: `bestMark`'s
on-ink winner is the **last candidate considered**, both feeds arriving in paint
order and both scans running ascending.

**"Concordant" has one definition and two settings spend it.**
`isConcordantPairRead` (`shared/buildBaseFeatureData.ts`) is the aligner's
verdict — flagged proper, not supplementary, mates facing — called by both the
worker's read filter behind "Show proper pairs" (`isProperPairChain`) and the
arc filter behind "Show concordant-pair arcs" (`resolveArcs`).
`concordantPairParity.test.ts` holds the read filter's real answer against the
predicate.

The arc filter adds a second condition: the arc must also be painting the
**baseline colour slot** (`arcPaintRank`). Without it the setting hides arcs the
display is drawing as a category — a proper-flagged pair whose |TLEN| is below
the band paints short-insert, and 42 of 48 pink arcs disappeared in testing.
Nothing coloured may be hidden as routine.

Not to be confused with the read cloud's `isConcordantFRPair`, which asks
whether |TLEN| sits in the modal band rather than what the aligner concluded.
Each function's comment names the other.

**A support FLOOR is offered for the interchromosomal family — either mark — and
deliberately not for same-chromosome arcs.** `minInterchromSupport` counts reads
over a window of one fragment length on _both_ sides
(`clusteredInterchromSupport`), never at a coordinate: mates straddle a
breakpoint rather than landing on it, so `arcKey`'s exact count is 1 for
essentially every interchromosomal connection. The window comes from
`stats.upper`, so it tracks the library. The same floor on same-chromosome arcs
was measured and declined — at depth it is a density filter, not an evidence
filter (`agent-docs/reference/DEEP_COVERAGE.md`).

**Both families carry `support` and spend it the same way.** An arc and a tick
are each ONE junction that `resolveArcs` coalesced, and `arcLineWidth` is the
one curve turning that count into ink for Canvas2D, the SVG export and both GPU
passes (resolved CPU-side at pack time; no shader evaluates it).

**A tick is DASHED, and that is what separates it from an arc's foot.** The two
land on the same x whenever a breakpoint reaches one acceptor the view shows and
another it does not. Both marks are ARC_COLOR_INTERCHROM and both run the band's
height, so solid they read as one mark: on `cancer_sv/k562_bcr_abl_split` that
hid a junction carrying six times the drawn arc's support. Support cannot do
this job — `arcLineWidth` caps at 4x the base width around 44 reads, so a
206-read tick and a 37-read one are the same 8 device px.

The pattern is declared in `arcLine.slang` (`ARC_LINE_DASH_PX` /
`ARC_LINE_GAP_PX`) and the CPU side imports the generated twin (adr-051). Its
period is deliberately not arcFlat's `[3, 3]` split-line dash — in read-cloud
mode both can be on screen at once. `SvgCanvas.setLineDash` carries it into the
export. `tickDash.test.ts` pins the pattern in force AT each stroke rather than
that `setLineDash` was called.

`partnerOffView` on `ArcLineTooltipPayload` prints "Outside the displayed
regions". **The claim is safe unconditionally in arc mode and false in read
cloud** — the cloud ticks every interchromosomal connection, displayed partner
or not — so the caller reads `readConnections`, the same setting `resolveArcs`
branches on.

**Ask `hasArcBandInk`, not `numArcs`.** A lane whose only interchromosomal
partner is off-region carries ticks and no arcs, so an arc-count gate reserves
the band, paints it, then treats it as empty. The one exception is
`resolveArcBandDebug`, which answers "why is this arc this shape".

**A question asked ACROSS the lanes is answered by `computeArcsByGroup`, not by
a walk of `arcsByGroup`.** There are three — lanes with any ink
(`inkGroupKeys`), colour slots drawn (`colorSlots`), the read cloud's Y domain
(`maxFlatArcSpanBp`) — and splitting the cross-region arcs out of that feed
broke two at once. `ArcsByGroupResult` also says why all three are computed
AFTER regionization: an arc reaching no displayed region is dropped, so keying a
swatch off the pre-regionization set names a colour nothing draws.

The endpoint squares have no hit test of their own, covered by the bar's
tolerance because `ARC_MARKER_PX / 2 <= ARC_HIT_SLOP_PX` — arithmetic, not
design, so `hitTest.test.ts` pins it.

**An interchromosomal arc draws BREAKEND FEET, and no other arc does.** A short
horizontal tick at each foot, lying over the ARM that foot's junction keeps:
outward feet are a deletion-type junction, inward a duplication-type, parallel
an inversion.

- **It is the family whose colour channel is spent.** Every interchromosomal
  connection paints `ARC_COLOR_INTERCHROM` whatever `colorByType` says, so
  orientation has nowhere else to go. A same-chromosome split junction still has
  it — `unpairedOrientationColor` paints a strand flip magenta and a co-linear
  join yellow — which is why those arcs get none. Widening feet to the pair arcs
  was measured down: orientation on a pair arc IS the colour, and every foot
  lands on the baseline (~278 arcs across 3000 px on
  `gallery/inverted_duplication` would be ~556 marks 20 px long five pixels
  apart — a rule under the band, not directions).
- **Interchromosomal is the one family that is ALWAYS cross-region**, so drawing
  the feet in `CrossRegionArcsOverlay` covers all of it. Feet on same-chromosome
  cross-region arcs would appear and disappear as a reader panned the identical
  junction across a seam.
- **The direction is a property of the JUNCTION, not of the read**, which makes
  it safe on a coalesced arc: reading the same molecule from the other end swaps
  which segment is trailing and flips both strands, and the two cancel
  (`readTrailingBodyDir`, @jbrowse/cigar-utils). A `ComputedLine` carries none,
  because a tick coalesces on one coordinate and two junctions sharing a
  breakpoint would take whichever read arrived first.
- **THE ARM, not "this foot's own aligned body", and the two producers differ on
  exactly that.** A split junction's arc endpoint IS the junction, so arm and
  segment body are the same ray and `connectionEndpointBps` hands `dir1`/`dir2`
  straight through. A mate link's endpoint is the FRAGMENT's outer edge — a read
  length outside the junction, body pointing back at it — so `pairOuterDir`
  answers with the read's direction NEGATED. Mirroring the two ternaries instead
  made an FR pair draw feet inward, spelling "duplication", while a split read
  over the identical junction drew them outward. `arcBreakendFeet.test.ts` holds
  the two families against each other; the parallel case is deliberately not the
  only multi-foot one there, since negating both feet of a parallel pair is a
  no-op.

The feet live in the **mark** (`ArcFeet`), not in the overlay's path string, so
the hover highlight — which re-traces `arc.mark` at its own origin — draws them
too. Their sign is deliberately the opposite of `tangentSign`
(`core/util/bezierConnector.ts`), the direction a per-read connector LEAVES the
same endpoint in: a foot lies over the retained arm and the curve departs across
the junction, which together is what BreakpointSplitView's `buildBreakpointPath`
draws. Don't "fix" either to match the other.

A foot is `ARC_FOOT_PX` from its anchor unconditionally, so two feet closer than
that merge into one bar — the mark working, since they overlap precisely because
both ends keep the same stretch. A foot crossing its region's seam is not
handled (`agent-docs/TODO.md`, "Bound a breakend foot by its displayed region"),
and the interchromosomal ticks have no feet yet ("Give the interchromosomal
ticks breakend feet too").

**An arc outranks the band it is painted over, and it says so as a RESULT
VARIANT.** `runHitTest` returns `arc ?? result`, so `ArcMarkHit` is a member of
`MarkHitResult` alongside the pileup's five — one value, one discriminant, one
place where the ranking is stated. As an `if` in each gesture, one of them
forgot (`93af1f54f0` guarded the click and left the right-click): in up mode
`computeArcBand` gives the band `top: 0`, which IS the coverage band, so a
right-click on an arc built the interbase menu for the column underneath while
the tooltip said "Read connection".

As a variant, each gesture is right by default:

- `hoverStateForResult` **does not compile** without `case 'arc'` (TS2366). That
  is the only enforcement; the others are structural.
- `handleClick`'s switch matches no pileup case, so it does nothing. The
  explicit `case 'arc': return` is there against a future `default:`.
- `contextMenuFieldsForHit` answers `show: false` from its `default`, so an arc
  falls through to the BROWSER's menu. No `preventDefault`.

`arcGestureGuard.test.ts` holds the behaviour at the one pixel where an arc's
ink lies over an interbase bar — the mark that answers a click with a widget AND
a right-click with a menu. It finds that pixel by asking the hover rather than
by projecting the dome, and states every case against its own control: the SAME
pixel with `readConnections` off. Both cases fail if `arc ?? result` stops
preferring the arc.

`mouseGestures.test.ts` covers the two handlers that are pure guard —
`handleMouseDown`, which decides between this display's pan, the LGV's
shift+drag rubberband and the browser's own menu by DECLINING two of them, and
`handleMouseLeave`. Its `cancelAnimationFrame` stub is load-bearing: stubbing
only `requestAnimationFrame` leaves the real cancel with no id of ours, the held
callback runs anyway, and the queued-hover case reads as the leave failing.

`createTestAlignmentsDisplay` (`testUtils.ts`) is the harness both use — a real
display in a measured LGV.

**`isFlatArcShape` answers "does this draw as a bar", never "does this have an
insert size".** Both flat variants draw as a bar, and only `ARC_SHAPE_FLAT` —
the mate link — has a TLEN. `computeArcShape` gives `ARC_SHAPE_FLAT_SPLIT`
`spanBp = |p2Bp - p1Bp|`, exactly the arc's own span, so gating the tooltip's
insert-size row on the drawing predicate printed the Distance line again under a
name a split read cannot carry.
