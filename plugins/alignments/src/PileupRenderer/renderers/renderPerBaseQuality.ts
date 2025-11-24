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

export function renderPerBaseQuality({
  ctx,
  feat,
  region,
  bpPerPx,
  canvasWidth,
  cigarOps,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  canvasWidth: number
  cigarOps: Uint32Array | string
}) {
  const { feature, topPx, heightPx } = feat
  const qual: string = feature.get('qual') || ''
  const scores = qual.split(' ').map(val => +val)
  const w = 1 / bpPerPx
  const start = feature.get('start')
  let soffset = 0 // sequence offset
  let roffset = 0 // reference offset

  const ops = getCigarOps(cigarOps)
  for (const op of ops) {
    const packed = op
    const len = packed >> 4
    const opIdx = packed & 0xf
    if (opIdx === CIGAR_S_IDX || opIdx === CIGAR_I_IDX) {
      soffset += len
    } else if (opIdx === CIGAR_D_IDX || opIdx === CIGAR_N_IDX) {
      roffset += len
    } else if (
      opIdx === CIGAR_M_IDX ||
      opIdx === CIGAR_X_IDX ||
      opIdx === CIGAR_EQ_IDX
    ) {
      for (let m = 0; m < len; m++) {
        const score = scores[soffset + m]!
        const start0 = start + roffset + m
        const leftPx = bpSpanPx(start0, start0 + 1, region, bpPerPx)[0]
        const c = `hsl(${score === 255 ? 150 : score * 1.5},55%,50%)`
        fillRect(ctx, leftPx, topPx, w + 0.5, heightPx, canvasWidth, c)
      }
      soffset += len
      roffset += len
    }
  }
}
