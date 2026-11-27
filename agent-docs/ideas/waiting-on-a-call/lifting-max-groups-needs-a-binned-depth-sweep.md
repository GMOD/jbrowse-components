---
name: lifting-max-groups-needs-a-binned-depth-sweep
description: The group-by cap exists because each lane's depth sweep is sized to the region; coalescing the per-lane buffers saves nothing, and a binned sweep is what would turn the cap into a policy number.
---

# Lifting `MAX_GROUPS` needs a binned depth sweep

The cap and everything hanging off it (`capGroupKeys` and `OVERFLOW_GROUP_KEY`
in `packages/core/src/util/groupKeys.ts`, `groupKeyRank`'s three-way rank,
GroupByDialog's cardinality refusal, and the "keep every dimension a closed
set" rule) exist for one reason: each group runs the whole worker spine, and
its coverage pipeline allocates per-bp depth arrays sized to the region. Nobody
has asked for a higher cap yet.

- **Coalescing alone buys nothing.** `sweepDepths`
  (`packages/alignments-core/src/coverageCompute.ts`) allocates `numBins = end -
  start`, a Float32Array per lane, times three when `trackStrands` is on (the
  default with the band). One lane×bp buffer of 40 lanes is the same byte total,
  40 × 3 × 4 × regionWidth, or 48 MB over a 100 kb window: fewer allocations and
  one upload, not less memory.
- **The GPU half is solved.** The packed coverage buffer is downsampled to a
  fixed bin cap, so `coverageGpuBinCount` tracks screen pixels rather than
  region width, which is why chromosome-scale grouping does not overflow the
  device limit today.
- **The prerequisite** is a per-lane depth representation that is not
  region-width: the GPU buffer's downsampling applied to the sweep that the hit
  test and the stats read. Then the cap is a policy number instead of a memory
  ceiling; coalesce the buffers after, if the allocation count still shows up.
  `MAX_GROUPS` stays as a cardinality check on `tag`, the one dimension the data
  decides.
- **It also removes a split-lane case.** The cap runs per displayed region, so
  a value one region keeps as a lane can land in another region's overflow lane
  (`splitOverflowKeys` raises the corner notice); its reads then draw in both,
  and every cheaper fix (merging two `WorkerPileupData`s, a cross-region key set
  in `rpcProps`, a config-declared key universe) fails.
