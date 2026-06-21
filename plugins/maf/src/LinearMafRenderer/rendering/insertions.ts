import {
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
} from '@jbrowse/alignments-core'

import { forEachInsertion } from './forEachInsertion.ts'
import { CHAR_SIZE_WIDTH } from './types.ts'

import type { RenderingContext } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Draw one insertion marker + its length label, shared by the on-screen MAF
 * `InsertionsOverlay` and the Canvas2D export path so the two can't drift. The
 * `xCenter` is the cell boundary the insertion sits before. A row text label
 * (large insertions: the bp count centered in the box, small insertions: a
 * `(N)` beside the bar — matching plugin-alignments) only renders once the row
 * is tall enough for letters (`MIN_HEIGHT_FOR_TEXT`, shared with the base/SNP
 * letters so insertions and mismatches reveal together). With no count drawn, a
 * large insertion shrinks to the narrow bar rather than an empty wide box.
 * Callers must set `ctx.font` and `ctx.textBaseline = 'middle'` first.
 */
export function drawMafInsertionMarker(
  ctx: Ctx2D,
  xCenter: number,
  rowTop: number,
  h: number,
  length: number,
  pxPerBp: number,
  insertionColor: string,
) {
  const type = getInsertionType(length, pxPerBp)
  const labelFits = h >= MIN_HEIGHT_FOR_TEXT
  ctx.fillStyle = insertionColor
  drawInsertionMarker(ctx, xCenter, rowTop, h, length, pxPerBp, labelFits)
  const yMid = Math.round(rowTop + h / 2)
  if (type === 'large' && labelFits) {
    const text = String(length)
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.fillText(text, xCenter, yMid, CHAR_SIZE_WIDTH * text.length)
  } else if (type === 'small' && labelFits && pxPerBp >= MIN_PX_PER_BP_FOR_TEXT) {
    ctx.fillStyle = insertionColor
    ctx.textAlign = 'left'
    ctx.fillText(`(${length})`, xCenter + 3, yMid)
  }
}

/**
 * Draw insertion markers for one row on the Canvas2D export path. The marker
 * centers on the cell boundary the insertion sits before — the cell's incoming
 * edge, which is the left edge when non-reversed and the right edge when
 * reversed.
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
    drawMafInsertionMarker(
      ctx,
      xCenter,
      rowTop,
      h,
      length,
      scale,
      palette.insertionColor,
    )
  })
}
