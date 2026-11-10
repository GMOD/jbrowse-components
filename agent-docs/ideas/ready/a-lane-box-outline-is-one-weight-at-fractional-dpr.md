---
name: a-lane-box-outline-is-one-weight-at-fractional-dpr
description: At dpr 1.5 or 1.25 a multiway synteny lane box's outline draws 1 or 2 device px depending on where the box sits, because rect.slang picks outline or fill per fragment with a hard `min(d) < 1.0` step.
---

# A lane box outline is one weight at fractional dpr

`rect.slang`'s `fs_main` decides the outline per fragment from the
interpolated edge distances: `rectDrawsOutline(d.x + d.y, d.z + d.w)` and then
`min(d) < 1.0`, with no ramp. At dpr 1.5 a box edge on an even CSS px puts a
device-pixel centre exactly at `d = 1.0`, and interpolation lands it on
1.00000000 (fill) or 0.99999988 (outline) by x position. Each side of a box
then draws 1 or 2 device px of 0.87-alpha ink (`bandInk().text`), so the
outline weight doubles from box to box, or between a box's two sides.
Canvas2D strokes a half-alpha column there instead.

Reaching it: any multiway synteny view (`demos/hprc_multiway`,
`test_data/multiway_blocks`) on a 1.5 or 1.25 dpr display. Lane boxes are the
only rects with an outline (`multiwayGeometry.ts`, `boxes.outlineColor =
stroke`); the feature track hard-codes `outlineColor: 0`
(`renderStateViews.ts`).

First move, one edit to `fs_main` and its vertex stage:

- Decide `rectDrawsOutline` once per box in the vertex stage from the exact
  snapped width and height, passed as a `nointerpolation` value.
- Ramp the inner edge with `edgeCoverage` on `min(d) - 1.0` instead of the
  hard step.
- Composite the outline over the fill rather than replacing it, which is what
  Canvas2D's `strokeRect` over `fillRect` does.

Pin it with `multiwayBackendParity.test.ts`. A triage on 2026-11-10 found the
speckle and fill-replacement variants of this sub-visible (an fp32 simulation
at dpr 1–2 never crossed the 2.0 width threshold; the fill difference is at
most about 8/255), so this weight jitter is the only visible part.
