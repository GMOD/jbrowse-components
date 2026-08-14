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
every per-feature Y array and rebuilds the modification Flatbush, then makes the
renderer repack every GPU pass; a recolor touches two per-read arrays and one
pass. So a color input in `groupLayoutContext` costs the full relayout to change
a color, and also loses the recolor fast path, since layout allocates a fresh
`readYs` that the renderer keys its upload memo on. Same trap for a value the
layout only _sometimes_ spends: the band overhead is a thunk so an ungrouped
display doesn't relayout on every frame of a coverage-band resize drag.

- **Never put a fetch-result derivative in `rpcProps()`** — infinite loop.
  `colorTagMap` is the canonical trap: the worker reports raw tag values and the
  main thread bakes colors at tier 2.
- **Tier 4 repaints the whole canvas**, so per-mousemove state must not be
  there. The hover highlight is a React overlay on purpose; selection stays in
  `renderState` (rare, and belongs in SVG export).
- Read color is classified once at tier 2, so `flipStrandLongReadChains` /
  `colorSupplementaryChains` are deliberately absent from `renderState`.

## A split segment's colour is framed by the CHAINS ON SCREEN, not by its primary

`readChainHasSupp`'s 1/2 is a chain-level **frame** — "which way is red here" —
and the worker's answer to it is a starting point that the main thread
overwrites twice, in this order:

1. `reconcileChainSuppAcrossRegions` — what one molecule's own segments say,
   unioned across displayed regions. A worker call sees one region.
2. `consensusChainStrandFrames` — what the molecules say about **each other**. A
   worker call also sees one chain.

The second exists because the frame the worker computes is `primaryStrand`, and
**on a foldback the primary flag is arbitrary**: the two arms align to
overlapping reference in opposite orientations, so both are candidates for
"longest alignment" and which one is flagged turns on where the read started.
Measured on the COLO829 chr3 foldback (`cancer_sv/derivative_inserts`, 33 split
molecules): 19 reads' primary ends at one arm's junction and 14 at the other's,
that split predicts the painted colour with no exceptions, and each insert
window came out a coin flip. It is **not** the sequencing direction —
`strand * primaryStrand` cancels that correctly, and both classes hold a mix of
forward and reverse primaries. No per-chain rule fixes it, because a foldback
has no locally identifiable canonical segment; longest-alignment,
first-along-the-read and leftmost-in-region measured 58/52/61% agreement where
the consensus reaches 100%.

Two properties of that pass are load-bearing and each looks like a detail:

- **Votes are purity-normalized, not length-weighted.** Raw length lets one
  chain's 32 kb arm outvote every 200 bp insert on screen — and since that arm
  is also the primary, every chain then agrees with every other by construction
  and the pass flips nothing (measured: 0 of 33). Normalizing also makes a
  foldback chain **abstain** at the locus where its own two arms cancel, which
  is the tie the primary flag was silently breaking.
- **A chain seen at ONE locus is frozen.** There its frame and its mapping
  strand are the same statement, so re-framing it is not resolving an ambiguity,
  it is replacing the read's orientation with its neighbours' — which deletes
  exactly the lone inverted supplementary at a breakpoint that this colouring
  exists to show. Frozen chains still vote.

The global sign is anchored separately (keep the majority of chains on the frame
they arrived with), because negating every frame is an equally optimal answer
and nothing in the objective picks between them — without the anchor the pileup
can swap red for blue between two renders of identical data.

**Panning can change a frame, and that is accepted rather than unfixed.** The
evidence is what is on screen, so panning a chain's second locus away drops it
to one bucket, the freeze applies, and it falls back to its primary's answer.
That fallback is exactly what these reads showed before the pass existed — it
can only CHANGE a chain where cross-locus evidence is on screen, so losing that
evidence cannot land the display anywhere it could not already have been.
Holding the old frame would mean carrying state across fetches and painting from
reads that are no longer visible. Both halves are pinned in
`chainStrandConsensus.test.ts` ("panning").

