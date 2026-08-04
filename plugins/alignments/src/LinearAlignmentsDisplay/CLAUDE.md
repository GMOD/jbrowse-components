# LinearAlignmentsDisplay

## Settings: storage + invalidation tiers

Track-menu display options are **config slots** (they survive hide/retick and
take a declarative default). Plain MST props / volatiles are for transient state
only — hover, selection, scroll.

Which getter reads a setting decides what it invalidates: `rpcProps()`
refetches, `laidOutPileupMap` relayouts, `arcsByGroup` rebuilds arcs,
`renderState` repaints. Tiers 2-4 are auto-wired by MobX; **tier 1 is manual**,
because the worker boundary defeats MobX tracking.

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

`hiddenGroupKeys` must be filtered out of the **cross-group** derivations too
(coverage stats, legend, sashimi, arcs) or a hidden lane sizes the axis the
visible ones share — for arcs, before `poolArcScale`.

`collapseGroupRows` puts depth in the overlap tint, so the collapsed path must
**not** run `mergeSpans`.

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
row, and each worker sees one region. **Don't reintroduce a levels /
right-edge-only array** in `placeRect` — features arrive out of start order in
both layouts, so it would fragment layout.

On-screen and SVG export share `drawAlignmentBlocks`; don't reintroduce SVG-only
draw functions. Sashimi and linked-read bezier arcs are interactive SVG overlays
that each share one geometry source with the export — don't port them into
`drawAlignmentBlocks`. Sashimi's source is a model computed because the math
depends on pan/zoom but **not** `scrollTop`, and recomputing per scroll frame
re-ran an O(n²) side assignment.

`computeArcBand` is the single source of truth for the arc band and is decoupled
from `showCoverage` — don't reintroduce a `covH > 0` gate. Arc and sashimi
strips are reserved **per section**, so resize handles gate on the section,
never on `belowCoverageBands`. `coverageDisplayHeight` and the fit-height row
budget stay global on purpose: re-deriving them from `sections` routes the fit
volatile back through the layout it feeds.

Screen-x is not start/end-ordered — keep new sashimi geometry on the normalized
fields. In shaders use `bpToClipX`/`bpToLinear`, never
`hpClipX(hpSplitUint(…))`.
