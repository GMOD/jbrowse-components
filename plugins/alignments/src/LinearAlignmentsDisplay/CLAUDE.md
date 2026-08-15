# LinearAlignmentsDisplay

## Settings: storage + invalidation tiers

Track-menu display options are **config slots** (they survive hide/retick and
take a declarative default). MST props / volatiles are for transient state only
— hover, selection, scroll.

Which getter reads a setting decides what it invalidates: `rpcProps()`
refetches, `groupLayoutContext` relayouts, `readColorContext` rebakes read
colors, `arcsByGroup` rebuilds arcs, `renderState` repaints. Tiers 2-5 are
auto-wired by MobX; **tier 1 is manual**, because the worker boundary defeats
MobX tracking.

- **Never put a fetch-result derivative in `rpcProps()`** — infinite loop.
  `colorTagMap` is the canonical trap.
- **A color input in `groupLayoutContext` costs a full relayout** and loses the
  recolor fast path, since layout allocates a fresh `readYs` the renderer keys
  its upload memo on. A value the layout only _sometimes_ spends goes in as a
  thunk.
- **Tier 4 repaints the whole canvas**, so per-mousemove state must not be
  there. The hover highlight is a React overlay; selection stays in
  `renderState` (rare, and belongs in SVG export).

## A split segment's colour is framed by the chains on screen, not by its primary

`readChainHasSupp`'s 1/2 is a chain-level **frame**. The worker's answer is a
starting point overwritten twice on the main thread: by
`reconcileChainSuppAcrossRegions` (one molecule across regions — a worker call
sees one region) and then `consensusChainStrandFrames` (molecules about each
other — a worker call sees one chain).

The second exists because the worker frames on `primaryStrand`, and **on a
foldback the primary flag is arbitrary**. Alternatives measured 58/52/61%
agreement where the consensus reaches 100%. Two properties of the pass are
load-bearing:

- **Votes are purity-normalized, not length-weighted**, or one long arm — which
  is also the primary — outvotes everything and the pass flips nothing.
- **A chain seen at ONE locus is frozen**, since there its frame and its mapping
  strand are the same statement; re-framing it deletes the lone inverted
  supplementary at a breakpoint that this colouring exists to show. Frozen
  chains still vote.

The global sign is anchored separately (keep the majority on the frame they
arrived with) because negating every frame is equally optimal, and without it
the pileup swaps red for blue between renders of identical data.

Panning can change a frame, and that is accepted: it can only fall back to the
primary's answer, which is where the display already was before the pass
existed.

**Don't re-derive a frame at a call site** — read `readChainHasSupp`.
`framesUnpairedChainStrand` is the single statement of when framing is live.

## Three different "is it grouped?" questions

`isGrouped` (>1 section) is the scroll model. `showsGroupLabels` is the chips,
and is what anything dodging them must ask — one section still draws a chip
while `scalebarOverlapLeft` is 0. `rpcDataMap.size === 0` is whether data
arrived; never gate first paint on a laid-out map, since a grouped fetch over an
empty region partitions to zero groups and the overlay never clears.

`hiddenGroupKeys` must be filtered out of the **cross-group** derivations too
(coverage stats, legend, sashimi, arcs) — for arcs, before `poolArcScale`.

`collapseGroupRows` puts depth in the overlap tint, so the collapsed path must
**not** run `mergeSpans`.

## Two row caps, and only one of them is an affordance

`groupClippedBy` classifies a clip as `'budget'` (the group's slice of the
viewport) or `'ceiling'` (display-wide `maxHeight`). Only `'budget'` offers the
chip's expand; an expand banks an override OF `maxHeight`, so offering it for a
ceiling clip hands back the identical cap while silencing the flag. `'ceiling'`
draws `PileupTruncationRule` and is raised from the track menu.

That notice is deliberately inert and deliberately not an alert: as a chip its
press set `maxHeight` to 1,000,000, and reads collapsing onto the bottom row is
the cap working, not a fault.

## Read height vs track height