**The figure sweep across every chain-mode lane, for the next person who
wonders.** `inversion_long_read` — an ONT inversion, the case the freeze rule
exists for — regenerated **byte-identical**. `pangenome/long_reads` moved by one
chain, correctly. The `inverted_duplication` pair moved too and NOT because of
this: they are paired-end, which the pass skips entirely, so that was ambient
drift.

So: **don't re-derive a frame at a call site.** Read `readChainHasSupp`.
`framesUnpairedChainStrand` is the single statement of when the framing is live
at all, and gates the pass on it.

## Three different "is it grouped?" questions

`isGrouped` (>1 section) is the scroll model. `showsGroupLabels` is the chips —
grouping that yields one section still reserves the label offset, so it must
still name that section. `rpcDataMap.size === 0` is whether data arrived; never
gate first paint on a laid-out map, since a grouped fetch over an empty region
partitions to zero groups and the overlay never clears.

**Anything dodging the chips asks `showsGroupLabels`**, not `isGrouped` — the
coverage y-axis (on screen and in `renderSvg`) moves to the right for exactly
that reason, and a single named section draws a chip while `scalebarOverlapLeft`
resolves to 0, so keying on the section count put the axis under it.

`hiddenGroupKeys` must be filtered out of the **cross-group** derivations too
(coverage stats, legend, sashimi, arcs) or a hidden lane sizes the axis the
visible ones share — for arcs, before `poolArcScale`.

`collapseGroupRows` puts depth in the overlap tint, so the collapsed path must
**not** run `mergeSpans`.

## Two row caps, and only one of them is an affordance

A pileup can be clipped by its group's slice of the viewport or by the
display-wide `maxHeight`. `groupClippedBy` is the single classifier, and the two
answers get very different treatment:

- **`'budget'`** offers the label chip's expand, which banks a per-group
  override. Both surfaces that write `groupMaxHeightOverrides` (chip and drag
  handle) gate on `canSizeGroupHeights`.
- **`'ceiling'`** offers nothing. It draws `PileupTruncationRule` — a hairline
  and caption across the bottom of the clipped rows, scrolling with them — and
  the cap is raised from the track menu.

Offering the wrong one is a button that does nothing: an expand banks an
override OF `maxHeight`, so a lane already clipped there gets the identical cap
back while the override silences the flag.

**The ceiling notice is deliberately inert, and deliberately not a chip.** It
was a `warning`-toned corner chip whose press set `maxHeight` to 1,000,000. The
press is the half that mattered: it writes a config slot, so one click committed
the track to laying out every read everywhere, the notice then vanished, and the
only way back was a track-menu dialog. The alert tone was the other half — reads
collapsing onto the bottom row is the cap working, not a fault. A notice drawn
at the boundary it describes is met by scrolling to the end of the reads, which
is exactly when "there were more" is worth knowing.

Note what this is NOT justified by, since the claim was made and is false: the
6000px default is not reached at every locus on deep data. Measured on HG002
300x at 1:2,000,000, the pileup lays out **431 rows against a cap allowing
750**. Reaching it takes ~1.7x that depth or a larger `featureHeight`.

## Read height vs track height

**`fit` is the sole `heightMode` that also drives the read-height axis** — every
awkward special case follows from that, including that the fit cap uses the
Normal height rather than the configured one.

Naming trap: `self.featureHeight` is the **fit-squeezed** value, so editors that
mutate the size must read `configuredFeatureHeight` — which is
`resolveConf(self, 'featureHeight')`, not `getConf`. The slot is promotable, so
a raw `getConf` read hands back the `undefined` inherit sentinel rather than a
size; `configuredFeatureHeight` is the only spelling of "the configured
fixed-mode size". `fittedHeightPx` is a **pitch**, `featureHeight` a **body**;
the volatile bridging them breaks a MobX cycle, so don't collapse it.

Grow mode is `HeightModeMixin`'s in full — this display supplies only
`growTargetHeight` (the stacked-sections height) and super-captures
`setHeightMode` for the two resets the mixin can't know about. The scroll clamp
is `TrackHeightMixin`'s, off `scrollableHeight`.

