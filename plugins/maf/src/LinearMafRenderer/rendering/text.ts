import { CHAR_SIZE_WIDTH, FONT_CONFIG, VERTICAL_TEXT_OFFSET } from './types.ts'

import type { RenderingContext } from './types.ts'

export function renderText(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
) {
  const {
    ctx,
    scale,
    hp2,
    mismatchRendering,
    showAllLetters,
    showAsUpperCase,
    contrastForBase,
    scissorX,
    scissorW,
  } = context

  if (scale >= CHAR_SIZE_WIDTH) {
    ctx.font = FONT_CONFIG
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    for (let i = 0, genomicOffset = 0; i < alignment.length; i++) {
      const refChar = seq[i]!
      if (refChar !== '-') {
        const alignChar = alignment[i]!
        if (
          (showAllLetters || refChar.toLowerCase() !== alignChar.toLowerCase()) &&
          alignChar !== '-'
        ) {
          const xPos = leftPx + scale * genomicOffset
          if (xPos >= scissorX - scale && xPos <= scissorX + scissorW) {
            ctx.fillStyle = mismatchRendering
              ? (contrastForBase[alignChar.toLowerCase()] ?? 'black')
              : 'black'
            ctx.fillText(
              showAsUpperCase ? alignChar.toUpperCase() : alignChar,
              xPos + (scale - CHAR_SIZE_WIDTH) / 2 + 1,
              hp2 + rowTop + VERTICAL_TEXT_OFFSET,
            )
          }
        }
        genomicOffset++
      }
    }
  }
}
