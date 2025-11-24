import { bpSpanPx } from '@jbrowse/core/util'

import { CHEVRON_WIDTH } from '../../shared/util'
import {
  CIGAR_D_IDX,
  CIGAR_EQ_IDX,
  CIGAR_M_IDX,
  CIGAR_N_IDX,
  CIGAR_X_IDX,
  getCigarOps,
} from './cigarUtil'

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
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: ProcessedRenderArgs
}) {
  const { regions, bpPerPx } = renderArgs
  const { heightPx, topPx, feature } = feat
  const region = regions[0]!
  const s = feature.get('start')
  const e = feature.get('end')
  const CIGAR =
    feature.get('NUMERIC_CIGAR') || (feature.get('CIGAR') as string | undefined)
  const flip = region.reversed ? -1 : 1
  const strand = feature.get('strand') * flip
  const renderChevrons = bpPerPx < 10 && heightPx > 5

  // Check for skips (N operations)
  let hasSkips = false
  if (CIGAR) {
    if (typeof CIGAR === 'string') {
      hasSkips = CIGAR.includes('N')
    } else {
      for (let i = 0; i < CIGAR.length; i++) {
        if ((CIGAR[i]! & 0xf) === CIGAR_N_IDX) {
          hasSkips = true
          break
        }
      }
    }
  }

  if (hasSkips) {
    const cigarOps = getCigarOps(CIGAR!)
    const midY = topPx + heightPx / 2

    if (strand === 1) {
      let drawLen = 0
      let drawStart = s
      const opsLen = cigarOps.length

      for (let i = 0; i < opsLen; i++) {
        const packed = cigarOps[i]!
        const opLen = packed >> 4
        const op = packed & 0xf

        if (
          op === CIGAR_M_IDX ||
          op === CIGAR_X_IDX ||
          op === CIGAR_EQ_IDX ||
          op === CIGAR_D_IDX
        ) {
          drawLen += opLen
        } else if (op === CIGAR_N_IDX) {
          if (drawLen) {
            const [leftPx, rightPx] = bpSpanPx(
              drawStart,
              drawStart + drawLen,
              region,
              bpPerPx,
            )
            ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
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
          ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
        }
      }
    } else if (strand === -1) {
      let drawLen = 0
      let drawStart = e

      for (let i = cigarOps.length - 1; i >= 0; i--) {
        const packed = cigarOps[i]!
        const opLen = packed >> 4
        const op = packed & 0xf

        if (
          op === CIGAR_M_IDX ||
          op === CIGAR_X_IDX ||
          op === CIGAR_EQ_IDX ||
          op === CIGAR_D_IDX
        ) {
          drawLen += opLen
        } else if (op === CIGAR_N_IDX) {
          if (drawLen) {
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
          ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
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
      ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
    }
  }
}
