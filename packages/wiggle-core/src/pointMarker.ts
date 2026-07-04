import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// At/below a 3px diameter an antialiased disc reads as a blurry blob, so scatter
// points draw as a crisp filled square below this threshold and an AA disc
// above it. Mirrors SMALL_POINT_MAX_DIAMETER in wiggle.slang / manhattan.slang.
export const SMALL_POINT_MAX_DIAMETER_PX = 3

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
    ctx.rect(cx - radius, y - radius, diameter, diameter)
  } else {
    ctx.moveTo(cx + radius, y)
    ctx.arc(cx, y, radius, 0, Math.PI * 2)
  }
}
