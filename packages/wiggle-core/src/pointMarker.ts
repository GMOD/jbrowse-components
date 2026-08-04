import { crispSquareTopLeftPx } from '@jbrowse/render-core/shaders/pointGlyph'
import { SMALL_POINT_MAX_DIAMETER } from '@jbrowse/render-core/shaders/pointGlyphConsts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// At/below a 3px diameter an antialiased disc reads as a blurry blob, so scatter
// points draw as a crisp filled square below this threshold and an AA disc
// above it. The value comes from pointGlyph.slang via `//! export-consts`, so
// the two backends can't disagree about where the square/disc split is; the
// alias keeps this module's long-standing public name.
export const SMALL_POINT_MAX_DIAMETER_PX = SMALL_POINT_MAX_DIAMETER

// Append one scatter point marker to the current path, centered on (cx, y): a
// crisp filled square at/below SMALL_POINT_MAX_DIAMETER_PX, else an antialiased
// disc. Shared by the wiggle scatter and GWAS Manhattan Canvas2D paths so the
// square/disc threshold can't drift between them or from the shader. The caller
// owns ctx.beginPath()/ctx.fill() so many markers batch into one fill.
export function appendPointMarker(
  ctx: Ctx2D,
  cx: number,
  y: number,
  diameter: number,
) {
  const radius = diameter / 2
  if (diameter <= SMALL_POINT_MAX_DIAMETER_PX) {
    // Snap the top-left to the pixel grid (round-half-up) so the crisp square's
    // fill lands on whole pixels instead of AA-blurring across columns/rows.
    // `crispSquareTopLeftPx` is generated from pointGlyph.slang (adr-051), so
    // this is the shader's snap rather than a re-derivation of it.
    ctx.rect(
      crispSquareTopLeftPx(cx, diameter),
      crispSquareTopLeftPx(y, diameter),
      diameter,
      diameter,
    )
  } else {
    ctx.moveTo(cx + radius, y)
    ctx.arc(cx, y, radius, 0, Math.PI * 2)
  }
}
