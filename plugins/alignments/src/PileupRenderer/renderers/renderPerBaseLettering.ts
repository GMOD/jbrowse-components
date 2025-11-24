import { bpSpanPx } from '@jbrowse/core/util'

import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '../../MismatchParser'
import { fillRectCtx, fillTextCtx } from '../util'

import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

export function renderPerBaseLettering({
  ctx,
  feat,
  region,
  bpPerPx,
  colorMap,
  colorContrastMap,
  charWidth,
  charHeight,
  canvasWidth,
  cigarOps,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  colorMap: Record<string, string>
  colorContrastMap: Record<string, string>
  charWidth: number
  charHeight: number
  canvasWidth: number
  cigarOps: number[]
}) {
  const heightLim = charHeight - 2
  const { feature, topPx, heightPx } = feat
  const seq = feature.get('seq') as string | undefined
  const w = 1 / bpPerPx
  const start = feature.get('start')
  let soffset = 0
  let roffset = 0

  if (!seq) {
    return
  }
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = cigarOps[i]!
    const op = cigarOps[i + 1]!
    if (op === CIGAR_S || op === CIGAR_I) {
      soffset += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      roffset += len
    } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
      for (let m = 0; m < len; m++) {
        const letter = seq[soffset + m]!
        const r = start + roffset + m
        const [leftPx] = bpSpanPx(r, r + 1, region, bpPerPx)
        const c = colorMap[letter]
        fillRectCtx(ctx, leftPx, topPx, w + 0.5, heightPx, canvasWidth, c)

        if (w >= charWidth && heightPx >= heightLim) {
          fillTextCtx(
            ctx,
            letter,
            leftPx + (w - charWidth) / 2 + 1,
            topPx + heightPx,
            canvasWidth,
            colorContrastMap[letter],
          )
        }
      }
      soffset += len
      roffset += len
    }
  }
}
