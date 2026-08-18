---
status: Accepted
summary: "The per-gene isoform cap collapses in the worker's layoutSubfeatures and puts the expanded-gene set in the RPC cache key, reversing the main-thread design ideas/canvas-glyph-system.md argued for — the worker→main boundary carries no isoform structure to relayout over"
---

# ADR-075: The isoform cap runs in the worker

## Status

Accepted (2026-08). The mechanism is `collapseIsoforms` in
`plugins/canvas/src/RenderFeatureDataRPC/glyphs/subfeatures.ts` and
`effectiveMaxIsoforms` in `LinearBasicDisplay/model.ts`.

## Context

`agent-docs/ideas/canvas-glyph-system.md` designed this feature before it was
built and recommended the opposite placement: **"the cap belongs on the main
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
