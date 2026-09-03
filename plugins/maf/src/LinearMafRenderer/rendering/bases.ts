import { fillBpSpan } from '@jbrowse/render-core/canvas2dUtils'

import { resolveCellColor } from '../resolveCellColor.ts'
import { resolvedExtent } from './alignedExtent.ts'
import { GAP_STROKE_OFFSET } from './types.ts'

import type { GenomicColumns } from '../binning.ts'
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
  columns: GenomicColumns,
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

  // Consecutive cells of one color are one fill, the way the GPU encoder
  // merges runs into one quad. An alignment is mostly runs — a conserved
  // stretch is all `matchColor`, a gap run all `gapColor` — so this is most of
  // the fills gone, and it is what keeps the seam pad from compounding: the
  // match tone is translucent, and padding every sub-pixel cell stacked it
  // ~2.3 deep at 3 bp/px, which painted the rows band darker than the GPU.
  //
  // Per row rather than per block: `forEachClippedBlock`'s `restore()` resets
  // the context state at each render block, and re-asserting the color on the
  // first painted run of a row is correct under any caller.
  let runCss: string | undefined
  let runStart = 0
  let runEnd = 0
  const flush = () => {
    if (runCss !== undefined) {
      ctx.fillStyle = runCss
      fillBpSpan(
        ctx,
        bpToPx,
        startBp + runStart,
        startBp + runEnd,
        rowTop,
        h,
        GAP_STROKE_OFFSET,
      )
      runCss = undefined
    }
  }
  for (let gpos = 0; gpos < refLen; gpos += binBp) {
    const col = colForGpos[gpos]!
    // Malformed files can ship a row shorter than the reference; nothing past
    // its end is classifiable.
    if (col >= alignment.length) {
      break
    }
    const css =
      col >= firstCol && col <= lastCol
        ? resolveCellColor(seq[col]!, alignment[col]!, cellColorConfig)
        : undefined
    const cellEnd = Math.min(gpos + binBp, refLen)
    if (css === runCss && css !== undefined) {
      runEnd = cellEnd
    } else {
      flush()
      if (css !== undefined) {
        runCss = css
        runStart = gpos
        runEnd = cellEnd
      }
    }
  }
  flush()
}
