---
name: multi-region-pileup-layout-packs-through-the-one-region-packer
description: `computeMultiRegionLayout` packs deduplicated reads through Maps and a row scan; deduplicating into typed arrays and calling the one-region packer gives collapsed-intron views the heap path and one soft-clip tiebreak.
---

# Multi-region pileup layout packs through the one-region packer

`plugins/alignments/src/RenderAlignmentDataRPC/sortLayout.ts` holds two packers.
`computeLayout` and `computeSortedLayout` place one region's reads from typed
arrays, with `partitionStartSorted` as the heap path on a deep region.
`computeMultiRegionLayout` unions each read's extent across regions into a
`Map<ReadKey, ReadExtent>`, sorts the keys, and places every read with
`placeRectCapped`
([ADR-053](../../architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md)).

Handed the same single region, the multi-region packer measured 4x to 22x slower
than `computeLayout` from 20,000 reads up (one laptop run under jest), the
widest gap on the deepest pile. A collapsed-intron view over deep RNA-seq takes
that path on every layout.

## The change

- `computeMultiRegionLayout` deduplicates into index-space arrays: unioned
  starts and ends after `refNameAxisShift`, keys, lift tiers, and each region's
  read-to-index map.
- One packer takes those arrays and a placement order, with the heap path when
  the order is start-monotone. `computeLayout`, `computeSortedLayout` and the
  multi-region path each build their arrays and order, then call it.
- The placement orders (canonical, soft-clip, lifted-first, largest-first,
  ranked-then-rest) are written once over extents.

## Rows that change

The two packers disagree today wherever soft clips are shown, so one of them
moves:

- `buildSoftclipOrder`, `buildLiftedFirstOrder` and `computeSortedLayout`'s
  gap-filling reads break ties on the raw span; the multi-region path breaks
  them on the soft-clip-expanded extent. Take the expanded extent, the interval
  the packer places.
- The one-region branch applies a sort whose position its region does not hold,
  and with no `regions` passed; the multi-region path drops it
  (`appliedPileupSort` spells out the exception). Keep that as the caller's
  rule in `computePileupRowLayout`, outside the packer.

## Before landing

- A fuzz test holds the multi-region path on one entry to `computeLayout` row
  for row, soft clips and every `LayoutOrder` included.
- A bench on a deep multi-region fixture shows the heap path's gain, and
  `layoutVsPileupStep.bench.ts` shows the one-region path unmoved.