**`fit` is the sole `heightMode` that also drives the read-height axis**; every
special case follows, including that the fit cap uses the Normal height.

`self.featureHeight` is the **fit-squeezed** value — editors that mutate the
size read `configuredFeatureHeight` (`resolveConf`, since the slot is
promotable). `fittedHeightPx` is a **pitch**, `featureHeight` a **body**; the
volatile bridging them breaks a MobX cycle, so don't collapse it.

Grow mode is `HeightModeMixin`'s in full; the scroll clamp is
`TrackHeightMixin`'s.

## Hit-testing: every draw gate needs a matching hit gate

The settings gating `PILEUP_LAYERS` are repaint-tier — the arrays are fetched
either way — so a layer switched off keeps its marks hoverable over blank pixels
unless `performHitTest` gates too. `HIT_GATES` (`hitTestGateParity.test.ts`) is
exhaustive over `PileupLayerId`, so a new layer is a compile error until it
states one of four stories: gated on a named `HitTestOptions` flag, empty of
data when its setting is off, unconditionally drawn, or a decoration
`hitTestFeature` already answers for.

The converse gap is a layer with no hit test. `readPositions` carries the read's
TRUE aligned extent, so `hitTestFeature` misses what `drawSoftclipBases` paints
past the alignment end — and a miss clears the selection and falls through to
the **browser's** context menu.

Neither index-backed test may take `hits[0]`: `Flatbush.search` returns Hilbert
order, so that is the leftmost candidate, not the one under the cursor.
`hitTestModification` picks by **distance**; `hitTestChain` boxes whole extents
so everything is at distance 0 and it picks the **highest chain index**,
matching `hitTestFeature`'s "last drawn wins".

## Context menu: build items from the id, not the feature

`contextMenuFeature` arrives a round trip after the click. Gate items on
`contextMenuFeatureId`; items needing the read's own fields are pushed **after**
the id-built ones, so arriving late appends rather than shifting what is under
the cursor. Use `withContextMenuFeature` — reading `contextMenuFeature` live
inside an `onClick` gets nothing, `closeContextMenu` ran first.

## Layout and draw paths

Chain layout is handed **neither `sortedBy` nor `largeFeaturesFirst`** — its
rows are chains. Every ordering/row control curates itself out in chain mode; a
new one that doesn't is a silent no-op, and a tag sort additionally refetches.

Layout is main-thread —
[ADR-053](../../../../agent-docs/architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md)
before proposing the move. `placeRect` cannot use a levels / right-edge-only
array: features arrive out of start order in both layouts.

On-screen and SVG export share `drawAlignmentBlocks`. Sashimi and linked-read
bezier arcs stay interactive SVG overlays, each sharing one geometry source with
the export; sashimi's source is a model because the geometry depends on pan/zoom
but **not** `scrollTop`.

**No GPU pass can join two displayed regions** — one buffer per region, clipped
to its own bp range. `bezierArcScope` is the one place that decides between
`all`, `crossRegion` and `none`; read the getter, never `showBezierConnections`,
or the live overlay, SVG export and legend disagree.

A cross-region arc was never clipped away — each block projects bp through its
OWN range, so the far foot is extrapolated as though the bp at the seam did not
exist. `CrossRegionArcsOverlay` draws the globally-correct curve once in view
space, and three things about it matter: its geometry is `arcMark`'s through
`arcMarkFrom` rather than a lookalike traced beside it, it is a separate z-layer
so it paints above every canvas arc regardless of `arcPaintRank`, and its hover
writes `setHoverState` rather than a local hovered-key (two hover mechanisms in
one band show a hover twice).

**Which sub-band a sashimi arc draws in is decided once**, in genomic bp, by
`sashimiDownKeysByGroup`, and read by both the layout that reserves the strip
and the geometry that fills it — the down sub-band renders whether or not the
layout reserved it, so two passes that disagree paint over the pileup. Junction
identity is `junctionKey`, refName included.

