import { resolveCellColor } from '../resolveCellColor.ts'
import { GAP_STROKE_OFFSET } from './types.ts'

import type { RenderingContext } from './types.ts'

const DASH = '-'.charCodeAt(0)

export function renderBases(
  context: RenderingContext,
  alignment: string,
  seq: string,
  startBp: number,
  rowTop: number,
) {
  const {
    ctx,
    scale,
    h,
    palette,
    showAllLetters,
    mismatchRendering,
    bpToCellLeftPx,
  } = context
  const cellW = scale + GAP_STROKE_OFFSET
  const cfg = {
    colorForBase: palette.colorForBase,
    matchColor: palette.matchColor,
    gapColor: palette.gapColor,
    mismatchOffColor: palette.mismatchOffColor,
    unknownBaseColor: palette.unknownBaseColor,
    showAllLetters,
    mismatchRendering,
  }
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
      ctx.fillRect(bpToCellLeftPx(startBp + genomicOffset), rowTop, cellW, h)
    }
    genomicOffset++
  }
}
