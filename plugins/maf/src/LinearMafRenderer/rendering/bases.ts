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
  const cfg = { ...palette, showAllLetters, mismatchRendering }
  // Defensive min() — `seq.charCodeAt(i)` returns NaN past the end and the
  // bitwise match check in resolveCellColor would silently mis-classify
  // those cells (NaN | 0x20 === 0x20 collides with everything).
  const len = Math.min(alignment.length, seq.length)

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
