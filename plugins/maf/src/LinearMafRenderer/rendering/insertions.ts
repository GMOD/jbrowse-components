import { measureText } from '@jbrowse/core/util'

import {
  CHAR_SIZE_WIDTH,
  HIGH_BP_PER_PX_THRESHOLD,
  HIGH_ZOOM_THRESHOLD,
  INSERTION_BORDER_HEIGHT,
  INSERTION_BORDER_WIDTH,
  INSERTION_LINE_WIDTH,
  INSERTION_PADDING,
  LARGE_INSERTION_THRESHOLD,
  MIN_ROW_HEIGHT_FOR_BORDERS,
} from './types.ts'

import type { RenderingContext } from './types.ts'

const CHAR_HEIGHT = measureText('M') - 2

export function renderInsertions(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
  bpPerPx: number,
) {
  const { ctx, scale, h, rowHeight } = context

  for (let i = 0, genomicOffset = 0; i < alignment.length; i++) {
    let insLen = 0
    while (seq[i] === '-') {
      const c = alignment[i]!
      if (c !== '-' && c !== ' ') {
        insLen++
      }
      i++
    }
    if (insLen > 0) {
      const xPos = leftPx + scale * genomicOffset - INSERTION_LINE_WIDTH
      ctx.fillStyle = 'purple'

      if (insLen > LARGE_INSERTION_THRESHOLD) {
        const lengthText = `${insLen}`
        if (bpPerPx > HIGH_BP_PER_PX_THRESHOLD) {
          ctx.fillRect(
            xPos - INSERTION_LINE_WIDTH,
            rowTop,
            INSERTION_BORDER_WIDTH,
            h,
          )
        } else if (h > CHAR_HEIGHT) {
          const textWidth = measureText(lengthText, CHAR_SIZE_WIDTH)
          ctx.fillRect(
            xPos - textWidth / 2 - INSERTION_PADDING,
            rowTop,
            textWidth + 2 * INSERTION_PADDING,
            h,
          )
          ctx.fillStyle = 'white'
          ctx.fillText(lengthText, xPos - textWidth / 2, rowTop + (h * 7) / 8)
        } else {
          ctx.fillRect(
            xPos - INSERTION_PADDING,
            rowTop,
            2 * INSERTION_PADDING,
            h,
          )
        }
      } else {
        ctx.fillRect(xPos, rowTop, INSERTION_LINE_WIDTH, h)
        if (
          bpPerPx < HIGH_ZOOM_THRESHOLD &&
          rowHeight > MIN_ROW_HEIGHT_FOR_BORDERS
        ) {
          ctx.fillRect(
            xPos - INSERTION_BORDER_WIDTH,
            rowTop,
            INSERTION_BORDER_HEIGHT,
            INSERTION_LINE_WIDTH,
          )
          ctx.fillRect(
            xPos - INSERTION_BORDER_WIDTH,
            rowTop + h - INSERTION_LINE_WIDTH,
            INSERTION_BORDER_HEIGHT,
            INSERTION_LINE_WIDTH,
          )
        }
      }
    }
    genomicOffset++
  }
}
