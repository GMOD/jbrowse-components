import { bpSpanPx } from '@jbrowse/core/util'
import { parseCigar } from '../MismatchParser'
import type { RenderArgsDeserialized } from './PileupRenderer'
import type { LayoutFeature } from './util'

export function renderAlignmentShape({
  ctx,
  feat,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: RenderArgsDeserialized
}) {
  const { regions, bpPerPx } = renderArgs
  const { heightPx, topPx, feature } = feat
  const region = regions[0]!
  const s = feature.get('start')
  const e = feature.get('end')
  const CIGAR = feature.get('CIGAR') as string | undefined
  const flip = region.reversed ? -1 : 1
  const strand = feature.get('strand') * flip
  const renderChevrons = bpPerPx < 10 && heightPx > 5
  if (CIGAR?.includes('N')) {
    const cigarOps = parseCigar(CIGAR)
    if (strand === 1) {
      let drawLen = 0
      let drawStart = s
      for (let i = 0; i < cigarOps.length; i += 2) {
        const opLen = +cigarOps[i]!
        const op = cigarOps[i + 1]!
        if (op === 'M' || op === 'X' || op === '=' || op === 'D') {
          drawLen += opLen
        } else if (op === 'N') {
          if (drawStart !== drawLen) {
            const [leftPx, rightPx] = bpSpanPx(
              drawStart,
              drawStart + drawLen,
              region,
              bpPerPx,
            )
            const w = rightPx - leftPx
            ctx.fillRect(leftPx, topPx, w, heightPx)
          }
          drawStart += drawLen + opLen
          drawLen = 0
        }
      }

      if (drawStart !== drawLen) {
        const [leftPx, rightPx] = bpSpanPx(
          drawStart,
          drawStart + drawLen,
          region,
          bpPerPx,
        )
        const w = rightPx - leftPx

        if (renderChevrons) {
          ctx.beginPath()
          ctx.moveTo(leftPx, topPx)
          ctx.lineTo(leftPx, topPx + heightPx)
          ctx.lineTo(rightPx, topPx + heightPx)
          ctx.lineTo(rightPx + 5, topPx + heightPx / 2)
          ctx.lineTo(rightPx, topPx)
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.fillRect(leftPx, topPx, w, heightPx)
        }
      }
    } else if (strand === -1) {
      let drawLen = 0
      let drawStart = e
      for (let i = cigarOps.length - 2; i >= 0; i -= 2) {
        const opLen = +cigarOps[i]!
        const op = cigarOps[i + 1]!
        if (op === 'M' || op === 'X' || op === '=' || op === 'D') {
          drawLen += opLen
        } else if (op === 'N') {
          if (drawLen !== 0) {
            const [leftPx, rightPx] = bpSpanPx(
              drawStart - drawLen,
              drawStart,
              region,
              bpPerPx,
            )
            ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
          }
          drawStart -= drawLen + opLen
          drawLen = 0
        }
      }

      if (drawLen !== 0) {
        const [leftPx, rightPx] = bpSpanPx(
          drawStart - drawLen,
          drawStart,
          region,
          bpPerPx,
        )
        const w = rightPx - leftPx

        if (renderChevrons) {
          ctx.beginPath()
          ctx.moveTo(leftPx - 5, topPx + heightPx / 2)
          ctx.lineTo(leftPx, topPx + heightPx)
          ctx.lineTo(rightPx, topPx + heightPx)
          ctx.lineTo(rightPx, topPx)
          ctx.lineTo(leftPx, topPx)
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.fillRect(leftPx, topPx, w, heightPx)
        }
      }
    }
  } else {
    const [leftPx, rightPx] = bpSpanPx(s, e, region, bpPerPx)
    if (bpPerPx < 10 && heightPx > 5) {
      if (strand === -1) {
        ctx.beginPath()
        ctx.moveTo(leftPx - 5, topPx + heightPx / 2)
        ctx.lineTo(leftPx, topPx + heightPx)
        ctx.lineTo(rightPx, topPx + heightPx)
        ctx.lineTo(rightPx, topPx)
        ctx.lineTo(leftPx, topPx)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(leftPx, topPx)
        ctx.lineTo(leftPx, topPx + heightPx)
        ctx.lineTo(rightPx, topPx + heightPx)
        ctx.lineTo(rightPx + 5, topPx + heightPx / 2)
        ctx.lineTo(rightPx, topPx)
        ctx.closePath()
        ctx.fill()
      }
    } else {
      ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
    }
  }
}
