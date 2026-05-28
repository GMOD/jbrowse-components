import { DASH } from '../../util/asciiBytes.ts'
import { resolveCellColor } from '../resolveCellColor.ts'
import { GAP_STROKE_OFFSET } from './types.ts'

import type { RenderingContext } from './types.ts'

export function renderBases(
  context: RenderingContext,
  alignment: Uint8Array,
  seq: Uint8Array,
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
  // Defensive min() guards against malformed files where worker output ships
  // uneven lengths; without it `seq[i]` past the end is undefined and the
  // bitwise match check in resolveCellColor silently mis-classifies cells.
  const len = Math.min(alignment.length, seq.length)

  for (let i = 0, genomicOffset = 0; i < len; i++) {
    const refByte = seq[i]!
    if (refByte === DASH) {
      // Reference insertion — skipped here, drawn by renderInsertions.
      continue
    }
    const css = resolveCellColor(refByte, alignment[i]!, cfg)
    if (css !== undefined) {
      ctx.fillStyle = css
      ctx.fillRect(bpToCellLeftPx(startBp + genomicOffset), rowTop, cellW, h)
    }
    genomicOffset++
  }
}