## Hit-testing: every draw gate needs a matching hit gate

`PILEUP_LAYERS` decides what is painted; `performHitTest` decides what answers a
hover, click and right-click. The settings that gate them are repaint-tier — the
arrays are fetched either way — so a layer switched off would keep its marks
hoverable, clickable and right-clickable over blank pixels. `showMismatches` and
`pileupVisible` are in `HitTestOptions` for exactly that reason; `clip` is
deliberately absent because its layer draws unconditionally. The sharp case is
`hitTestGap`: the read body is split at skips but **not** at deletions, so an
ungated gap test intercepts the whole span of a read that draws as solid body,
and the read stops being selectable across its own deletion.

**What keeps the two lists in step is `HIT_GATES`**
(`hitTestGateParity.test.ts`), exhaustive over `PileupLayerId` so a new layer is
a compile error until it states one of four stories: gated on a named
`HitTestOptions` flag, empty of data when its setting is off (`mod`,
`softclipBases` — load-bearing, so the extraction site is named),
unconditionally drawn, or a decoration inside a read body that `hitTestFeature`
already answers for. The test then checks the classification against each
layer's real `enabled`, so "unconditional" and "gated" can't be claimed wrongly.
`read` is the subtle entry: it draws unconditionally and its hit gate sits
_above_ the layer list, because a collapsed band has zero height rather than a
false gate.

The converse gap is a layer with no hit test at all. Soft-clipped bases are the
one that bit: `readPositions` carries the read's TRUE aligned extent (the
soft-clip expansion goes into the layout's extents and is never written back),
so `hitTestFeature` misses the run `drawSoftclipBases` paints past the alignment
end — and a miss doesn't fail quietly, it clears the selection on click and
falls through to the **browser's** context menu on right-click.

Priority within the chain is a real decision, not scan order. Neither
index-backed test may take `hits[0]`: `Flatbush.search` returns packed Hilbert
order, which for one row's collinear points is ascending position, so `hits[0]`
is the leftmost candidate in the window rather than the one under the cursor.
Which rule replaces it depends on what the boxes are. `hitTestModification`
boxes points and picks by **distance**. `hitTestChain` boxes each chain's whole
extent, so every candidate contains the cursor and is at distance 0 — it picks
the **highest chain index**, which is `hitTestFeature`'s "last drawn wins" rule,
the two arrays being built in one ascending pass.

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
has the four properties that depend on it and names the separable half actually
worth attacking. Read it before proposing the move — it is re-proposed roughly
every time the main-thread pack shows up in a trace. **Don't reintroduce a
levels / right-edge-only array** in `placeRect`: features arrive out of start
order in both layouts, so it would fragment layout.

On-screen and SVG export share `drawAlignmentBlocks`; don't reintroduce SVG-only
draw functions. Sashimi and linked-read bezier arcs are interactive SVG overlays
that each share one geometry source with the export — don't port them into
`drawAlignmentBlocks`. Sashimi's source is a model computed because the geometry
depends on pan/zoom but **not** `scrollTop`, and recomputing per scroll frame
re-projected every junction.

**No GPU pass can join two displayed regions** — one buffer per region, each
clipped to its own bp range — so the bezier overlay is not only a style choice.
`bezierArcScope` is the one place that decides: `all` when the user ticked
curved connectors, `crossRegion` in chain mode without it (chain layout puts a
chain's ends on one row across regions and its per-region line pass then joins
nothing), `none` otherwise. Anything reading it must read the getter, not
`showBezierConnections` — the live overlay, the SVG export and the legend
disagreeing means a connector on screen with no key entry, or the reverse. The
`crossRegion` short-circuit on `laidOutPileupMap.size < 2` is what keeps a scope
nobody opted into off the single-region hot path.

The precision that rule is missing, since it reads as a clipping limit and is
not one: **an arc across two regions was never clipped away, it was drawn in the
wrong place and then clipped**. Each block projects bp through its OWN range, so
the far foot is extrapolated as though the bp the view skips at the seam did not
exist — 150 px of error in opposite directions on the worked case, two curves
with two apexes, neither of them the arc. Had both blocks drawn the same
globally-correct curve, each clip would have kept its own half and the halves
would have joined. `CrossRegionArcsOverlay` is that curve, drawn once in view
space, and three things about it are worth knowing before touching it:

