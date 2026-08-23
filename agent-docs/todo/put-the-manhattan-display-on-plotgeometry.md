---
name: put-the-manhattan-display-on-plotgeometry
description: gwas carries a third copy of ticks / renderState / axisPlotBox and its own minimalTicks; the wiggle family's plotGeometry and wiggleDisplayViews already hold those
metadata:
  area: gwas, wiggle
  category: ready
---

# Put the Manhattan display on `plotGeometry`

The two wiggle displays now state `ticks`, `scoreRamp`, `renderState` and the
shared halves of `rpcProps` / `gpuProps` once, in
`plugins/wiggle/src/shared/wiggleDisplayViews.ts`, parameterised on a
`plotGeometry` getter (2026-08-23). `LinearManhattanDisplay`
(`stateModelFactory.ts` ~268, 304, 336) still carries its own copy of the tick
and render-state arithmetic over `axisPlotBox`, and declares its own
`minimalTicks` slot beside the one `wiggleCommonExtraSlots` now owns.

It composes `WiggleScoreConfigMixin` rather than `WiggleCommonMixin` (it fetches
untransformed SNPs, not bigwig bins), so the shared views' host type needs
checking against what Manhattan has — `WiggleRenderStateModel` is the
likeliest gap. `WiggleFamilySvgFrame` already defaults its geometry to
`axisPlotBox(height)` for Manhattan's sake.