**A band's height MINUS its reserved margin is floored at 0** where the
expression is declared, not per consumer — `clampBandHeight` holds the drag
handle and not the slot, so the subtraction goes negative. If a shader computes
it too, the declaration is the `.slang` one and the CPU side imports the
generated twin (adr-051).

`computeArcBand` is the single source of truth for the arc band and is decoupled
from `showCoverage`, so no `covH > 0` gate. Arc and sashimi strips are reserved
**per section**, so resize handles gate on the section. `coverageDisplayHeight`
and the fit-height row budget stay global: re-deriving them from `sections`
routes the fit volatile back through the layout it feeds.

Screen-x is not start/end-ordered — keep new sashimi geometry on the normalized
fields. In shaders use `bpToClipX`/`bpToLinear`, never
`hpClipX(hpSplitUint(…))`.

## The arc band draws two families, and answers for both

Curved/flat arcs and interchromosomal connector ticks (`arcLine`) share one
rect, one Y scale and one palette. `hitTestArcBand` is the single entry point,
because which one a hover resolves to is a question about **paint order**: both
renderers run the line pass first, so an arc is always the later ink. The rule
is two-tier — on-ink beats near-ink, the arc wins among on-ink — because "arc
always" would make a tick unhoverable wherever an arc crosses it.

**Which family an interchromosomal connection joins is decided per connection,
by whether both feet are in displayed regions.** A tick claims "there is a
connection to somewhere you cannot see", which is false when the far end is on
screen. Three things ride on it:

- **Arc mode only.** The read cloud's Y axis IS insert size; an interchromosomal
  pair carries TLEN 0, so the endpoint gap becomes a real `maxFlatArcSpanBp` and
  `insertSizeTickSections` prints it — one connection rescales the cloud to a
  107 Mb "insert size".
- **`drawInter` and `minInterchromSupport` gate both marks**, from one hoisted
  condition, or the arc branch inherits neither.
- **The hover needs two refNames** (`endRefName`); `formatArcTooltip`'s
  `min`/`max` range is a locstring naming one chromosome with a coordinate from
  the other.

**Paint order is an interest ranking, not a data order**, stated in `ARC_PASSES`
(ticks under arcs — mismapped pairs otherwise put a full-height opaque vertical
through the arcs carrying insert size) and in `resolveArcs`' sort
(`arcPaintRank` first, `support` second, dedup key last — support-ascending
alone let grey punch through). `hitTestArcBand` reads that order rather than
re-deriving it: the on-ink winner is the **last candidate considered**.

**"Concordant" has one definition and two settings spend it.**
`isConcordantPairRead` is the aligner's verdict, called by both the worker's
read filter and the arc filter (`concordantPairParity.test.ts` holds them
together). The arc filter adds one condition: the arc must also paint the
**baseline colour slot**, because nothing coloured may be hidden as routine. Not
to be confused with the read cloud's `isConcordantFRPair`, which asks about the
modal |TLEN| band.

**A support FLOOR is offered for the interchromosomal family and deliberately
not for same-chromosome arcs**, where it is a density filter rather than an
evidence filter (`agent-docs/reference/DEEP_COVERAGE.md`).
`minInterchromSupport` counts over a window of one fragment length on _both_
sides, never at a coordinate: mates straddle a breakpoint, so an exact count is
1 for essentially every connection.

**A tick is DASHED, and that is what separates it from an arc's foot** — the two
land on the same x whenever a breakpoint reaches one visible acceptor and one
invisible, in the same colour at the same height. Support cannot do this job:
`arcLineWidth` caps at 4x around 44 reads. The pattern is declared in
`arcLine.slang` and imported CPU-side (adr-051), deliberately not arcFlat's
`[3, 3]`, since read-cloud mode shows both at once.

`partnerOffView` prints "Outside the displayed regions", which is safe
unconditionally in arc mode and **false in read cloud** — so the caller reads
`readConnections` rather than assuming.

**Ask `hasArcBandInk`, not `numArcs`** — a lane with only off-region partners
carries ticks and no arcs. **A question asked ACROSS lanes is answered by
`computeArcsByGroup`**, not a walk of `arcsByGroup`, and after regionization: an
arc reaching no displayed region is dropped, so a swatch keyed off the earlier
set names a colour nothing draws.

