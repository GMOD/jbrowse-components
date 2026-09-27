---
name: one-pileup-layout-for-one-region-and-many
description: computePileupRowLayout sends one region to computeLayout or computeSortedLayout and several to computeMultiRegionLayout, two packers for one rule. With one entry the multi-region path computes the same extents, order, sort gate and first fit, so the one-region branch could become a call to it, once rows match row for row and the Map-keyed extent measures free against the typed-array path.
---

# One pileup layout for one region and many

`computePileupRowLayout` in
`plugins/alignments/src/RenderAlignmentDataRPC/sortLayout.ts` branches on the
number of regions holding reads: one goes to `computeSortedLayout` or
`computeLayout`, more than one to `computeMultiRegionLayout`, which unions each
read's extent across regions on a per-refName placement axis
([ADR-053](../../architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md),
[ADR-118](../../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md)).

Handed one entry, the multi-region path computes the same union extents,
canonical order, sort gate and first fit, so the one-region branch becomes a
call to it and the two packers become one.

Before cutting the branch:

- rows match row for row on one region, including `padding: 2`, which ADR-118
  pins on `computeLayout`;
- the Map-keyed extent costs nothing measurable against the typed-array path
  on a deep region.
