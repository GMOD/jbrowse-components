import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { featurizeSA } from '../MismatchParser'
import {
  type CoreFeat,
  drawVerticalLine,
  extractCoreFeat,
  extractCoreFeatBasic,
  filterAndSortLongReadChain,
  filterPairedChain,
  getClipPos,
  getMateInfo,
  jitter,
  toCoreFeat,
  toCoreFeatBasic,
} from '../shared/arcUtils'
import {
  getPairedInsertSizeAndOrientationColor,
  getPairedInsertSizeColor,
  getPairedOrientationColor,
} from '../shared/color'
import { SAM_FLAG_MATE_UNMAPPED } from '../shared/samFlags'
import { hasPairedReads } from '../shared/util'

import type { ChainData, ColorBy } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

interface DrawFeatsRPCParams {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  chainData: ChainData
  colorBy: ColorBy
  drawInter: boolean
  drawLongRange: boolean
  lineWidth: number
  jitter: number
  view: {
    bpToPx: (arg: {
      refName: string
      coord: number
    }) => { offsetPx: number } | undefined
  }
  offsetPx: number
  stopToken?: string
}

export function drawFeatsRPC(params: DrawFeatsRPCParams) {
  const {
    ctx,
    height,
    chainData,
    colorBy,
    drawInter,
    drawLongRange,
    lineWidth,
    jitter: jitterVal,
    view,
    offsetPx,
    stopToken,
  } = params

  const { chains, stats } = chainData
  const colorByType = colorBy.type
  const hasPaired = hasPairedReads(chainData)

  ctx.lineWidth = lineWidth

  // Main draw function - kept as inner function to access closure variables
  function draw(k1: CoreFeat, k2: CoreFeat, longRange: boolean) {
    const s1 = k1.strand
    const s2 = k2.strand
    const f1 = s1 === -1
    const f2 = s2 === -1

    const p1 = f1 ? k1.start : k1.end
    const p2 = hasPaired ? (f2 ? k2.start : k2.end) : f2 ? k2.end : k2.start

    const r1 = view.bpToPx({ refName: k1.refName, coord: p1 })?.offsetPx
    const r2 = view.bpToPx({ refName: k2.refName, coord: p2 })?.offsetPx

    if (r1 !== undefined && r2 !== undefined) {
      const radius = (r2 - r1) / 2
      const absrad = Math.abs(radius)
      const p = r1 - offsetPx
      const pEnd = r2 - offsetPx
      const drawArcInsteadOfBezier = absrad > 10_000

      // Set up path - order of moveTo/beginPath matters for arc vs bezier
      if (longRange && drawArcInsteadOfBezier) {
        ctx.moveTo(p, 0)
        ctx.beginPath()
      } else {
        ctx.beginPath()
        ctx.moveTo(p, 0)
      }

      // Set stroke color
      if (longRange && drawArcInsteadOfBezier) {
        ctx.strokeStyle = 'red'
      } else if (hasPaired) {
        if (colorByType === 'insertSizeAndOrientation') {
          ctx.strokeStyle = getPairedInsertSizeAndOrientationColor(k1, stats)[0]
        } else if (colorByType === 'orientation') {
          ctx.strokeStyle = getPairedOrientationColor(k1)[0]
        } else if (colorByType === 'insertSize') {
          ctx.strokeStyle = getPairedInsertSizeColor(k1, stats)?.[0] || 'grey'
        } else if (colorByType === 'gradient') {
          ctx.strokeStyle = `hsl(${Math.log10(absrad) * 10},50%,50%)`
        }
      } else {
        // Long-read coloring
        if (
          colorByType === 'orientation' ||
          colorByType === 'insertSizeAndOrientation'
        ) {
          if (s1 === -1 && s2 === 1) {
            ctx.strokeStyle = 'navy'
          } else if (s1 === 1 && s2 === -1) {
            ctx.strokeStyle = 'green'
          } else {
            ctx.strokeStyle = 'grey'
          }
        } else if (colorByType === 'gradient') {
          ctx.strokeStyle = `hsl(${Math.log10(absrad) * 10},50%,50%)`
        }
      }

      // Draw the arc/bezier
      const destX = p + radius * 2
      const destY = Math.min(height + jitter(jitterVal), absrad)

      if (longRange) {
        if (absrad > 100_000) {
          // Very large arcs - draw vertical lines instead
          drawVerticalLine(ctx, p + jitter(jitterVal), height, 'red')
          drawVerticalLine(ctx, pEnd + jitter(jitterVal), height, 'red')
        } else if (drawArcInsteadOfBezier) {
          ctx.arc(p + radius + jitter(jitterVal), 0, absrad, 0, Math.PI)
          ctx.stroke()
        } else {
          ctx.bezierCurveTo(
            p + jitter(jitterVal),
            destY,
            destX,
            destY,
            destX + jitter(jitterVal),
            0,
          )
          ctx.stroke()
        }
      } else {
        ctx.bezierCurveTo(
          p + jitter(jitterVal),
          destY,
          destX,
          destY,
          destX + jitter(jitterVal),
          0,
        )
        ctx.stroke()
      }
    } else if (r1 && drawInter) {
      drawVerticalLine(ctx, r1 - offsetPx, height, 'purple')
    }
  }

  function drawSingletonPairedEnd(f: Feature) {
    draw(extractCoreFeat(f), getMateInfo(f), true)
  }

  function drawSingletonLongRead(f: Feature) {
    const saFeatures = featurizeSA(
      f.get('SA'),
      f.id(),
      f.get('strand'),
      f.get('name'),
    )
    const allFeatures = [f, ...saFeatures]
    allFeatures.sort((a, b) => getClipPos(a) - getClipPos(b))

    for (let i = 0, len = allFeatures.length; i < len - 1; i++) {
      draw(
        toCoreFeat(allFeatures[i]!),
        toCoreFeatBasic(allFeatures[i + 1]!),
        true,
      )
    }
  }

  function drawMultiFeatureChain(chain: Feature[]) {
    const filtered = hasPaired
      ? filterPairedChain(chain)
      : filterAndSortLongReadChain(chain)

    for (let i = 0, len = filtered.length; i < len - 1; i++) {
      draw(
        extractCoreFeat(filtered[i]!),
        extractCoreFeatBasic(filtered[i + 1]!),
        false,
      )
    }
  }

  forEachWithStopTokenCheck(chains, stopToken, chain => {
    if (chain.length === 1 && drawLongRange) {
      const f = chain[0]!
      const isMateUnmapped = f.get('flags') & SAM_FLAG_MATE_UNMAPPED

      if (hasPaired && !isMateUnmapped) {
        drawSingletonPairedEnd(f)
      } else {
        drawSingletonLongRead(f)
      }
    } else {
      drawMultiFeatureChain(chain)
    }
  })
}
