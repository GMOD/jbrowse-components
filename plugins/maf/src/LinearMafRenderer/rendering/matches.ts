import { fillRect } from '../util.ts'
import { GAP_STROKE_OFFSET } from './types.ts'

import type { RenderingContext } from './types.ts'

export function renderMatches(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
) {
  if (context.showAllLetters) {
    return
  }

  const { ctx, scale, h, canvasWidth } = context
  ctx.fillStyle = 'lightgrey'

  // Highlight matching bases with light grey background
  for (
    let i = 0, genomicOffset = 0, seqLength = alignment.length;
    i < seqLength;
    i++
  ) {
    const refChar = seq[i]!
    if (refChar !== '-') {
      const alignChar = alignment[i]!
      if (
        refChar.toLowerCase() === alignChar.toLowerCase() &&
        alignChar !== ' '
      ) {
        const xPos = leftPx + scale * genomicOffset
        fillRect(ctx, xPos, rowTop, scale + GAP_STROKE_OFFSET, h, canvasWidth)
      }
      genomicOffset++
    }
  }
}
