import { resolveCellColor } from '../resolveCellColor.ts'
import { GAP_STROKE_OFFSET } from './types.ts'

import type { RenderingContext } from './types.ts'

const DASH = '-'.charCodeAt(0)

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
  const cfg = { colorForBase, showAllLetters, mismatchRendering }
  const len = alignment.length

  for (let i = 0, genomicOffset = 0; i < len; i++) {
    const refByte = seq.charCodeAt(i)
    if (refByte === DASH) {
      // Reference insertion — skipped here, drawn by renderInsertions.
      continue
    }
    const css = resolveCellColor(refByte, alignment.charCodeAt(i), cfg)
    if (css !== undefined) {
      ctx.fillStyle = css
      ctx.fillRect(leftPx + scale * genomicOffset, rowTop, cellW, h)
    }
    genomicOffset++
  }
}
