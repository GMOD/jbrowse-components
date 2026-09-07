import { appendGlyph } from '@jbrowse/render-core/marks/glyphPaint'
import { SMALL_POINT_MAX_DIAMETER } from '@jbrowse/render-core/shaders/pointGlyphConsts'
import { GLYPH_DISC } from '@jbrowse/render-core/shaders/pointMarkConsts'

import type { MarkContext2D } from '@jbrowse/render-core/marks'

// At/below a 3px diameter an antialiased disc reads as a blurry blob, so scatter
// points draw as a crisp filled square below this threshold and an AA disc
// above it. The value comes from pointGlyph.slang via `//! export-consts`, so
// the two backends can't disagree about where the square/disc split is; the
// alias keeps this module's long-standing public name.
export const SMALL_POINT_MAX_DIAMETER_PX = SMALL_POINT_MAX_DIAMETER

// Append one scatter point marker to the current path, centered on (cx, y): the
// `point` shape's disc glyph, which is a crisp filled square at/below
// SMALL_POINT_MAX_DIAMETER_PX and an antialiased disc above it. Wiggle's
// scatter mode draws only that one glyph, so this is the shape's painter
// reached at a name that predates it. The caller owns
// ctx.beginPath()/ctx.fill() so many markers batch into one fill.
export function appendPointMarker(
  ctx: MarkContext2D,
  cx: number,
  y: number,
  diameter: number,
) {
  appendGlyph(ctx, GLYPH_DISC, cx, y, diameter)
}
