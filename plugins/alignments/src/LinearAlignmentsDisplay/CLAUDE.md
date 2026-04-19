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

**Shared layout primitive:** Both pileup (`sortLayout.ts`) and chain
(`computeChainLayout.ts`) call `placeRect(rows, start, end)` from
`sortLayout.ts`. Each row is a sorted `[s1,e1,s2,e2,...]` flat list; placement
is first-fit with gap-filling. This is essential for chain layout (sorted by
distance, not start) and for pileup sort-by-base/strand/etc. (overlapping reads
placed in sort order, non-overlap reads fill remaining gaps) — in both cases
features arrive out of start order, so a right-edge-only levels array would
fragment layout. Start-sorted input hits an O(1) per-row fast-path, matching
end-array performance in the common case. Do not reintroduce a levels array
for either layout.

### Worker contract

The RPC worker (`executeRenderChainData.ts`) returns chain _metadata_ arrays
(`chainAbsMinStarts`, `chainAbsMaxEnds`, `chainDistances`, `chainNames`,
`chainColorTypes`, `chainSuppTypes`, `chainHasMultiple`,
`chainFirstReadIndices`) and all read/gap/mismatch Y arrays initialised to 0.
The main thread fills in real Y values and builds derived data (connecting
lines, Flatbush).
