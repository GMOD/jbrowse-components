import { fillRect } from '../util'
import { GAP_STROKE_OFFSET } from './types'

import type { RenderingContext } from './types'

export function renderMismatches(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
) {
  const {
    ctx,
    scale,
    h,
    canvasWidth,
    showAllLetters,
    mismatchRendering,
    colorForBase,
  } = context

  for (
    let i = 0, genomicOffset = 0, seqLength = alignment.length;
    i < seqLength;
    i++
  ) {
    const alignChar = alignment[i]!
    const refChar = seq[i]!
    if (refChar !== '-') {
      if (alignChar !== '-') {
        const xPos = leftPx + scale * genomicOffset
        const base = alignChar.toLowerCase()
        if (refChar.toLowerCase() !== base && alignChar !== ' ') {
          fillRect(
            ctx,
            xPos,
            rowTop,
            scale + GAP_STROKE_OFFSET,
            h,
            canvasWidth,
            mismatchRendering ? (colorForBase[base] ?? 'black') : 'orange',
          )
        } else if (showAllLetters) {
          fillRect(
            ctx,
            xPos,
            rowTop,
            scale + GAP_STROKE_OFFSET,
            h,
            canvasWidth,
            mismatchRendering ? (colorForBase[base] ?? 'black') : 'lightblue',
          )
        }
      }
      genomicOffset++
    }
  }
}
