import { bpSpanPx, Region } from '@jbrowse/core/util'
import { parseCigar } from '../MismatchParser'
import { fillRect, LayoutFeature } from './util'

export function renderPerBaseQuality({
  ctx,
  feat,
  region,
  bpPerPx,
  canvasWidth,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  canvasWidth: number
}) {
  const { feature, topPx, heightPx } = feat
  const qual: string = feature.get('qual') || ''
  const scores = qual.split(' ').map(val => +val)
  const cigarOps = parseCigar(feature.get('CIGAR'))
  const w = 1 / bpPerPx
  const start = feature.get('start')
  let soffset = 0 // sequence offset
  let roffset = 0 // reference offset

  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op === 'S' || op === 'I') {
      soffset += len
    } else if (op === 'D' || op === 'N') {
      roffset += len
    } else if (op === 'M' || op === 'X' || op === '=') {
      for (let m = 0; m < len; m++) {
        const score = scores[soffset + m]
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
