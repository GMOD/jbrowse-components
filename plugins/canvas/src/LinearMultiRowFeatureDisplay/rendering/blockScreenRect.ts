import { makeBpMapper, spanRect } from '@jbrowse/render-core/canvas2dUtils'

import { MULTI_ROW_MIN_CELL_PX, rowBand } from './rowBand.ts'

import type { MultiRowHit } from '../model.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// One px wider than the block's own floor, so the border reads around a
// sub-pixel block rather than replacing it.
const MIN_WIDTH_PX = MULTI_ROW_MIN_CELL_PX + 1

/**
 * Screen box of one block, off the same `spanRect` and row band the painter
 * uses, so a sub-pixel block widens away from its start edge on a reversed
 * region exactly as the painting does.
 */
export function blockScreenRect({
  hit,
  rowIndex,
  blocks,
  rowHeight,
  rowProportion,
}: {
  hit: Pick<MultiRowHit, 'regionIndex' | 'start' | 'end'>
  rowIndex: number
  blocks: RenderBlock[]
  rowHeight: number
  rowProportion: number
}) {
  const block = blocks.find(b => b.displayedRegionIndex === hit.regionIndex)
  if (block) {
    const span = spanRect(makeBpMapper(block), hit.start, hit.end, MIN_WIDTH_PX)
    const left = Math.max(block.screenStartPx, span.left)
    const right = Math.min(block.screenEndPx, span.left + span.width)
    const { height, offset } = rowBand(rowHeight, rowProportion)
    return right > left
      ? {
          left,
          width: right - left,
          top: rowIndex * rowHeight + offset,
          height,
        }
      : undefined
  }
  return undefined
}
