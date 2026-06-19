import { bpToScreenPx } from '@jbrowse/render-core/canvas2dUtils'

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

export function drawXYPlot(
  ctx: Ctx2D,
  source: SourceRenderData,
  block: RenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
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
    const h = originY - scoreY
    if (h >= 0) {
      ctx.fillRect(left, scoreY, w, h)
    } else {
      ctx.fillRect(left, originY, w, -h)
    }
  }
}

export function drawDensity(
  ctx: Ctx2D,
  source: SourceRenderData,
  block: RenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  r: number,
  g: number,
  b: number,
) {
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
export function drawLine(
  ctx: Ctx2D,
  source: SourceRenderData,
  block: RenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.strokeStyle = rgb
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

export function drawScatter(
  ctx: Ctx2D,
  source: SourceRenderData,
  block: RenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
  pointSize: number,
) {
  ctx.fillStyle = rgb
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  const positions = source.featurePositions
  const scores = source.featureScores
  const { screenStartPx, screenEndPx, reversed, start, end } = block
  const n = source.numFeatures
  const halfPoint = pointSize / 2
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
    ctx.fillRect(left, scoreY - halfPoint, w, pointSize)
  }
}
