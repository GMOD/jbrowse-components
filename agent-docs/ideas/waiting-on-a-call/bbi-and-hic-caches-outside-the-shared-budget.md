---
name: bbi-and-hic-caches-outside-the-shared-budget
description: Two parser caches sit outside `decompressedBytesBudget` and have no idle timeout. `@gmod/bbi`'s R-tree node cache is capped at 1000 entries per zoom level per file, measured at about 12 MB at worst for a phyloP-sized bigWig and 0.3 MB for an ENCODE track. `@gmod/hic`'s block cache holds up to 128 MB per file. Each fix is upstream (weigh in bytes, take a `budget`, idle out); the call is whether a MultiWiggle of base-resolution genome-wide files is a configuration worth bounding.
---

# bbi and hic caches outside the shared budget

Every tabix, BAM and CRAM cache joins `decompressedBytesBudget`
(`packages/core/src/util/cacheBudgets.ts`) and idles out after three minutes.
Two parsers' caches do neither, and neither library takes a budget, so
`BigWigAdapter`, `BigBedAdapter` and `HicAdapter` cannot pass one.

## bbi: the R-tree node cache

`BlockView.rTreeNodeCache` in `@gmod/bbi` 12 is a `SharedReadCache` with
`maxSize: 1000` at the default weight of one per entry, one per zoom level per
file, held for the track's life by `dataAdapterCache`.

Measured on 2026-10-30 in Node, walking only the R-tree
(`getRegionByteSize`) under seeded random browsing:

| file | queries | retained |
| --- | ---: | ---: |
| hg38.phyloP100way.bw (9.9 GB), browse | 3200 | 4.4 MB, still climbing |
| the same, 10 kb jumps to the cap | 2000 | 8.4 MB, flat |
| ENCODE bigWig (51 MB), browse | 3200 | 0.3 MB, its whole index |

Duplicate coverage across keys was 1.5–7%, so re-keying while panning is not the
cost. A phyloP-sized file tops out near 12 MB across its zoom levels. It adds up
only in a MultiWiggle, which queries every subtrack on every pan: about 240 MB
for 20 phyloP-sized subtracks and 1.2 GB for 100.

The fix in bbi is `sizeOf: buf => buf.byteLength`, an `idleTimeoutMs`, and an
optional `budget` through the `BigWig` constructor for `BigWigAdapter` to hand
`decompressedBytesBudget`.

## hic: the block cache

`HicFile.blockCache` in `@gmod/hic` 2.2 is weighed in bytes up to
`blockCacheMaxBytes` (128 MB default), with no idle timeout and no budget.
`HicAdapter` passes neither. Hi-C tracks are usually few, so it has not been
measured; the fix has the same shape as bbi's.
