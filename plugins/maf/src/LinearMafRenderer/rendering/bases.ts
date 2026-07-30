import { fillBpSpan } from '@jbrowse/render-core/canvas2dUtils'

import { resolveCellColor } from '../resolveCellColor.ts'
import { resolvedExtent } from './alignedExtent.ts'
import { GAP_STROKE_OFFSET } from './types.ts'

import type { buildColumnForGenomicOffset } from '../binning.ts'
import type { RowFlank } from './rowFlank.ts'
import type { RenderingContext } from './types.ts'

/**
 * Paint one row's base cells. Walks genomic offsets in steps of `binBp`,
 * filling a cell that covers each step — so `binBp === 1` is "every base" and
 * anything larger is the zoomed-out decimation, with no second code path.
 *
 * Insertion columns never appear here: `colForGpos` holds only columns that
 * carry a genomic position. The insertion markers are drawn separately, by the
 * overlay / export (`drawMafInsertions`).
 *
 * Columns outside the row's `resolvedExtent` paint nothing, so a gap run
 * running off either end of the block reads as blank — the same as the blocks
 * the sample is absent from entirely — unless the abutting block closes it.
 */
export function renderBases(
  context: RenderingContext,
  alignment: Uint8Array,
  seq: Uint8Array,
  columns: ReturnType<typeof buildColumnForGenomicOffset>,
  startBp: number,
  rowTop: number,
  flank: RowFlank,
) {
  const { ctx, h, cellColorConfig, bpToPx, binBp } = context
  const { colForGpos, refLen } = columns
  const { firstCol, lastCol } = resolvedExtent(
    alignment,
    alignment.length,
    flank,
  )

  for (let gpos = 0; gpos < refLen; gpos += binBp) {
    const col = colForGpos[gpos]!
    // Malformed files can ship a row shorter than the reference; nothing past
    // its end is classifiable.
    if (col >= alignment.length) {
      break
    }
    if (col >= firstCol && col <= lastCol) {
      const css = resolveCellColor(seq[col]!, alignment[col]!, cellColorConfig)
      if (css !== undefined) {
        ctx.fillStyle = css
        fillBpSpan(
          ctx,
          bpToPx,
          startBp + gpos,
          startBp + Math.min(gpos + binBp, refLen),
          rowTop,
          h,
          GAP_STROKE_OFFSET,
        )
      }
    }
  }
}
