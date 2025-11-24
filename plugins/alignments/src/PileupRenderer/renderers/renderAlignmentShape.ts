import { bpSpanPx } from '@jbrowse/core/util'

import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
  parseCigar2,
} from '../../MismatchParser'
import { CHEVRON_WIDTH } from '../../shared/util'
import { fillRectCtx } from '../util'

import type { ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'

// Helper to draw forward strand chevron
function drawForwardChevron(
  ctx: CanvasRenderingContext2D,
  leftPx: number,
  rightPx: number,
  topPx: number,
  heightPx: number,
  midY: number,
) {
  ctx.beginPath()
  ctx.moveTo(leftPx, topPx)
  ctx.lineTo(leftPx, topPx + heightPx)
  ctx.lineTo(rightPx, topPx + heightPx)
  ctx.lineTo(rightPx + CHEVRON_WIDTH, midY)
  ctx.lineTo(rightPx, topPx)
  ctx.closePath()
  ctx.fill()
}

// Helper to draw reverse strand chevron
function drawReverseChevron(
  ctx: CanvasRenderingContext2D,
  leftPx: number,
  rightPx: number,
  topPx: number,
  heightPx: number,
  midY: number,
) {
  ctx.beginPath()
  ctx.moveTo(leftPx - CHEVRON_WIDTH, midY)
  ctx.lineTo(leftPx, topPx + heightPx)
  ctx.lineTo(rightPx, topPx + heightPx)
  ctx.lineTo(rightPx, topPx)
  ctx.lineTo(leftPx, topPx)
  ctx.closePath()
  ctx.fill()
}

export function renderAlignmentShape({
  ctx,
  feat,
  renderArgs,
  canvasWidth,
  color,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: ProcessedRenderArgs
  canvasWidth: number
  color: string
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
  const hasSkips = CIGAR?.includes('N')

  ctx.fillStyle = color

  if (hasSkips) {
    const cigarOps = parseCigar2(CIGAR)
    const midY = topPx + heightPx / 2

    if (strand === 1) {
      let drawLen = 0
      let drawStart = s
      const opsLen = cigarOps.length

      for (let i = 0; i < opsLen; i += 2) {
        const opLen = cigarOps[i]!
        const op = cigarOps[i + 1]!

        if (
          op === CIGAR_M ||
          op === CIGAR_X ||
          op === CIGAR_EQ ||
          op === CIGAR_D
        ) {
          drawLen += opLen
        } else if (op === CIGAR_N) {
          if (drawLen) {
            const [leftPx, rightPx] = bpSpanPx(
              drawStart,
              drawStart + drawLen,
              region,
              bpPerPx,
            )
            fillRectCtx(
              ctx,
              leftPx,
              topPx,
              rightPx - leftPx,
              heightPx,
              canvasWidth,
            )
          }
          drawStart += drawLen + opLen
          drawLen = 0
        }
      }

      if (drawLen) {
        const [leftPx, rightPx] = bpSpanPx(
          drawStart,
          drawStart + drawLen,
          region,
          bpPerPx,
        )

        if (renderChevrons) {
          drawForwardChevron(ctx, leftPx, rightPx, topPx, heightPx, midY)
        } else {
          fillRectCtx(
            ctx,
            leftPx,
            topPx,
            rightPx - leftPx,
            heightPx,
            canvasWidth,
          )
        }
      }
    } else if (strand === -1) {
      let drawLen = 0
      let drawStart = e

      for (let i = cigarOps.length - 2; i >= 0; i -= 2) {
        const opLen = cigarOps[i]!
        const op = cigarOps[i + 1]!

        if (
          op === CIGAR_M ||
          op === CIGAR_X ||
          op === CIGAR_EQ ||
          op === CIGAR_D
        ) {
          drawLen += opLen
        } else if (op === CIGAR_N) {
          if (drawLen) {
            const [leftPx, rightPx] = bpSpanPx(
              drawStart - drawLen,
              drawStart,
              region,
              bpPerPx,
            )
            fillRectCtx(
              ctx,
              leftPx,
              topPx,
              rightPx - leftPx,
              heightPx,
              canvasWidth,
            )
          }
          drawStart -= drawLen + opLen
          drawLen = 0
        }
      }

      if (drawLen) {
        const [leftPx, rightPx] = bpSpanPx(
          drawStart - drawLen,
          drawStart,
          region,
          bpPerPx,
        )

        if (renderChevrons) {
          drawReverseChevron(ctx, leftPx, rightPx, topPx, heightPx, midY)
        } else {
          fillRectCtx(
            ctx,
            leftPx,
            topPx,
            rightPx - leftPx,
            heightPx,
            canvasWidth,
          )
        }
      }
    }
  } else {
    const [leftPx, rightPx] = bpSpanPx(s, e, region, bpPerPx)
    const midY = topPx + heightPx / 2

    if (renderChevrons) {
      if (strand === -1) {
        drawReverseChevron(ctx, leftPx, rightPx, topPx, heightPx, midY)
      } else {
        drawForwardChevron(ctx, leftPx, rightPx, topPx, heightPx, midY)
      }
    } else {
      fillRectCtx(
        ctx,
        leftPx,
        topPx,
        rightPx - leftPx,
        heightPx,
        canvasWidth,
      )
    }
  }
}