- **Its geometry is `arcMark`'s, through `arcMarkFrom`** — the same resolution
  the GPU and Canvas2D use, with the bp→x step hoisted out because it is the one
  part that genuinely differs (each foot resolves through its own region). A
  lookalike traced beside it is the drift this directory keeps paying for.
- **It is a separate z-layer**, so a cross-region arc paints above every canvas
  arc and tick regardless of `arcPaintRank`. Accepted rather than accidental:
  nothing cross-region is routine.
- **Its hover writes `setHoverState`**, not a local hovered-key that thickens
  its own stroke. `ArcHoverOverlay` is its own z-layer too, so two hover
  mechanisms in one band can show a hover twice.

**Which sub-band a sashimi arc draws in is decided once**, in genomic bp, by
`sashimiDownKeysByGroup` (→ `features/sashimi/junctions.ts`), and read by both
the layout that reserves the strip and the geometry that fills it. Don't
re-derive it in screen space next to the arc math: the down sub-band renders at
`sashimiArcsHeight` whether or not the layout reserved it, so two passes that
disagree in the under-reserving direction paint arcs over the pileup. Junction
identity is `junctionKey` — refName included, because two chromosomes in view
share nothing but a bp number line.

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
freely. `hitTestArcBand` is the single entry point for that reason: which one a
hover resolves to is a question about **paint order**, and the answer belongs
beside the scan rather than at each call site. Both renderers run the line pass
**first** (`drawArcsPass`; `drawArcs` strokes the ticks before the curves), so
an arc is always the later ink. The rule is two-tier — on-ink beats near-ink
either way, the arc wins among on-ink, and a near-ink tie goes the same way —
because "arc always" would make a tick unhoverable wherever any arc crosses it.

**Which family an interchromosomal connection joins is decided per connection,
by whether both of its feet are in displayed regions.** Both → one arc, in the
cross-region overlay; otherwise → the two ticks, exactly as before. That is not
a preference: a tick's whole claim is "there is a connection to somewhere you
cannot see", which is precisely false when the far end is on screen, and the
arc's feet are the two tick positions so no position is lost. Three things ride
on it, each of which ships a silently wrong picture on its own:

- **Arc mode only.** The read cloud's Y axis IS insert size, and an
  interchromosomal pair has none — it carries TLEN 0, so `computeArcShape` falls
  back to the endpoint gap, which becomes a real `maxFlatArcSpanBp`, which
  `arcsYDomainBp` maxes across groups, which `insertSizeTickSections` PRINTS on
  the ruler. One connection would rescale the cloud to a 107 Mb "insert size".
  Arc mode's axis is genomic radius, where the band ceiling is already where a
  maximally-far same-chromosome pair clamps (`INTERCHROM_ARC_YBP`).
- **`drawInter` and `minInterchromSupport` gate both marks**, from one hoisted
  condition. They used to sit inside the tick push, so an arc branch beside them
  would inherit neither — "Show inter-chromosomal pairs: off" still drawing
  arcs, and the mismapping floor bypassed for a mark BIGGER than the ticks it
  replaced.
- **The hover needs two refNames.** `formatArcTooltip` builds a range from
  `min`/`max` of the two bp, which across chromosomes is a locstring naming one
  and a coordinate from the other; `endRefName` switches it to two positions and
  no distance. This is also the one thing a tick's hover was worth more than an
  arc's, so an arc replacing ticks must not lose it.

**Paint order in this band is an interest ranking, not a data order**, and it is
stated in two places for the two things that overlap:

- Between the families, in `ARC_PASSES`: ticks under arcs. A translocation is
  the one claim here a single window cannot support on its own, and on deep
  short-read data mismapped pairs put a full-height opaque vertical at a large
  share of loci — straight through the arcs that carry insert size and
  orientation.
