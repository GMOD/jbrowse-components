import { getBaseColor, getTextColor } from './baseColors.ts'
import { CHAR_WIDTH, FONT, ROW_HEIGHT } from './constants.ts'

import type { Theme } from '@mui/material'

/**
 * Paint the visible window of the alignment grid. Cells are laid out relative
 * to `startRow`/`startCol` so the caller can position the canvas in content
 * space. Expects a context already scaled for devicePixelRatio, drawing in CSS
 * pixels.
 */
export function drawSequenceGrid({
  ctx,
  sequences,
  startRow,
  endRow,
  startCol,
  endCol,
  width,
  height,
  colorBackground,
  theme,
}: {
  ctx: CanvasRenderingContext2D
  sequences: string[]
  startRow: number
  endRow: number
  startCol: number
  endCol: number
  width: number
  height: number
  colorBackground: boolean
  theme: Theme
}) {
  ctx.fillStyle = theme.palette.background.paper
  ctx.fillRect(0, 0, width, height)

  ctx.font = FONT
  ctx.textBaseline = 'top'

  for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
    const seq = sequences[rowIdx] ?? ''
    const y = (rowIdx - startRow) * ROW_HEIGHT

    for (let colIdx = startCol; colIdx < endCol; colIdx++) {
      const char = seq[colIdx]
      if (char) {
        const x = (colIdx - startCol) * CHAR_WIDTH
        if (colorBackground && char !== '-' && char !== '.') {
          ctx.fillStyle = getBaseColor(char, theme)
          ctx.fillRect(x, y, CHAR_WIDTH, ROW_HEIGHT)
        }
        ctx.fillStyle = getTextColor(char, colorBackground, theme)
        ctx.fillText(char, x + 2, y + 2)
      }
    }
  }
}
