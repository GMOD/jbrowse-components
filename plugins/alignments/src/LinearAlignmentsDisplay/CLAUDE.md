# LinearAlignmentsDisplay

## Layout architecture

Both pileup and chain (linked-read) layout are computed on the **main thread**,
not in the RPC worker. This mirrors the wiggle autoscale design and is required
because consistent Y-row assignment across multiple `displayedRegions` is
impossible in per-region RPC workers — each worker sees only one region at a
time, so mates that span region boundaries cannot be placed on the same row.
Moving all layout to the main thread (where all region results are available
simultaneously) solves this without requiring the RPC to process multiple
regions in a single call, which would be far more complex and wasteful.

### Pileup layout (`sortLayout.ts`)
- `computeLayout` / `computeSortedLayout` — single-region
- `computeMultiRegionLayout` — multi-region, rowMap keyed by feature ID
- Called by `computeAndAssignLayoutForData` in `model.ts`
- `fillYArraysFromLayout` / `fillYArraysFromLayoutMap` apply the result

### Chain layout (`computeChainLayout.ts`)
- `computeChainLayout` — single-region, groups by chain name
- `computeMultiRegionChainLayout` — multi-region, rowMap keyed by chain NAME
  (mates share QNAME, so name-keyed dedup handles cross-region pairs)
- `readYsFromRowMap` — converts a name-keyed rowMap to a per-read Uint16Array
- `buildChainConnectingData` — post-layout: builds connecting lines + Flatbush
- Called by `computeAndAssignChainLayout` in `model.ts`

**Why GranularRectLayout, not the greedy levels array from sortLayout.ts:**
Chain layout sorts by *distance* (insert size), not by start position. The
simple greedy levels array tracks only the right edge of each row, so it only
admits a new chain when its start ≥ that edge. When chains are processed in
distance order (not start order), an early chain can occupy a slot in the
middle of a row, leaving a gap at the front that a later chain could fill —
but the levels array misses this. GranularRectLayout uses a 2D occupancy
bitmap and can fill those gaps regardless of processing order, producing denser
layouts when chains are sorted by distance. Do not replace it with a levels
array for chain layout.

### Worker contract
The RPC worker (`executeRenderChainData.ts`) returns chain *metadata* arrays
(`chainAbsMinStarts`, `chainAbsMaxEnds`, `chainDistances`, `chainNames`,
`chainColorTypes`, `chainSuppTypes`, `chainHasMultiple`, `chainFirstReadIndices`)
and all read/gap/mismatch Y arrays initialised to 0. The main thread fills in
real Y values and builds derived data (connecting lines, Flatbush).
