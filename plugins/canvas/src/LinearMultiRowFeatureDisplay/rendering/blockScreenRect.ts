import { makeBpMapper, spanLeft } from '@jbrowse/render-core/canvas2dUtils'

import { MULTI_ROW_MIN_CELL_PX, rowBand } from './rowBand.ts'

import type { MultiRowHit } from '../model.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Minimum on-screen width of the hover box. One px wider than the block's own
// floor (drawMultiRowBlocks) so the border reads around a sub-pixel block rather
// than replacing it — derived from that floor rather than restated, since the
// two only mean anything relative to each other.
const MIN_WIDTH_PX = MULTI_ROW_MIN_CELL_PX + 1

/**
 * Screen box of one block, in the geometry the painter gives it: `spanLeft` off
 * the row band, so a sub-pixel block widens away from its start edge on a
 * reversed region exactly as `drawMultiRowBlocks` widens it. Clamped to the
 * region, so a block running past the edge can't stripe its neighbour, and
 * undefined where it contributes no pixels.
 */
export function blockScreenRect({
  hit,
  blocks,
  rowHeight,
  rowProportion,
}: {
  hit: Pick<MultiRowHit, 'regionIndex' | 'rowIndex' | 'start' | 'end'>
  blocks: RenderBlock[]
  rowHeight: number
  rowProportion: number
}) {
  const block = blocks.find(b => b.displayedRegionIndex === hit.regionIndex)
  if (block) {
    const bpToPx = makeBpMapper(block)
    const xa = bpToPx(hit.start)
    const xb = bpToPx(hit.end)
    const width = Math.max(MIN_WIDTH_PX, Math.abs(xb - xa))
    const unclampedLeft = spanLeft(xa, xb, width)
    const left = Math.max(block.screenStartPx, unclampedLeft)
    const right = Math.min(block.screenEndPx, unclampedLeft + width)
    const { height, offset } = rowBand(rowHeight, rowProportion)
    return right > left
      ? {
          left,
          width: right - left,
          top: hit.rowIndex * rowHeight + offset,
          height,
        }
      : undefined
  }
  return undefined
}
