import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
  getCigarOps,
} from './cigarUtil'
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
  const CIGAR =
    (feature.get('NUMERIC_CIGAR') as Uint32Array | undefined) ||
    (feature.get('CIGAR') as string | undefined)
  const flip = region.reversed ? -1 : 1
  const strand = feature.get('strand') * flip
  const renderChevrons = bpPerPx < 10 && heightPx > 5

  ctx.fillStyle = color
  let hasSkips = false
  const cigarOps = CIGAR ? getCigarOps(CIGAR) : []
  for (let i = 0, l = cigarOps.length; i < l; i++) {
    if ((cigarOps[i]! & 0xf) === CIGAR_N) {
      hasSkips = true
      break
    }
  }

  // Check for skips (N operations)

  if (hasSkips) {
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
          op === CIGAR_M ||
          op === CIGAR_X ||
          op === CIGAR_EQ ||
          op === CIGAR_D
        ) {
          drawLen += opLen
        } else if (op === CIGAR_N) {
          if (drawLen) {
            const drawEnd = drawStart + drawLen
            const leftPx = region.reversed
              ? (region.end - drawEnd) / bpPerPx
              : (drawStart - region.start) / bpPerPx
            const rightPx = region.reversed
              ? (region.end - drawStart) / bpPerPx
              : (drawEnd - region.start) / bpPerPx
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
        const drawEnd = drawStart + drawLen
        const leftPx = region.reversed
          ? (region.end - drawEnd) / bpPerPx
          : (drawStart - region.start) / bpPerPx
        const rightPx = region.reversed
          ? (region.end - drawStart) / bpPerPx
          : (drawEnd - region.start) / bpPerPx

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

      for (let i = cigarOps.length - 1; i >= 0; i--) {
        const packed = cigarOps[i]!
        const opLen = packed >> 4
        const op = packed & 0xf

        if (
          op === CIGAR_M ||
          op === CIGAR_X ||
          op === CIGAR_EQ ||
          op === CIGAR_D
        ) {
          drawLen += opLen
        } else if (op === CIGAR_N) {
          if (drawLen) {
            const drawBegin = drawStart - drawLen
            const leftPx = region.reversed
              ? (region.end - drawStart) / bpPerPx
              : (drawBegin - region.start) / bpPerPx
            const rightPx = region.reversed
              ? (region.end - drawBegin) / bpPerPx
              : (drawStart - region.start) / bpPerPx
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
        const drawBegin = drawStart - drawLen
        const leftPx = region.reversed
          ? (region.end - drawStart) / bpPerPx
          : (drawBegin - region.start) / bpPerPx
        const rightPx = region.reversed
          ? (region.end - drawBegin) / bpPerPx
          : (drawStart - region.start) / bpPerPx

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
    const leftPx = region.reversed
      ? (region.end - e) / bpPerPx
      : (s - region.start) / bpPerPx
    const rightPx = region.reversed
      ? (region.end - s) / bpPerPx
      : (e - region.start) / bpPerPx
    const midY = topPx + heightPx / 2

    if (renderChevrons) {
      if (strand === -1) {
        drawReverseChevron(ctx, leftPx, rightPx, topPx, heightPx, midY)
      } else {
        drawForwardChevron(ctx, leftPx, rightPx, topPx, heightPx, midY)
      }
    } else {
      fillRectCtx(ctx, leftPx, topPx, rightPx - leftPx, heightPx, canvasWidth)
    }
  }
}
