import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from './cigarUtil.ts'

import type { LayoutFeature } from '../util.ts'
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
  cigarOps: ArrayLike<number>
}) {
  const heightLim = charHeight - 2
  const { feature, topPx, heightPx } = feat
  const seq = feature.get('seq') as string | undefined
  const invBpPerPx = 1 / bpPerPx
  const w = invBpPerPx
  const start = feature.get('start')
  let soffset = 0
  let roffset = 0

  if (!seq) {
    return
  }

  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed

  for (let i = 0, l = cigarOps.length; i < l; i++) {
    const packed = cigarOps[i]!
    const len = packed >> 4
    const op = packed & 0xf
    if (op === CIGAR_S || op === CIGAR_I) {
      soffset += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      roffset += len
    } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
      const opStart = start + roffset
      const opEnd = opStart + len

      // Early exit if we've passed the visible region
      if (opStart >= regionEnd) {
        break
      }

      // Skip if this op is entirely before visible region
      if (opEnd > regionStart) {
        // Calculate visible portion of this op
        const visStart = Math.max(0, regionStart - opStart)
        const visEnd = Math.min(len, regionEnd - opStart)

        for (let m = visStart; m < visEnd; m++) {
          const letter = seq[soffset + m]!
          const r = opStart + m
          const leftPx = reversed
            ? (regionEnd - r - 1) * invBpPerPx
            : (r - regionStart) * invBpPerPx
          ctx.fillStyle = colorMap[letter]!
          ctx.fillRect(leftPx, topPx, w + 0.5, heightPx)

          if (w >= charWidth && heightPx >= heightLim) {
            const x = leftPx + (w - charWidth) / 2 + 1
            const y = topPx + heightPx
            const color = colorContrastMap[letter]
            if (x >= 0 && x <= canvasWidth && color) {
              ctx.fillStyle = color
              ctx.fillText(letter, x, y)
            }
          }
        }
      }
      soffset += len
      roffset += len
    }
  }
}
