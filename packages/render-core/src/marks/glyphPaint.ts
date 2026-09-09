import { SMALL_POINT_MAX_DIAMETER } from '../shaders/pointGlyph.generated.ts'
import { crispSquareTopLeftPx } from '../shaders/pointGlyph.js.generated.ts'
import {
  DIAMOND_GLYPH_SCALE,
  GLYPH_DIAMOND,
  GLYPH_TRIANGLE,
} from '../shaders/pointMark.consts.generated.ts'

import type { InkRect, MarkContext2D } from './types.ts'

/** The path calls a glyph is built from — what a recorder has to answer. */
export type GlyphPath = Pick<
  MarkContext2D,
  'moveTo' | 'lineTo' | 'closePath' | 'rect' | 'arc'
>

/**
 * Append one of the `point` shape's glyphs to the current path, centred on
 * `(cx, y)`.
 *
 * The disc/crisp-square split and the square's snap are pointGlyph.slang's
 * (adr-051), so the painter cannot drift from the shader about where the split
 * is. The caller owns `beginPath`/`fill`, which is what lets a run of one
 * colour batch into a single fill.
 *
 * Its own module, not `pointMark.ts`'s: this is the half of the shape a
 * consumer can want without the pass, and importing it through the shape would
 * hand that consumer the shader's WGSL and GLSL strings. Wiggle's scatter mode
 * is that consumer.
 */
export function appendGlyph(
  ctx: GlyphPath,
  glyph: number,
  cx: number,
  y: number,
  diameter: number,
) {
  const r = diameter / 2
  if (glyph === GLYPH_TRIANGLE) {
    ctx.moveTo(cx - r, y - r)
    ctx.lineTo(cx + r, y - r)
    ctx.lineTo(cx, y + r)
    ctx.closePath()
  } else if (glyph === GLYPH_DIAMOND) {
    const ri = r * DIAMOND_GLYPH_SCALE
    ctx.moveTo(cx, y - ri)
    ctx.lineTo(cx + ri, y)
    ctx.lineTo(cx, y + ri)
    ctx.lineTo(cx - ri, y)
    ctx.closePath()
  } else if (diameter <= SMALL_POINT_MAX_DIAMETER) {
    ctx.rect(
      crispSquareTopLeftPx(cx, diameter),
      crispSquareTopLeftPx(y, diameter),
      diameter,
      diameter,
    )
  } else {
    ctx.moveTo(cx + r, y)
    ctx.arc(cx, y, r, 0, Math.PI * 2)
  }
}

/**
 * The box `appendGlyph` paints inside, by the same split and snap: the
 * diamond is scaled by `DIAMOND_GLYPH_SCALE` and the small square snaps to
 * the pixel grid, so neither is the diameter about the centre.
 */
export function glyphBox(
  glyph: number,
  cx: number,
  y: number,
  diameter: number,
): InkRect {
  const r = diameter / 2
  if (glyph === GLYPH_DIAMOND) {
    const ri = r * DIAMOND_GLYPH_SCALE
    return { left: cx - ri, top: y - ri, width: 2 * ri, height: 2 * ri }
  }
  if (glyph !== GLYPH_TRIANGLE && diameter <= SMALL_POINT_MAX_DIAMETER) {
    return {
      left: crispSquareTopLeftPx(cx, diameter),
      top: crispSquareTopLeftPx(y, diameter),
      width: diameter,
      height: diameter,
    }
  }
  return { left: cx - r, top: y - r, width: diameter, height: diameter }
}
