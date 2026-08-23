---
status: Accepted
summary: "The per-gene isoform cap collapses in the worker's layoutSubfeatures and puts the expanded-gene set in the RPC cache key, reversing the main-thread design the parked canvas-glyph proposal argued for — the worker→main boundary carries no isoform structure to relayout over"
---

# ADR-075: The isoform cap runs in the worker

## Status

Accepted (2026-08). The mechanism is `collapseIsoforms` in
`plugins/canvas/src/RenderFeatureDataRPC/glyphs/subfeatures.ts` and
`effectiveMaxIsoforms` in `LinearBasicDisplay/model.ts`.

## Context

A parked proposal designed this feature before it was built and recommended the
opposite placement (`agent-docs/ideas/canvas-glyph-system.md`, since retired
into [REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md)): **"the cap belongs on the main
thread, not in `layoutSubfeatures`"**, with the worker emitting every isoform
carrying a rank and the main thread summing only the visible ones. Its objection
was the RPC cache key — `rpcProps()` invalidates on every field it carries, and
`baseModel.ts` had already had a list of slots removed from it for triggering
silent refetches, `height` among them. A per-gene expanded-set in the payload is
that same shape: every "+12 more" click clears and refetches every visible
region.

The objection is correct about the cost. It is wrong about the alternative being
available.

## Decision

**The collapse happens in `layoutSubfeatures`, and `expandedGeneIds` is an RPC
argument like `soloFeatureIds` and `hiddenFeatureIds`.**

Three things made the main-thread version unbuildable as designed:

- **No isoform structure survives the boundary.** The main thread receives flat
  parallel typed arrays — `rectPositions`/`rectYs`/`rectLabelRows` and their line
  and arrow twins — indexed to a *feature*, via `rectFeatureIndices`. The
  `FeatureLayout` tree, which is the only thing that knows which rects belong to
  which isoform, never crosses. Hiding one isoform would mean deleting its
  primitives out of the middle of those arrays and re-deriving every following
  child's `y` **and** its `labelRowsAbove` (a running count, so it shifts for
  every sibling below). That is the layout pass again, on the wrong side, over
  the packed form.

- **The rank the design would emit is not enough.** The height cap is not a
  count. It charges each child what it *measures*, because two shapes a count
  cannot describe take real rows out of the lane: decorations the cap keeps (an
  NCBI source record, a `biological_region`) and an isoform taller than a row (a
  polyprotein CDS draws one per cleavage product). `isoformsWithinBudget` needs
  every child's laid-out height, which is worker-side data.

- **The payload is the other half of the point.** Collapsing in the worker means
  a 40-transcript Gencode gene ships one transcript's geometry, not forty.

## The first two reasons no longer hold, and the third was never measured

Amended 2026-08-23, after the cap was found to be stripping every label on a
fitted track (see the lane-division consequence below). Re-reading the three
reasons above against the code as it stands:

- **Isoform structure DOES survive the boundary.** `subfeatureInfos` crosses
  carrying `featureId`, `parentFeatureId`, `type`, `startBp`/`endBp`, `topPx`,
  `bottomPx`, `labelRowsAbove` and `ownsLabelRow` for every transcript
  (`registerSubfeature` in `collect/glyphEmitters.ts`). So per-isoform identity
  and geometry are already main-thread — and so is each child's measured height,
  as `bottomPx - topPx`, which is what the second reason said only the worker
  had. Undoing a member of `labelRowsAbove` is a constant subtraction per
  following sibling, not "the layout pass again": the worker derives it as a
  linear running sum.
- **What is actually missing is primitive attribution.** `rectFeatureIndices`
  (and its line and arrow twins, and `aminoAcidOverlay[].flatbushIdx`) index a
  primitive to a FEATURE, never to a subfeature, so nothing says which rects
  belong to which isoform. A second gap: `parentFeatureId` is the ROOT feature
  at every nesting depth by design (`collect/glyphEmitters.ts` aliases the
  placement's `parentFeature` to `rootFeature` and registers a polyprotein's
  cleavage products against it), so those products are siblings of the CDS they
  came from and "the direct children of gene X" is not recoverable by
  grouping. Both are fixed by one
  mechanism — a stack-child ordinal threaded through `GlyphPlacement`.
- **And the drawn order is not the ranked order.** `keepRanked` keeps the top n
  of `rankIsoforms` (canonical tag, coding, coding length, index) while the
  stack is sorted only by (canonical, coding). So a main-thread trim to a
  smaller n is not "drop a suffix" — it needs a per-isoform rank emitted, or it
  keeps a different set than the worker would at the same cap.
- **The payload reason was never measured, and it is small.** It is the argument
  that carried the cap across the boundary, and so the reason track height is an
  RPC cache key at all:

