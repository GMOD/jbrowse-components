import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from './cigarUtil'

import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

// Pre-cached HSL color strings for quality scores 0-255
const qualityColors: string[] = Array.from(
  { length: 256 },
  (_, score) => `hsl(${score === 255 ? 150 : score * 1.5},55%,50%)`,
)

export function renderPerBaseQuality({
  ctx,
  feat,
  region,
  bpPerPx,
  cigarOps,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  cigarOps: ArrayLike<number>
}) {
  const { feature, topPx, heightPx } = feat
  const qual: string = feature.get('qual') || ''
  const scores = qual.split(' ').map(val => +val)
  const invBpPerPx = 1 / bpPerPx
  const w = invBpPerPx
  const start = feature.get('start')
  let soffset = 0
  let roffset = 0

  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed

  for (let i = 0, l = cigarOps.length; i < l; i++) {
    const packed = cigarOps[i]!
    const len = packed >> 4
    const opIdx = packed & 0xf
    if (opIdx === CIGAR_S || opIdx === CIGAR_I) {
      soffset += len
    } else if (opIdx === CIGAR_D || opIdx === CIGAR_N) {
      roffset += len
    } else if (opIdx === CIGAR_M || opIdx === CIGAR_X || opIdx === CIGAR_EQ) {
      const opStart = start + roffset
      const opEnd = opStart + len

      if (opStart >= regionEnd) {
        break
      }

      if (opEnd > regionStart) {
        const visStart = Math.max(0, regionStart - opStart)
        const visEnd = Math.min(len, regionEnd - opStart)

        for (let m = visStart; m < visEnd; m++) {
          const score = scores[soffset + m]!
          const refPos = opStart + m
          const leftPx = reversed
            ? (regionEnd - refPos - 1) * invBpPerPx
            : (refPos - regionStart) * invBpPerPx
          ctx.fillStyle = qualityColors[score] || qualityColors[0]!
          ctx.fillRect(leftPx, topPx, w + 0.5, heightPx)
        }
      }
      soffset += len
      roffset += len
    }
  }
}