- Within the arcs, in `resolveArcs`' sort: `arcPaintRank` (categorized over
  uncategorized) first, `support` second, dedup key last. A deep pileup is
  overwhelmingly concordant pairs and they all paint the baseline slot, so
  support-ascending alone let grey punch through the few arcs that mean
  something.

`hitTestArcBand` reads that order rather than re-deriving it: `bestMark`'s
on-ink winner is simply the **last candidate considered**, both feeds arriving
in paint order and both scans running ascending. It used to rank on `support`,
which was the same thing only while support _was_ the sort key — so a fixture
built out of feed order now tests a state production cannot reach.

**"Concordant" has one definition and two settings spend it.**
`isConcordantPairRead` (`shared/buildBaseFeatureData.ts`) is the aligner's
verdict — flagged proper, not supplementary, mates facing — and it is called by
both the worker's read filter behind "Show proper pairs" (`isProperPairChain`)
and the arc filter behind "Show concordant-pair arcs" (`resolveArcs`). One hides
the reads, the other their arcs; `concordantPairParity.test.ts` holds the read
filter's real answer against the predicate so the two cannot drift.

The arc filter adds a second condition the read filter has no use for: the arc
must also be painting the **baseline colour slot** (`arcPaintRank`). Without it
the setting hides arcs the display is drawing as a category — a proper-flagged
pair whose |TLEN| is below the band paints short-insert, and 42 of 48 pink arcs
disappeared in testing. Nothing coloured may be hidden as routine, and keying on
`arcPaintRank` makes "hidden" and "grey" the same set by construction under
whatever `colorByType` is selected.

Not to be confused with the read cloud's `isConcordantFRPair`, which asks
whether |TLEN| sits in the modal band rather than what the aligner concluded.
Both readings are deliberate; each function's comment names the other.

**A support FLOOR is offered for the INTERCHROMOSOMAL family — either mark — and
deliberately not for the same-chromosome arcs.** `minInterchromSupport` counts
reads over a window of one fragment length on _both_ sides
(`clusteredInterchromSupport`), never at a coordinate: mates straddle a
breakpoint rather than landing on it, so `arcKey`'s exact count is 1 for
essentially every interchromosomal connection and a floor over it would delete a
real translocation as thoroughly as the mismapping. The window comes from
`stats.upper`, so it tracks the library instead of a constant. The same floor on
same-chromosome arcs was measured and declined — at depth it is a density
filter, not an evidence filter. Both results are in
`agent-docs/reference/DEEP_COVERAGE.md`.

**Both families carry `support` and both spend it the same way.** An arc and a
tick are each ONE junction that `resolveArcs` coalesced, and `arcLineWidth` is
the one curve turning that count into ink for Canvas2D, the SVG export and both
GPU passes (resolved CPU-side at pack time; no shader evaluates it). Coalescing
without keeping the count left a 40-read translocation drawing exactly like one
mismapped pair.

**A tick is DASHED, and that is what separates it from an arc's foot.** The two
land on the same x whenever a breakpoint reaches one acceptor the view shows and
another it does not — the ordinary shape of a translocation seen through two
windows, and the ordinary shape of a fusion whose transcript has more than one
acceptor. Both marks are ARC_COLOR_INTERCHROM and both run the band's height
there, so solid they read as one mark: on `cancer_sv/k562_bcr_abl_split` that
hid a junction carrying six times the drawn arc's support behind what looked
like the arc's own leg, and the figure shipped that way.

**Support cannot do this job, which is the part worth knowing before reaching
for it.** `arcLineWidth` caps at 4x the base width around 44 reads, so a
206-read tick and a 37-read one are the same 8 device px — re-framing a figure
to thin the bar cannot work, and two people have now expected it to.

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
chromosome is the whole content of a tick and it is actively misleading when
that chromosome is on screen. **The claim is safe unconditionally in arc mode
and false in read cloud** — the cloud ticks every interchromosomal connection,
displayed partner or not — so the caller reads `readConnections`, the same
setting `resolveArcs` branches on, rather than assuming.

