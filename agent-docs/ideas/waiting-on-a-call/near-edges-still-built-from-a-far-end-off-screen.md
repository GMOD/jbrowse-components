---
name: near-edges-still-built-from-a-far-end-off-screen
description: Where a mark's visible edge still carries the float32 rounding of an end 1e7 px or more off screen after the guard band — variant cells, sloped segments (the whiskers band, linked-read and centre lines) and the Canvas2D/SVG painters — and why each needs something other than `guardBandClipX`.
---

# Near edges still built from a far end off screen

`guardBandClipX` (`hpmath.slang`) pulls an axis-aligned span's end in to 1024
px past the view, so its visible edge is built from small numbers
([BP_PRECISION.md](../../reference/BP_PRECISION.md)). Three places it does not
reach, at the deepest zoom with one end 1e7 to 1e8 px off screen:

## Variant cells

`variant.slang` builds a cell as `x1Px + q.x * wPx`, the far end plus a width,
so a long variant's near edge is off on every adapter, llvmpipe included. The
clamp fits its rect cells. It does not fit the inversion glyph, whose slope
`inversionCoverage` computes from `widthPx`, so clamping the width moves the
visible diagonal. Open: a far-corner fixture for variant cells (llvmpipe can
gate it), and how the inversion glyph keeps its slope.

## Sloped geometry

- The whiskers band's line-centre trapezoid (`wiggleBand.slang`) still `lerp`s
  its near corner off the far one, which is off on NVIDIA-class adapters.
- `linkedReadLine.slang` hangs each corner off its own end, but its fragment
  reads `local` along-distances interpolated across the whole segment, as the
  centre line does. A same-row link of 5e6 px or more is unmeasured.

Moving a sloped end moves the visible line, so the fix is a corner select or
per-end distances, not the clamp.
[ADR-067](../../architecture-decision-records/adr-067-synteny-dotplot-window-relative-float32.md)
already declined a select over `lerp` for synteny curves, on pixel churn. Open:
a fixture with a bin of 100 kb or more at maximum zoom, and whether the
whiskers band clears ADR-067's bar.

## Canvas2D and SVG

Chrome's `fillRect` rounds x and width to float32 separately: with the far end
off the left, the near edge is 0.3 px off at 1e7 px and 3.3 px at 1e8, by a
Chrome probe on 2026-11-17. The wiggle painters pass unclamped spans
(`fillRect(spanLeft(x1, x2, w), …, w)` in `wiggleDrawFunctions.ts`). Those
spans are shared with the hit boxes, which must stay unclamped. Open: where
the painters clamp without the hit test seeing it, and whether SVG export
inherits the same rounding.
