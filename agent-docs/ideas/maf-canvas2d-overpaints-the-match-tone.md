---
name: maf-canvas2d-overpaints-the-match-tone
description: MAF's Canvas2D rows band paints darker than either the GPU or a supersampled ground truth because the translucent match colour is stacked ~2.3x per pixel by the per-cell overdraw pad; a bigger cross-backend gap than the sub-pixel floor question, and no floor choice can close it.
---

# MAF's Canvas2D path over-paints the match tone

Found 2026-08-31 by the [[maf-subpixel-cells]] measurement, where the shipped
Canvas2D render was supposed to be the honest reference and turned out to be
the *furthest* thing from the supersampled ground truth (26.58 vs the GPU
floor's 15.05 and no-floor's 4.31, mean per-pixel distance at dpr 1).
Supersampling Canvas2D itself to dpr 4 barely helps (23.98), so it is
systematic over-paint, not rasterisation.

The mechanism is a stack of two decisions that are each fine alone:

- `matchColor` is MUI's `action.disabledBackground`, `rgba(0,0,0,0.12)` —
  **translucent**.
- `fillBpSpan` adds `GAP_STROKE_OFFSET = 0.4` px to every per-base cell to
  close AA seams.

At ~3.25 bp/px that pad turns a 0.31 px cell pitch into 0.71 px fills, so
~2.3 translucent layers land on every pixel and the 12% grey compounds.
Measured modal rows-band tone at `ctgA:1-4000` on volvox: GPU `224,224,224`
(one 12% fill over white), Canvas2D `195,195,195` — right where
`255 * 0.88^2.3 = 191` predicts. The SVG export rides the same path.

The overdraw pad is a legitimate per-backend AA compensation
(GPU_RENDERING.md's intentional-divergences list); what breaks is compounding
it through a translucent fill. Candidate fixes, in the order to try:

- Resolve the match tone to an **opaque** colour once (composite the 12% over
  the theme background at paint setup) so overlapping fills are idempotent.
  Cheapest, and leaves the pad alone.
- Or run-merge the match fills the way the GPU encode already run-merges
  same-coloured cells, so one run is one fill and the pad fires once per run
  rather than once per base.

Either way the cross-backend gate is the check: this gap is in the shipped
comparison today, spread over the whole rows band, which is exactly the shape
a 1.5% mean-diff threshold is worst at noticing.
