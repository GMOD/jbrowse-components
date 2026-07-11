import { bpToScreenPx } from '@jbrowse/render-core/canvas2dUtils'
import { appendPointMarker } from '@jbrowse/wiggle-core'

import { makeDensityRgbStringFn } from './getDensityColor.ts'
import { SCALE_TYPE_LOG } from './wiggleComponentUtils.ts'
import {
  WIGGLE_FUDGE_FACTOR,
  WIGGLE_MIN_PX,
  makeScoreNormalizer,
} from '../util.ts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

// One source's features painted into one block's row. Shared by every render
// mode; each mode adds its own color/size fields (see the per-fn args below).
// Built once per source per block, so spreading into it isn't a hot path.
interface RowDraw {
  ctx: Ctx2D
  source: SourceRenderData
  block: RenderBlock
  rowHeight: number
  rowTop: number
  domainY: [number, number]
  scaleType: number
}

function makeScoreToY(
  rowHeight: number,
  domainY: [number, number],
  scaleType: number,
) {
  const normalize = makeScoreNormalizer(
    domainY[0],
    domainY[1],
    scaleType === SCALE_TYPE_LOG,
  )
  return (score: number) => (1 - normalize(score)) * rowHeight
}

export function drawXYPlot({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  rgb,
}: RowDraw & { rgb: string }) {
  ctx.fillStyle = rgb
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  const originY = scoreToY(0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const { screenStartPx, screenEndPx, reversed, start, end } = block
  const n = source.numFeatures
  for (let i = 0; i < n; i++) {
    const x1 = bpToScreenPx(
      positions[i * 2]!,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      positions[i * 2 + 1]!,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const scoreY = scoreToY(scores[i]!) + rowTop
    const left = Math.min(x1, x2)
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + WIGGLE_FUDGE_FACTOR)
    // bar grows from the score baseline (originY) up or down to the score
    ctx.fillRect(left, Math.min(scoreY, originY), w, Math.abs(originY - scoreY))
  }
}

export function drawDensity({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  r,
  g,
  b,
}: RowDraw & { r: number; g: number; b: number }) {
  const colorFn = makeDensityRgbStringFn(
    domainY[0],
    domainY[1],
    scaleType === SCALE_TYPE_LOG,
    r,
    g,
    b,
  )
  const positions = source.featurePositions
  const scores = source.featureScores
  const { screenStartPx, screenEndPx, reversed, start, end } = block
  const n = source.numFeatures
  for (let i = 0; i < n; i++) {
    const x1 = bpToScreenPx(
      positions[i * 2]!,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      positions[i * 2 + 1]!,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const left = Math.min(x1, x2)
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + WIGGLE_FUDGE_FACTOR)
    ctx.fillStyle = colorFn(scores[i]!)
    ctx.fillRect(left, rowTop, w, rowHeight)
  }
}

// Single connected polyline per contiguous run of features. moveTo only at
// the start of a new run (first feature, or whenever there's a gap to the
// previous feature). Inside a run we lineTo through (x1,scoreY)→(x2,scoreY)
// for each feature; the implicit continuation between iterations draws the
// vertical step at the junction. Drop-to-zero is just another lineTo when
// the next feature is non-adjacent.
export function drawLine({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  rgb,
  lineWidth,
}: RowDraw & { rgb: string; lineWidth: number }) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.strokeStyle = rgb
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  const zeroY = scoreToY(0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const { screenStartPx, screenEndPx, reversed, start, end } = block

  let inRun = false
  for (let i = 0; i < n; i++) {
    const startBp = positions[i * 2]!
    const endBp = positions[i * 2 + 1]!
    const x1 = bpToScreenPx(
      startBp,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      endBp,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const scoreY = scoreToY(scores[i]!) + rowTop

    if (!inRun) {
      ctx.moveTo(x1, zeroY)
      ctx.lineTo(x1, scoreY)
      inRun = true
    } else {
      ctx.lineTo(x1, scoreY)
    }
    ctx.lineTo(x2, scoreY)

    const nextStartBp = i < n - 1 ? positions[(i + 1) * 2]! : -1
    const gapAfter = nextStartBp !== endBp
    if (gapAfter) {
      ctx.lineTo(x2, zeroY)
      inRun = false
    }
  }
  ctx.stroke()
}

export function drawScatter({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  rgb,
  pointSize,
}: RowDraw & { rgb: string; pointSize: number }) {
  ctx.fillStyle = rgb
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  const positions = source.featurePositions
  const scores = source.featureScores
  const { screenStartPx, screenEndPx, reversed, start, end } = block
  const n = source.numFeatures
  // Every feature draws as a point marker (square/disc via appendPointMarker)
  // centered on the bp midpoint. Mirrors the GPU wiggle.slang scatter branch.
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const x1 = bpToScreenPx(
      positions[i * 2]!,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      positions[i * 2 + 1]!,
      start,
      end,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const scoreY = scoreToY(scores[i]!) + rowTop
    const cx = (x1 + x2) / 2
    appendPointMarker(ctx, cx, scoreY, pointSize)
  }
  ctx.fill()
}
