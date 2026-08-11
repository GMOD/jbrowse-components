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
a color — and, because layout allocates a fresh `readYs` that the renderer keys
its upload memo on, it also loses the recolor fast path. Same trap for a value
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

## Two row caps, two affordances

A pileup can be clipped by its group's slice of the viewport or by the
display-wide `maxHeight`, and a different control raises each: the label chip's
expand (per-group override) versus the corner banner (`setMaxHeight`).
`groupClippedBy` is the single classifier, because offering the wrong one is a
button that does nothing — an expand banks an override OF `maxHeight`, so a lane
already clipped there gets the identical cap back while the override silences
the flag. Both surfaces that write `groupMaxHeightOverrides` (chip and drag
handle) gate on `canSizeGroupHeights`.

## Read height vs track height

**`fit` is the sole `heightMode` that also drives the read-height axis** — every
awkward special case follows from that, including that the fit cap uses the
Normal height rather than the configured one.

Naming trap: `getConf(self, 'featureHeight')` is the raw slot but the
`self.featureHeight` getter is the fit-squeezed value, so editors that mutate
the size must read `configuredFeatureHeight`. `fittedHeightPx` is a **pitch**,
`featureHeight` a **body**; the volatile bridging them breaks a MobX cycle, so
don't collapse it.

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
the two arrays being built in one ascending pass. Ambiguity there is only
reachable on the `placeRectCapped` overflow row, where every truncated chain is
piled onto the `maxRows` sentinel; that row is one row below the last drawn one,
and an ungrouped display puts no bottom bound on `findSectionAtY`, so a track
taller than its capped pileup reaches it.

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

Layout is main-thread because a read spanning a region boundary must share one
row, and each worker sees one region — plus three other properties that depend
on it, enumerated in
[ADR-053](../../../../agent-docs/architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md).
Read it before proposing the move; it is re-proposed roughly every time the
main-thread pack shows up in a trace, and it names the separable half that is
actually worth attacking. **Don't reintroduce a levels / right-edge-only array**
in `placeRect` — features arrive out of start order in both layouts, so it would
fragment layout.

On-screen and SVG export share `drawAlignmentBlocks`; don't reintroduce SVG-only
draw functions. Sashimi and linked-read bezier arcs are interactive SVG overlays
that each share one geometry source with the export — don't port them into
`drawAlignmentBlocks`. Sashimi's source is a model computed because the geometry
depends on pan/zoom but **not** `scrollTop`, and recomputing per scroll frame
re-projected every junction.

**Which sub-band a sashimi arc draws in is decided once**, in genomic bp, by
`sashimiDownKeysByGroup` (→ `features/sashimi/junctions.ts`), and read by both
the layout that reserves the strip and the geometry that fills it. Don't
re-derive it in screen space next to the arc math: the down sub-band renders at
`sashimiArcsHeight` whether or not the layout reserved it, so two passes that
disagree in the under-reserving direction paint arcs over the pileup. Junction
identity is `junctionKey` — refName included, because two chromosomes in view
share nothing but a bp number line.

`computeArcBand` is the single source of truth for the arc band and is decoupled
from `showCoverage` — don't reintroduce a `covH > 0` gate. Arc and sashimi
strips are reserved **per section**, so resize handles gate on the section,
never on `belowCoverageBands`. `coverageDisplayHeight` and the fit-height row
budget stay global on purpose: re-deriving them from `sections` routes the fit
volatile back through the layout it feeds.

Screen-x is not start/end-ordered — keep new sashimi geometry on the normalized
fields. In shaders use `bpToClipX`/`bpToLinear`, never
`hpClipX(hpSplitUint(…))`.
