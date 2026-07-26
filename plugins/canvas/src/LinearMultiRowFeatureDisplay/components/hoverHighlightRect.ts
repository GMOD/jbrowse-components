import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import type { MultiRowHit } from '../model.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * Screen box of the hovered block, in the geometry both render paths paint it
 * with: the row inset by `rowProportion`, and the bp span clamped to the
 * region's screen span so a feature running past the edge can't bleed over its
 * neighbour. Undefined when that region isn't on screen, or when the feature
 * contributes no pixels there (the usual shape for a feature that spans a
 * displayed-region boundary: it clamps to nothing in the region it only
 * touches).
 */
export function hoverHighlightRect({
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
    const left = Math.max(block.screenStartPx, Math.min(xa, xb))
    const right = Math.min(block.screenEndPx, Math.max(xa, xb))
    const height = rowHeight * rowProportion
    return right > left
      ? {
          left,
          // a sub-pixel feature still paints (the render paths widen to 1px), so
          // the box needs a floor of its own to stay visible around it
          width: Math.max(2, right - left),
          top: hit.rowIndex * rowHeight + (rowHeight - height) / 2,
          height,
        }
      : undefined
  }
  return undefined
}
