import { bpSpanPx } from '@jbrowse/core/util'
import { fillRect } from './util'
import type { LayoutFeature } from './util'
import type { Region } from '@jbrowse/core/util'

export function renderPerBaseLettering({
  ctx,
  feat,
  region,
  bpPerPx,
  colorForBase,
  contrastForBase,
  charWidth,
  charHeight,
  canvasWidth,
  cigarOps,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  colorForBase: Record<string, string>
  contrastForBase: Record<string, string>
  charWidth: number
  charHeight: number
  canvasWidth: number
  cigarOps: string[]
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
    const len = +cigarOps[i]!
    const op = cigarOps[i + 1]!
    if (op === 'S' || op === 'I') {
      soffset += len
    } else if (op === 'D' || op === 'N') {
      roffset += len
    } else if (op === 'M' || op === 'X' || op === '=') {
      for (let m = 0; m < len; m++) {
        const letter = seq[soffset + m]!
        const r = start + roffset + m
        const [leftPx] = bpSpanPx(r, r + 1, region, bpPerPx)
        const c = colorForBase[letter]
        fillRect(ctx, leftPx, topPx, w + 0.5, heightPx, canvasWidth, c)

        if (w >= charWidth && heightPx >= heightLim) {
          // normal SNP coloring
          ctx.fillStyle = contrastForBase[letter]!
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
