---
name: diagonalize-ignores-a-reversed-reference
description: A real bug. diagonalizeRegions positions and orients each query chromosome against its anchor reference in raw coordinates, ignoring the reference region's `reversed`, so in a stacked synteny cascade every level below a reversed chromosome sorts that chromosome's partners mirrored and flips their orientation vote. The fix is a sign on three quantities; it moves every auto-diagonalized figure with three or more rows.
---

# Diagonalize ignores a reversed reference

`anchorStats` in `packages/core/src/util/diagonalizeRegions.ts` returns
`bestRefPos` (the length-weighted mean reference position), the strand vote and
the position covariance, all in the reference chromosome's raw coordinates.
`referenceRegions[i].reversed` is never read.

The first level out from the anchor row is unaffected, since the anchor keeps its
orientation. From the second level on, the reference row carries reversals the
previous level chose. Two query chromosomes anchored to one reversed reference
chromosome are then sorted in the opposite order to how that chromosome is drawn,
and each one's reversal is decided against the undrawn orientation.

Fix: with `sign = reversed ? -1 : 1`, use `sign * refMean` for the position,
and multiply the strand fraction and the covariance by `sign`. A spike did this
and the diagonalize suites passed unchanged, so no test pins either behaviour.
The new test wants a reversed reference chromosome with two query chromosomes
anchored to opposite ends of it.

On the six-genome linkage-group stack it moved ribbon crossings by under 4%
(0.962M to 0.925M, filtered tables). The cost is the reshoot: every figure with
three or more auto-diagonalized rows can change order.
