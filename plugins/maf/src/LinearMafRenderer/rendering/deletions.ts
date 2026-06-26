import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { measureText } from '@jbrowse/core/util'

import { forEachDeletion } from './forEachDeletion.ts'

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
  // Letters never fit below this height (shared with base/SNP + insertion text
  // so they reveal together), so skip the whole walk — it only draws count text;
  // gap cells are drawn by renderBases.
  if (h >= MIN_HEIGHT_FOR_TEXT) {
    ctx.fillStyle = 'white'
    // Set explicitly rather than relying on the once-set outer 'center': a small
    // insertion earlier in the same block leaves textAlign='left', which would
    // otherwise mis-align these centered count labels.
    ctx.textAlign = 'center'
    const yMid = Math.round(rowTop + h / 2)
    forEachDeletion(seq, alignment, startBp, (start, length) => {
      const text = String(length)
      const width = length * scale
      if (width >= measureText(text) + 2) {
        const xa = bpToCellLeftPx(start)
        const xb = bpToCellLeftPx(start + length - 1)
        ctx.fillText(text, Math.min(xa, xb) + width / 2, yMid)
      }
    })
  }
}