**Ask `hasArcBandInk`, not `numArcs`.** A lane whose only interchromosomal
partner is off-region carries ticks and no arcs, so an arc-count gate reserves
the band, paints it, and then treats it as empty. The one deliberate exception
is `resolveArcBandDebug`, which answers "why is this arc this shape" and so has
nothing to say about a tick.

**A question asked ACROSS the lanes is answered by `computeArcsByGroup`, not by
a walk of `arcsByGroup`.** There are three — the lanes with any ink
(`inkGroupKeys`), the colour slots drawn (`colorSlots`), the read cloud's Y
domain (`maxFlatArcSpanBp`) — and all three used to be walks of that one feed.
Splitting the cross-region arcs out of it broke two at once and would have
broken the third: a band unreserved for a lane whose ink had moved, a legend
swatch missing for a colour still on screen. They are not three slips; "which
arcs does this lane draw" had stopped having one answer, and a fourth half would
break them again. `ArcsByGroupResult` also says why all three are computed AFTER
regionization: an arc reaching no displayed region is dropped, so keying a
swatch off the pre-regionization set names a colour nothing draws.

The endpoint squares have no hit test of their own, covered by the bar's
tolerance because `ARC_MARKER_PX / 2 <= ARC_HIT_SLOP_PX`. That is arithmetic,
not design, so `hitTest.test.ts` pins it.

**An arc outranks the band it is painted over, and it says so as a RESULT
VARIANT.** `runHitTest` returns `arc ?? result`, so `ArcMarkHit` is a member of
`MarkHitResult` alongside the pileup's five — one value, one discriminant, and
one place (`arc ?? result`) where the ranking is stated.

That shape is the fix for how this went wrong. The guard used to be an `if` in
each gesture, and when each asked for itself one of them forgot: `93af1f54f0`
guarded the click and left the right-click. In up mode `computeArcBand` gives
the band `top: 0`, which IS the coverage band, and `hitTestInterbase` answers
over the indicator strip and the bar stack inside it — so a right-click on an
arc built the interbase menu for the column underneath while the tooltip said
"Read connection". Down mode never showed it (own band, `type: 'none'`), which
is why it survived casual testing.

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

`arcGestureGuard.test.ts` holds the behaviour, and it works the one pixel where
an arc's ink lies over an interbase bar — the mark that answers a click with a
widget AND a right-click with a menu, so one pixel states both halves. It finds
that pixel by asking the hover rather than by projecting the dome, since a
fourth placement of the arc written into the test would be free to disagree with
the three it is checking. Every case is stated against its own control: the SAME
pixel with `readConnections` off, which is the only thing separating "the guard
suppressed this" from "there was nothing here anyway". Both cases fail if
`arc ?? result` stops preferring the arc, which is now the single point.

`mouseGestures.test.ts` covers the two handlers that are pure guard —
`handleMouseDown`, which decides between this display's pan, the LGV's
shift+drag rubberband and the browser's own menu by DECLINING two of them, and
`handleMouseLeave`. Each of the five guards there was checked by deleting it;
each is caught by exactly one case. Note that its `cancelAnimationFrame` stub is
load-bearing rather than tidiness: stubbing only `requestAnimationFrame` leaves
the real cancel with no id of ours to cancel, the held callback runs anyway, and
the queued-hover case reads as the leave failing when the harness never let it.

`createTestAlignmentsDisplay` (`testUtils.ts`) is the harness both use — a real
display in a measured LGV, for the cases that have to run through the model's
own chain rather than through a hand-built argument.

**`isFlatArcShape` answers "does this draw as a bar", never "does this have an
insert size".** Both flat variants draw as a bar, and only `ARC_SHAPE_FLAT` —
the mate link — has a TLEN. `computeArcShape` gives `ARC_SHAPE_FLAT_SPLIT`
`spanBp = |p2Bp - p1Bp|`, which is exactly the arc's own span, so gating the
tooltip's insert-size row on the drawing predicate printed the Distance line
over again under a name a split read cannot carry. The two questions look like
one because the read cloud is the only mode either is asked in.
