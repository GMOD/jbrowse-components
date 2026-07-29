import { fillBpSpan } from '@jbrowse/render-core/canvas2dUtils'

import { resolveCellColor } from '../resolveCellColor.ts'
import { GAP_STROKE_OFFSET } from './types.ts'

import type { buildColumnForGenomicOffset } from '../binning.ts'
import type { RenderingContext } from './types.ts'

/**
 * Paint one row's base cells. Walks genomic offsets in steps of `binBp`,
 * filling a cell that covers each step — so `binBp === 1` is "every base" and
 * anything larger is the zoomed-out decimation, with no second code path.
 *
 * Insertion columns never appear here: `colForGpos` holds only columns that
 * carry a genomic position. The insertion markers are drawn separately, by the
 * overlay / export (`drawMafInsertions`).
 */
export function renderBases(
  context: RenderingContext,
  alignment: Uint8Array,
  seq: Uint8Array,
  columns: ReturnType<typeof buildColumnForGenomicOffset>,
  startBp: number,
  rowTop: number,
) {
  const { ctx, h, cellColorConfig, bpToPx, binBp } = context
  const { colForGpos, refLen } = columns

  for (let gpos = 0; gpos < refLen; gpos += binBp) {
    const col = colForGpos[gpos]!
    // Malformed files can ship a row shorter than the reference; nothing past
    // its end is classifiable.
    if (col >= alignment.length) {
      break
    }
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