<!-- BEGIN GENERATED MEASUREMENT isoform-cap-payload -->

| track height | isoform cap |  payload | saved vs uncapped | saved |
| ------------ | ----------: | -------: | ----------------: | ----: |
| uncapped     |           0 | 180.4 KB |            0.0 KB |  0.0% |
| ~400px lane  |          31 | 172.1 KB |            8.3 KB |  4.6% |
| ~200px lane  |          14 | 145.5 KB |           35.0 KB | 19.4% |
| ~100px lane  |           6 | 114.2 KB |           66.2 KB | 36.7% |
| ~20px lane   |           1 |  55.5 KB |          124.9 KB | 69.2% |

<!-- END GENERATED MEASUREMENT isoform-cap-payload -->

  At the track heights people actually use the cap removes a minority of the
  payload, roughly half of which was crossing zero-copy as a transferable
  anyway. It matters at a ~100px lane and below, which is the case it was built
  for; it does not pay for a resize invalidating every loaded region.

**So the honest version of this ADR's argument is a cost argument, not an
impossibility one**: the primitives carry no isoform attribution, the flat
subfeature list conflates nesting depth, and four secondary systems (`isoformPicks`
and the chip, the `moreIsoforms` badge, the gene's collapsed re-anchoring in
`processFeatureRecord`, and rank order) are all keyed to the collapse firing
worker-side. Moving the trim to the main thread is estimated at 800-1500 lines
with real silent-corruption surface — every trimmed isoform shifts ~30 parallel
fields and a miss mis-draws a row without throwing.

That cost still wins today, because what it buys is a bounded annoyance rather
than a correctness bug: `clearAllRpcData` deliberately keeps `rpcDataMap` and
`scrollTop`, so the track stays painted through the refetch window and nothing
blanks. **Supersede this ADR rather than amend it again** the moment something
else needs per-isoform structure on the main thread — instant per-gene
expand/collapse without a refetch, per-isoform hover trimming, isoform
reordering, a "pick this transcript" affordance. Each needs the same stack-child
index and the same trim mechanics, and the height-out-of-the-cache-key win rides
along at marginal cost.

## Consequences

- **Expanding one gene refetches its regions.** Accepted, on the same basis as
  solo/hidden: a click the user made, on data already in the adapter's cache.
- **`maxIsoforms` is in the cache key, so track height is too.** Contained by
  making the budget an integer ROW COUNT off a debounced height:
  `coarseTrackHeight` settles for `HEIGHT_SETTLE_MS` (300ms), and a drag that
  does not cross a row boundary leaves the count where it was, so the resize
  handle does not re-run the pipeline per frame. `fetchAutorun.test.ts` pins
  both halves — a height change within a row budget does not refetch, one that
  buys a row does.
- **The cap is `undefined` outside `auto` + `all` + non-`grow`.** Under
  `longestCoding` the worker ignores it, and under `grow` the track's height is
  its own content's, so reading a cap off it would put a fetch-derived value in
  `rpcProps()`. Either way the height stops being a cache key at all.
- **The lane is divided in the worker, not sized on the main thread.**
  `isoformRowBudget` answers for a lane holding one gene, which is the only lane
  the display can see before the fetch — so a second gene stacking with the
  first took the same whole-track budget and the pair overflowed by ~2x at
  EVERY height. Scale-invariant, so dragging a fitted track taller bought
  isoforms and never the label rows the fit ladder needs, and the names went
  (`bodies`). The division (`laneShares` / `laneBudgetRows`) happens where the
  neighbours are visible, on the same argument this ADR makes for the cap
  itself. `maxIsoforms` stays a pure function of the debounced height, so the
  cache key and the loop story above are untouched. It travels with
  `geneOwnRows` — what a gene's own padding and label lines cost in those same
  row units — because the lane owes that once per gene and only the display can
  price it.
- **The budget is a mirror, and mirrors drift.** The display solves
  `decideLabelReservations`' row arithmetic for n (`geneRowCostPx` /
  `isoformRowBudget`); `isoformBudget.test.ts` pins the two against the packer
  directly, because a mirror that drifts admits an isoform past the lane the cap
  exists to fit.
- **The staged rollout in the ideas doc was skipped.** It proposed shipping the
  cap as a fourth mode on the `GeneGlyphControl` chip first, on the grounds that
  a per-gene affordance on a canvas track is the expensive part. It is: the badge
  is a DOM label with its own hit target, width reservation and click routing
  (`moreIsoformsLabel`). It shipped anyway, because a track-wide chip cannot
  answer the question the cap raises, which is per gene — how many isoforms is
  *this* gene missing.
