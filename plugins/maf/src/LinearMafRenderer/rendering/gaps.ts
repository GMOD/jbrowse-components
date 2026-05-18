import { GAP_STROKE_OFFSET } from './types.ts'

import type { RenderingContext } from './types.ts'

export function renderGaps(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
) {
  const { ctx, scale, rowHeight } = context
  const midY = rowTop + rowHeight / 2

  ctx.beginPath()
  ctx.strokeStyle = 'black'
  for (let i = 0, genomicOffset = 0; i < alignment.length; i++) {
    if (seq[i] !== '-') {
      if (alignment[i] === '-') {
        const xPos = leftPx + scale * genomicOffset
        ctx.moveTo(xPos, midY)
        ctx.lineTo(xPos + scale + GAP_STROKE_OFFSET, midY)
      }
      genomicOffset++
    }
  }
  ctx.stroke()
}
