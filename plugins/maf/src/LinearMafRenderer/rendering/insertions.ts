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
const DASH = 45 // '-'.charCodeAt(0)
const SPACE = 32 // ' '.charCodeAt(0)

/**
 * Draw insertion markers between bp positions. The position just *before*
 * (in alignment iteration order) the post-insertion base is at the cell's
 * incoming edge — left edge in non-reversed, right edge when reversed.
 */
export function renderInsertions(
  context: RenderingContext,
  alignment: Uint8Array,
  seq: Uint8Array,
  startBp: number,
  rowTop: number,
  bpPerPx: number,
) {
  const { ctx, scale, h, rowHeight, reversed, palette, bpToCellLeftPx } =
    context
  const insertionFill = palette.insertionColor
  // Defensive min() mirrors mafInstanceBuffer.ts / rendering/bases.ts: if a
  // malformed file ships uneven lengths, the inner while would read past
  // alignment end and count out-of-bounds bytes as insertion bases, inflating
  // insLen past LARGE_INSERTION_THRESHOLD and switching to the wrong glyph.
  const len = Math.min(alignment.length, seq.length)

  for (let i = 0, genomicOffset = 0; i < len; i++) {
    let insLen = 0
    while (i < len && seq[i] === DASH) {
      const code = alignment[i]!
      if (code !== DASH && code !== SPACE) {
        insLen++
      }
      i++
    }
    if (insLen > 0) {
      const cellLeft = bpToCellLeftPx(startBp + genomicOffset)
      const anchorX = reversed ? cellLeft + scale : cellLeft
      const xPos = anchorX - INSERTION_LINE_WIDTH
      ctx.fillStyle = insertionFill

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
