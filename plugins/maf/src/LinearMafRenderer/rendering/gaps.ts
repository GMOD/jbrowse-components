import { GAP_STROKE_OFFSET } from './types'

import type { RenderingContext } from './types'

export function renderGaps(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
) {
  const { ctx, scale } = context
  const h2 = context.rowHeight / 2

  ctx.beginPath()
  ctx.fillStyle = 'black'

  for (
    let i = 0, genomicOffset = 0, seqLength = alignment.length;
    i < seqLength;
    i++
  ) {
    if (seq[i] !== '-') {
      if (alignment[i] === '-') {
        const xPos = leftPx + scale * genomicOffset
        ctx.moveTo(xPos, rowTop + h2)
        ctx.lineTo(xPos + scale + GAP_STROKE_OFFSET, rowTop + h2)
      }
      genomicOffset++
    }
  }
  ctx.stroke()
}
