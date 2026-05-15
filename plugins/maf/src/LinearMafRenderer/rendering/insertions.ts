import { measureText } from '@jbrowse/core/util'

import { fillRect } from '../util.ts'
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

export function renderInsertions(
  context: RenderingContext,
  alignment: string,
  seq: string,
  leftPx: number,
  rowTop: number,
  bpPerPx: number,
) {
  const { ctx, scale, h, canvasWidth, rowHeight, charHeight } = context

  for (
    let i = 0, genomicOffset = 0, seqLength = alignment.length;
    i < seqLength;
    i++
  ) {
    let insertionSequence = ''
    while (seq[i] === '-') {
      const alignChar = alignment[i]!
      if (alignChar !== '-' && alignChar !== ' ') {
        insertionSequence += alignChar.toLowerCase()
      }
      i++
    }
    if (insertionSequence.length > 0) {
      const xPos = leftPx + scale * genomicOffset - INSERTION_LINE_WIDTH

      if (insertionSequence.length > LARGE_INSERTION_THRESHOLD) {
        const lengthText = `${insertionSequence.length}`
        if (bpPerPx > HIGH_BP_PER_PX_THRESHOLD) {
          fillRect(
            ctx,
            xPos - INSERTION_LINE_WIDTH,
            rowTop,
            INSERTION_BORDER_WIDTH,
            h,
            canvasWidth,
            'purple',
          )
        } else if (h > charHeight) {
          const textWidth = measureText(lengthText, CHAR_SIZE_WIDTH)
          const padding = INSERTION_PADDING
          fillRect(
            ctx,
            xPos - textWidth / 2 - padding,
            rowTop,
            textWidth + 2 * padding,
            h,
            canvasWidth,
            'purple',
          )
          ctx.fillStyle = 'white'
          ctx.fillText(lengthText, xPos - textWidth / 2, rowTop + (h * 7) / 8)
        } else {
          fillRect(
            ctx,
            xPos - INSERTION_PADDING,
            rowTop,
            2 * INSERTION_PADDING,
            h,
            canvasWidth,
            'purple',
          )
        }
      } else {
        fillRect(ctx, xPos, rowTop, INSERTION_LINE_WIDTH, h, canvasWidth, 'purple')

        if (bpPerPx < HIGH_ZOOM_THRESHOLD && rowHeight > MIN_ROW_HEIGHT_FOR_BORDERS) {
          fillRect(
            ctx,
            xPos - INSERTION_BORDER_WIDTH,
            rowTop,
            INSERTION_BORDER_HEIGHT,
            INSERTION_LINE_WIDTH,
            canvasWidth,
          )
          fillRect(
            ctx,
            xPos - INSERTION_BORDER_WIDTH,
            rowTop + h - INSERTION_LINE_WIDTH,
            INSERTION_BORDER_HEIGHT,
            INSERTION_LINE_WIDTH,
            canvasWidth,
          )
        }
      }
    }
    genomicOffset++
  }
}
