---
name: a-vector-variant-matrix-writes-each-cell-rect-several-times
description: A variant matrix exported as vector writes one rect per cell with rows snapped to whole px, so about two thirds of the file is exact duplicates. Dropping the duplicates shows hairline seams between columns, so the fix has to merge or snap columns too.
---

# A vector variant matrix writes each cell rect several times

With "Rasterize canvas tracks" unchecked, `matrixCellMark.paintBlock`
(`plugins/variants/src/LinearVariantDisplay/matrix/matrixCellMark.ts`) emits
one `fillRect` per cell, with rows snapped to whole CSS px (`snapScale: 1`,
`renderMatrixSvg.tsx`). Rows thinner than a pixel land on identical rects.
Measured on `vcf_cluster_snapshot.svg` on 2026-11-25: 9.5 MB, 119,263
`<rect>`s of which 40,892 are distinct, all 1 px tall, 82,397 of them the
hom-ref grey. The default export rasterizes, so this costs only a user who
asks for vector, in file size and in how long an editor takes to open it.

The rows layout's `cellMark` (`LinearVariantDisplay/components/cellMark.ts`)
takes the same `snapScale: 1` and also snaps x, so thin columns collapse there
too. Nobody has counted its duplicates.

## What was tried

A vector-only path that kept, for each distinct rect, the last opaque paint,
and merged a column's same-color cells that meet edge to edge. It cut the
golden to 3.1 MB and was reverted before landing: the result shows faint
vertical seams between columns. Column edges sit at fractional x, and each
used to be painted several times over, which hid the antialiasing at the
boundary; painted once, the boundary shows through as a light line. 4.4% of
the golden's pixels changed, 0.4% by more than a tenth of full scale.

Two details of that attempt are worth keeping. A cell may only be dropped
when the rect painted over it is opaque, since variant colors can be
translucent (the density fade). And the merge is exact for same-color cells
that abut, translucent or not, because they do not overlap.

## What a fix needs

The seam has to go before the duplicates can. Either the vector path snaps
column edges to whole px, as it snaps rows, so neighbours share an exact edge;
or it merges horizontally as well as vertically, so a run of one color is one
rect and has no interior edges. The raster and on-screen output should not
change, and the judge is a before and after of the golden's picture, not its
size: an antialiasing change is shown as captures before it lands.
