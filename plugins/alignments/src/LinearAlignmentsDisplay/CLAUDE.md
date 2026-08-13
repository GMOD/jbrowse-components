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
was a `warning`-toned corner chip whose press set `maxHeight` to 1,000,000. On
deep data (300x short reads) the 6000px default is reached at essentially every
locus, so the alert tone was permanently lit — furniture, not a disclosure — and
one press on an always-present control silently committed the track, via a
config slot, to laying out every read everywhere. A notice drawn at the boundary
it describes is met by scrolling to the end of the reads, which is exactly when
"there were more" is worth knowing.

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

**A support FLOOR is offered for the ticks and deliberately not for the arcs.**
`minInterchromSupport` counts reads over a window of one fragment length on
_both_ sides (`clusteredInterchromSupport`), never at a coordinate: mates
straddle a breakpoint rather than landing on it, so `arcKey`'s exact count is 1
for essentially every interchromosomal connection and a floor over it would
delete a real translocation as thoroughly as the mismapping. The window comes
from `stats.upper`, so it tracks the library instead of a constant. The same
floor on same-chromosome arcs was measured and declined — at depth it is a
density filter, not an evidence filter. Both results are in
`agent-docs/reference/DEEP_COVERAGE.md`.

**Both families carry `support` and both spend it the same way.** An arc and a
tick are each ONE junction that `resolveArcs` coalesced, and `arcLineWidth` is
the one curve turning that count into ink for Canvas2D, the SVG export and both
GPU passes (resolved CPU-side at pack time; no shader evaluates it). Coalescing
without keeping the count left a 40-read translocation drawing exactly like one
mismapped pair.

**Ask `hasArcBandInk`, not `numArcs`.** A lane whose only interchromosomal
partner is off-region carries ticks and no arcs, so an arc-count gate reserves
the band, paints it, and then treats it as empty. The one deliberate exception
is `resolveArcBandDebug`, which answers "why is this arc this shape" and so has
nothing to say about a tick.

The endpoint squares have no hit test of their own, covered by the bar's
tolerance because `ARC_MARKER_PX / 2 <= ARC_HIT_SLOP_PX`. That is arithmetic,
not design, so `hitTest.test.ts` pins it.
