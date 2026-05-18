import { GAP_STROKE_OFFSET } from './types.ts'

import type { RenderingContext } from './types.ts'

export function renderBases(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
) {
  const { ctx, scale, h, showAllLetters, mismatchRendering, colorForBase } =
    context
  const cellW = scale + GAP_STROKE_OFFSET

  for (let i = 0, genomicOffset = 0; i < alignment.length; i++) {
    const refChar = seq[i]!
    if (refChar !== '-') {
      const alignChar = alignment[i]!
      if (alignChar !== '-' && alignChar !== ' ') {
        const base = alignChar.toLowerCase()
        const isMismatch = refChar.toLowerCase() !== base
        let color: string
        if (isMismatch) {
          color = mismatchRendering ? (colorForBase[base] ?? 'black') : 'orange'
        } else if (showAllLetters) {
          color = mismatchRendering
            ? (colorForBase[base] ?? 'black')
            : 'lightblue'
        } else {
          color = 'lightgrey'
        }
        ctx.fillStyle = color
        ctx.fillRect(leftPx + scale * genomicOffset, rowTop, cellW, h)
      }
      genomicOffset++
    }
  }
}
