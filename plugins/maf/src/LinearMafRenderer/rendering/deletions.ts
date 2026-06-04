import { measureText } from '@jbrowse/core/util'

import { forEachDeletion } from './forEachDeletion.ts'
import { CHAR_HEIGHT, FONT_CONFIG } from './types.ts'

import type { RenderingContext } from './types.ts'

/**
 * Draw the deleted-base count inside each deletion run for one row on the
 * Canvas2D export path. Shares the `forEachDeletion` walk with the on-screen
 * overlay + hover hit-test, so all three agree on deletion geometry. The gap
 * cells are drawn by `renderBases`; this only adds the count label.
 */
export function renderDeletions(
  context: RenderingContext,
  alignment: Uint8Array,
  seq: Uint8Array,
  startBp: number,
  rowTop: number,
) {
  const { ctx, scale, h, bpToCellLeftPx } = context
  ctx.font = FONT_CONFIG
  ctx.textAlign = 'center'
  ctx.fillStyle = 'white'
  forEachDeletion(seq, alignment, startBp, (start, length) => {
    const xa = bpToCellLeftPx(start)
    const xb = bpToCellLeftPx(start + length - 1)
    const xLeft = Math.min(xa, xb)
    const width = length * scale
    const text = String(length)
    if (width >= measureText(text) + 2 && h > CHAR_HEIGHT) {
      ctx.fillText(text, xLeft + width / 2, rowTop + (h * 7) / 8)
    }
  })
}
