import { measureText } from '@jbrowse/core/util'

import { forEachDeletion } from './forEachDeletion.ts'
import { CHAR_HEIGHT } from './types.ts'

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
  // Labels never fit below this height, so skip the whole walk (it only draws
  // count text — gap cells are drawn by renderBases).
  if (h > CHAR_HEIGHT) {
    ctx.fillStyle = 'white'
    forEachDeletion(seq, alignment, startBp, (start, length) => {
      const text = String(length)
      const width = length * scale
      if (width >= measureText(text) + 2) {
        const xa = bpToCellLeftPx(start)
        const xb = bpToCellLeftPx(start + length - 1)
        ctx.fillText(text, Math.min(xa, xb) + width / 2, rowTop + (h * 7) / 8)
      }
    })
  }
}
