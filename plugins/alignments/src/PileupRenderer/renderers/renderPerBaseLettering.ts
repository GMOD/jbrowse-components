import { bpSpanPx } from '@jbrowse/core/util'

import { fillRect } from '../util'
import {
  CIGAR_D_IDX,
  CIGAR_EQ_IDX,
  CIGAR_I_IDX,
  CIGAR_M_IDX,
  CIGAR_N_IDX,
  CIGAR_S_IDX,
  CIGAR_X_IDX,
  getCigarOps,
} from './cigarUtil'

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
  cigarOps: Uint32Array | string
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
  const ops = getCigarOps(cigarOps)
  for (let i = 0; i < ops.length; i++) {
    const packed = ops[i]!
    const len = packed >> 4
    const op = packed & 0xf
    if (op === CIGAR_S_IDX || op === CIGAR_I_IDX) {
      soffset += len
    } else if (op === CIGAR_D_IDX || op === CIGAR_N_IDX) {
      roffset += len
    } else if (op === CIGAR_M_IDX || op === CIGAR_X_IDX || op === CIGAR_EQ_IDX) {
      for (let m = 0; m < len; m++) {
        const letter = seq[soffset + m]!
        const r = start + roffset + m
        const [leftPx] = bpSpanPx(r, r + 1, region, bpPerPx)
        const c = colorMap[letter]
        fillRect(ctx, leftPx, topPx, w + 0.5, heightPx, canvasWidth, c)

        if (w >= charWidth && heightPx >= heightLim) {
          // normal SNP coloring
          ctx.fillStyle = colorContrastMap[letter]!
          ctx.fillText(
            letter,
            leftPx + (w - charWidth) / 2 + 1,
            topPx + heightPx,
          )
        }
      }
      soffset += len
      roffset += len
    }
  }
}
