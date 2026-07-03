import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  frequencyAlpha,
  intronAlpha,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type { GapUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const GAP_DELETION = 0
const GAP_SKIP = 1

export function drawGaps(
  ctx: Ctx2D,
  region: GapUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const delColorBase = state.colors.colorDeletion

  // gapPositions stores [start, end] pairs
  const numGaps = region.gapPositions.length / 2
  for (let i = 0; i < numGaps; i++) {
    const startBp = region.gapPositions[i * 2]!
    const endBp = region.gapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const yRow = region.gapYs[i]!
    const y = pileupRowY(yRow, state)
    const gapType = region.gapTypes[i]!
    // reversed (flipped) regions map startBp to the larger screen x, so anchor
    // at the smaller edge and use the absolute width
    const left = Math.min(x1, x2)
    const widthPx = Math.abs(x2 - x1)
    const w = Math.max(1, widthPx)

    if (gapType === GAP_DELETION) {
      const frequency = region.gapFrequencies[i]! / 255
      const alpha =
        state.filterMismatchesByFrequency && widthPx < 1
          ? frequencyAlpha(widthPx * widthPx, frequency)
          : 1
      ctx.fillStyle =
        alpha >= 1 ? rgb255(delColorBase) : rgba255(delColorBase, alpha)
      ctx.fillRect(left, y, w, fH)
    } else if (gapType === GAP_SKIP) {
      // No clearRect needed: drawReads splits spliced reads into per-exon
      // segments, so the intron span is already unpainted. Just draw the 1px
      // centerline. (clearRect is a no-op on SvgCanvas — relying on it left
      // the read body solid under the line in vector SVG export.)
      ctx.fillStyle = rgba255(state.colors.colorSkip, intronAlpha(fH))
      const midY = y + fH / 2
      ctx.fillRect(left, midY - 0.5, w, 1)
    }
  }
}
