import { drawInsertionMarker, getInsertionType } from '@jbrowse/alignments-core'

import { forEachInsertion } from './forEachInsertion.ts'
import { CHAR_HEIGHT, CHAR_SIZE_WIDTH, FONT_CONFIG } from './types.ts'

import type { RenderingContext } from './types.ts'

/**
 * Draw insertion markers for one row on the Canvas2D export path. Geometry is
 * the same `drawInsertionMarker` plugin-alignments and the on-screen MAF
 * `InsertionsOverlay` use; only the count-text label is drawn here (MAF has no
 * separate insertion-label layer). The marker centers on the cell boundary the
 * insertion sits before — the cell's incoming edge, which is the left edge when
 * non-reversed and the right edge when reversed.
 */
export function renderInsertions(
  context: RenderingContext,
  alignment: Uint8Array,
  seq: Uint8Array,
  startBp: number,
  rowTop: number,
) {
  const { ctx, scale, h, reversed, palette, bpToCellLeftPx } = context
  ctx.font = FONT_CONFIG
  ctx.textAlign = 'center'
  forEachInsertion(seq, alignment, startBp, (anchorBp, length) => {
    const cellLeft = bpToCellLeftPx(anchorBp)
    const xCenter = reversed ? cellLeft + scale : cellLeft
    ctx.fillStyle = palette.insertionColor
    drawInsertionMarker(ctx, xCenter, rowTop, h, length, scale)
    if (getInsertionType(length, scale) === 'large' && h > CHAR_HEIGHT) {
      const text = String(length)
      ctx.fillStyle = 'white'
      ctx.fillText(text, xCenter, rowTop + (h * 7) / 8, CHAR_SIZE_WIDTH * text.length)
    }
  })
}