The endpoint squares have no hit test of their own, covered by the bar's
tolerance because `ARC_MARKER_PX / 2 <= ARC_HIT_SLOP_PX` — arithmetic, so
`hitTest.test.ts` pins it.

## Breakend feet

**An interchromosomal arc draws breakend feet, and no other arc does** — a tick
at each foot lying over the ARM that foot's junction keeps (outward =
deletion-type, inward = duplication-type, parallel = inversion).

- **It is the family whose colour channel is spent** on `ARC_COLOR_INTERCHROM`,
  so orientation has nowhere else to go. Same-chromosome splits keep it via
  `unpairedOrientationColor`. Widening feet to the pair arcs was measured down:
  orientation there IS the colour, and every foot lands on the baseline (~556
  marks five pixels apart — a rule under the band, not directions).
- **Interchromosomal is the one family that is ALWAYS cross-region**, so drawing
  the feet in `CrossRegionArcsOverlay` covers all of it. Feet on same-chromosome
  cross-region arcs would flicker as a reader panned across a seam.
- **The direction is a property of the JUNCTION, not the read**, which makes it
  safe on a coalesced arc (`readTrailingBodyDir`). A `ComputedLine` carries
  none, since a tick coalesces on one coordinate.
- **THE ARM, not "this foot's own aligned body", and the two producers differ on
  exactly that.** A split junction's endpoint IS the junction, so
  `connectionEndpointBps` hands `dir1`/`dir2` through. A mate link's endpoint is
  the FRAGMENT's outer edge with the body pointing back at it, so `pairOuterDir`
  NEGATES the read's direction. Mirroring the ternaries instead made an FR pair
  spell "duplication" while a split read over the same junction spelled
  deletion. `arcBreakendFeet.test.ts` holds the two families against each other.

The feet live in the **mark** (`ArcFeet`), not the overlay's path string, so the
hover highlight draws them too. Their sign is deliberately opposite to
`tangentSign` (`core/util/bezierConnector.ts`), which is the direction a
per-read connector LEAVES the same endpoint in. Don't "fix" either to match the
other.

Two feet closer than `ARC_FOOT_PX` merge into one bar — the mark working, since
they overlap because both ends keep the same stretch. Unfinished, in
`agent-docs/TODO.md`: bounding a foot by its displayed region, and feet on the
ticks.

## An arc outranks the band it is painted over, as a RESULT VARIANT

`runHitTest` returns `arc ?? result`, so `ArcMarkHit` is a member of
`MarkHitResult` — one place where the ranking is stated. As an `if` in each
gesture one of them forgot, and in up mode the arc band's `top: 0` IS the
coverage band, so a right-click built the interbase menu for the column
underneath.

As a variant each gesture is right by default: `hoverStateForResult` **does not
compile** without `case 'arc'` (TS2366, the only enforcement — the rest are
structural), `handleClick`'s switch matches no pileup case, and
`contextMenuFieldsForHit` answers `show: false` from its `default` so an arc
falls through to the browser's menu with no `preventDefault`.

`arcGestureGuard.test.ts` works the one pixel where an arc's ink lies over an
interbase bar, finding it by asking the hover rather than projecting the dome,
and states every case against the SAME pixel with `readConnections` off.
`mouseGestures.test.ts` covers the two pure-guard handlers; its
`cancelAnimationFrame` stub is load-bearing, since stubbing only
`requestAnimationFrame` lets the held callback run anyway.
`createTestAlignmentsDisplay` (`testUtils.ts`) is the harness both use.

**`isFlatArcShape` answers "does this draw as a bar", never "does this have an
insert size".** Only `ARC_SHAPE_FLAT` — the mate link — has a TLEN;
`ARC_SHAPE_FLAT_SPLIT`'s `spanBp` is the arc's own span, so gating the tooltip's
insert-size row on the drawing predicate reprints Distance under a name a split
read cannot carry.
