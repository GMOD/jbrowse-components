---
name: put-linearmanhattandisplay-on-the-wiggle-family-s-plotgeometry-and-shared
description: Put `LinearManhattanDisplay` on the wiggle family's `plotGeometry` and shared views
area: rendering-and-displays
---

# Put `LinearManhattanDisplay` on the wiggle family's `plotGeometry` and shared views

proposed as backlog work, checked 2026-08-25 and declined:
the duplication it names is either deliberate or not duplication. Of the four
members `wiggleDisplayViews` states, `ticks` is the only candidate, and
Manhattan pins `scaleType: 'linear'` and ignores `symlogConstant` by design
(its scores are pre-transformed -log10 p values) where the shared getter
passes both through, so sharing it means a scaleType override existing for one
caller. `renderState` is a different type — `ManhattanRenderState` is
`{domainY, canvasWidth, canvasHeight, pointDiameterPx}` against
`WiggleGPURenderState`'s scaleType, symlogConstant, renderingType, numRows,
lineWidth and origin. `scoreRamp` needs a density mode Manhattan has not, and
`sharedRpcProps`/`sharedGpuProps` name fetch keys it does not fetch on. The
duplicated `minimalTicks` slot is deliberate and says so at
`WiggleCommonMixin.ts`'s `wiggleCommonExtraSlots`: "declared per display
because the shared field table is spread by `LinearManhattanDisplay` too,
which owns its own axis." And `plotGeometry` collapses for Manhattan to
`axisPlotBox(height)` with `numRows: 1`, which it already calls directly on
both sides — its ticks and its render canvas agree, so there is no drift to
close.
