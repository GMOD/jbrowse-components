import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

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

import type { ChainData, ChainStats, ColorBy } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

// Arc rendering thresholds
const ARC_VS_BEZIER_THRESHOLD = 10_000
const VERTICAL_LINE_THRESHOLD = 100_000
const GRADIENT_HSL_SATURATION = 50
const GRADIENT_HSL_LIGHTNESS = 50

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

/**
 * Get the arc endpoint coordinate based on strand direction.
 * For forward strand (+1), use the end position.
 * For reverse strand (-1), use the start position.
 */
function getArcEndpoint(
  feat: CoreFeat,
  isPairedEnd: boolean,
  isMate: boolean,
): number {
  const isReverse = feat.strand === -1
  if (isPairedEnd) {
    return isReverse ? feat.start : feat.end
  }
  // For long reads, the second feature uses opposite logic
  return isMate ? (isReverse ? feat.end : feat.start) : (isReverse ? feat.start : feat.end)
}

/**
 * Get the stroke color for an arc based on color mode and read type.
 */
function getArcStrokeColor(params: {
  longRange: boolean
  drawArcInsteadOfBezier: boolean
  hasPaired: boolean
  colorByType: string
  k1: CoreFeat
  s1: number
  s2: number
  absrad: number
  stats?: ChainStats
}): string {
  const {
    longRange,
    drawArcInsteadOfBezier,
    hasPaired,
    colorByType,
    k1,
    s1,
    s2,
    absrad,
    stats,
  } = params

  // Long range arcs drawn as actual arcs (not bezier) are red
  if (longRange && drawArcInsteadOfBezier) {
    return 'red'
  }

  // Paired-end read coloring
  if (hasPaired) {
    if (colorByType === 'insertSizeAndOrientation') {
      return getPairedInsertSizeAndOrientationColor(k1, stats)[0]
    }
    if (colorByType === 'orientation') {
      return getPairedOrientationColor(k1)[0]
    }
    if (colorByType === 'insertSize') {
      return getPairedInsertSizeColor(k1, stats)?.[0] || 'grey'
    }
    if (colorByType === 'gradient') {
      return `hsl(${Math.log10(absrad) * 10},${GRADIENT_HSL_SATURATION}%,${GRADIENT_HSL_LIGHTNESS}%)`
    }
    return 'grey'
  }

  // Long-read coloring
  if (colorByType === 'orientation' || colorByType === 'insertSizeAndOrientation') {
    if (s1 === -1 && s2 === 1) {
      return 'navy'
    }
    if (s1 === 1 && s2 === -1) {
      return 'green'
    }
    return 'grey'
  }
  if (colorByType === 'gradient') {
    return `hsl(${Math.log10(absrad) * 10},${GRADIENT_HSL_SATURATION}%,${GRADIENT_HSL_LIGHTNESS}%)`
  }
  return 'grey'
}

/**
 * Draw a bezier curve arc between two points.
 */
function drawBezierArc(
  ctx: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  destY: number,
  jitterVal: number,
) {
  ctx.beginPath()
  ctx.moveTo(startX, 0)
  ctx.bezierCurveTo(
    startX + jitter(jitterVal),
    destY,
    endX,
    destY,
    endX + jitter(jitterVal),
    0,
  )
  ctx.stroke()
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

  function draw(k1: CoreFeat, k2: CoreFeat, longRange: boolean) {
    const s1 = k1.strand
    const s2 = k2.strand

    const p1 = getArcEndpoint(k1, hasPaired, false)
    const p2 = getArcEndpoint(k2, hasPaired, true)

    const r1 = view.bpToPx({ refName: k1.refName, coord: p1 })?.offsetPx
    const r2 = view.bpToPx({ refName: k2.refName, coord: p2 })?.offsetPx

    if (r1 !== undefined && r2 !== undefined) {
      const radius = (r2 - r1) / 2
      const absrad = Math.abs(radius)
      const p = r1 - offsetPx
      const pEnd = r2 - offsetPx
      const drawArcInsteadOfBezier = absrad > ARC_VS_BEZIER_THRESHOLD

      ctx.strokeStyle = getArcStrokeColor({
        longRange,
        drawArcInsteadOfBezier,
        hasPaired,
        colorByType,
        k1,
        s1,
        s2,
        absrad,
        stats,
      })

      const destY = Math.min(height + jitter(jitterVal), absrad)

      if (absrad < 1) {
        // Very small arcs - draw a simple rectangle
        ctx.fillStyle = ctx.strokeStyle
        ctx.fillRect(p, 0, pEnd - p, Math.max(absrad, lineWidth))
      } else if (longRange && absrad > VERTICAL_LINE_THRESHOLD) {
        // Very large arcs - draw vertical lines instead
        drawVerticalLine(ctx, p + jitter(jitterVal), height, 'red')
        drawVerticalLine(ctx, pEnd + jitter(jitterVal), height, 'red')
      } else if (longRange && drawArcInsteadOfBezier) {
        // Large arcs - use actual arc for better rendering
        ctx.moveTo(p, 0)
        ctx.beginPath()
        ctx.arc(p + radius + jitter(jitterVal), 0, absrad, 0, Math.PI)
        ctx.stroke()
      } else {
        // Normal arcs - use bezier curve
        drawBezierArc(ctx, p, p + radius * 2, destY, jitterVal)
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

  const lastCheck = { time: Date.now() }
  let idx = 0
  for (const chain of chains) {
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
    checkStopToken2(stopToken, idx++, lastCheck)
  }
}
