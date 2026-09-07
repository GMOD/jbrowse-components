---
name: merging-computevariantcells-and-computevariantmatrixcells-130-shared-lines
description: Merging `computeVariantCells` and `computeVariantMatrixCells` (~130 shared lines)
area: performance-and-measurement
---

# Merging `computeVariantCells` and `computeVariantMatrixCells` (~130 shared lines)

declined 2026-09-01 by the multi display review. Both sit on the
worker path `MULTI_SAMPLE_VARIANTS.md` measured at 2504 samples x 400 sites,
and that A/B is the price of admission for any change there; the duplication
is cheaper than re-running it for a shared helper.
