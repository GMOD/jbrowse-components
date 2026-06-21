import {
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
} from '@jbrowse/alignments-core'

import { forEachInsertion } from './forEachInsertion.ts'
import { CHAR_HEIGHT, CHAR_SIZE_WIDTH } from './types.ts'

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
  forEachInsertion(seq, alignment, startBp, (anchorBp, length) => {
    const cellLeft = bpToCellLeftPx(anchorBp)
    const xCenter = reversed ? cellLeft + scale : cellLeft
    ctx.fillStyle = palette.insertionColor
    drawInsertionMarker(ctx, xCenter, rowTop, h, length, scale)
    const type = getInsertionType(length, scale)
    const yMid = Math.round(rowTop + h / 2)
    if (type === 'large' && h > CHAR_HEIGHT) {
      const text = String(length)
      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'
      ctx.fillText(text, xCenter, yMid, CHAR_SIZE_WIDTH * text.length)
    } else if (
      type === 'small' &&
      scale >= MIN_PX_PER_BP_FOR_TEXT &&
      h >= MIN_HEIGHT_FOR_TEXT
    ) {
      ctx.textAlign = 'left'
      ctx.fillText(`(${length})`, xCenter + 3, yMid)
    }
  })
}
