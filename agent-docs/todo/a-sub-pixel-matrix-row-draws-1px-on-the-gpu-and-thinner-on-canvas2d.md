---
name: a-sub-pixel-matrix-row-draws-1px-on-the-gpu-and-thinner-on-canvas2d
description: a visual call; the 41% is measured and neither side is obviously wrong
metadata:
  area: variants, backends
  category: visual-call
---

# A sub-pixel matrix row draws 1px on the GPU and thinner on Canvas2D

`variantMatrix.slang`'s `drawnCellHeightPx` floors a cell at 1px;
`Canvas2DVariantMatrixRenderer` draws `rowHeight + f2` with no floor. On a
2,504-sample matrix at the default height rows are 0.09px, so the GPU paints
each cell 11x taller than Canvas2D does and the SVG export comes out visibly
fainter than the screen it was exported from.

Measured 2026-08-21: giving the Canvas2D path the same floor moves **41.4%** of
the pixels in `VcfMatrix.test.tsx` and 35.4% in `VcfCluster.test.tsx`.

**Neither side is obviously the bug**, which is why this is here. The GPU's
floor is a hardware workaround — zero-height geometry gets culled — and
Canvas2D has no such constraint, so drawing a 0.09px rect and letting
antialiasing carry it is arguably the more faithful answer. But the two
backends then disagree by 41%, and the export disagrees with the screen.

The Canvas2D comment already says **"Do NOT pixel-snap or force a 1px minimum
here (that decimates sub-pixel columns)"** — written about columns, and it is
what makes this a call rather than an edit. Whoever takes it should read
`compare-backends.ts --gate-only` first — the committed webgl goldens are
themselves stale repo-wide, so they are not a tiebreak.

The hit test is already settled and is not waiting on this: `matrixHitTest.ts`
walks the GPU's 1px band, which is a superset of the Canvas2D extent, and
`nearest` is the same row either way.
