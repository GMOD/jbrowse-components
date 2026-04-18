import {
  bpToScreenX,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import { WIGGLE_FUDGE_FACTOR, makeScoreNormalizer } from '../util.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  SCALE_TYPE_LOG,
} from './wiggleComponentUtils.ts'
import { computeNumRows } from './wiggleInstanceBuffer.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'

interface Canvas2DRegionData {
  regionStart: number
  sources: SourceRenderData[]
  numRows: number
}

interface FeatureBounds {
  x1: number
  x2: number
  score: number
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

function featureAt(
  source: SourceRenderData,
  i: number,
  regionStart: number,
  block: WiggleRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
): FeatureBounds {
  const startBp = source.featurePositions[i * 2]! + regionStart
  const endBp = source.featurePositions[i * 2 + 1]! + regionStart
  return {
    x1: bpToScreenX(startBp, block, bpLength, fullBlockWidth),
    x2: bpToScreenX(endBp, block, bpLength, fullBlockWidth),
    score: source.featureScores[i]!,
  }
}

function drawXYPlot(
  ctx: CanvasRenderingContext2D,
  source: SourceRenderData,
  regionStart: number,
  block: WiggleRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  ctx.fillStyle = rgb
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  const originY = scoreToY(0) + rowTop
  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, regionStart, block, bpLength, fullBlockWidth)
    const scoreY = scoreToY(f.score) + rowTop
    const w = Math.max(1.5, f.x2 - f.x1 + WIGGLE_FUDGE_FACTOR)
    const h = originY - scoreY
    if (h >= 0) {
      ctx.fillRect(f.x1, scoreY, w, h)
    } else {
      ctx.fillRect(f.x1, originY, w, -h)
    }
  }
}

function drawDensity(
  ctx: CanvasRenderingContext2D,
  source: SourceRenderData,
  regionStart: number,
  block: WiggleRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  r: number,
  g: number,
  b: number,
) {
  const normalize = makeScoreNormalizer(
    domainY[0],
    domainY[1],
    scaleType === SCALE_TYPE_LOG,
  )
  const zeroNorm = normalize(0)
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  const invMaxDist = maxDist > 0.0001 ? 1 / maxDist : 0
  const rDelta = r - 255
  const gDelta = g - 255
  const bDelta = b - 255

  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, regionStart, block, bpLength, fullBlockWidth)
    const w = Math.max(1.5, f.x2 - f.x1 + WIGGLE_FUDGE_FACTOR)
    const t = Math.abs(normalize(f.score) - zeroNorm) * invMaxDist
    const cr = (255 + rDelta * t) | 0
    const cg = (255 + gDelta * t) | 0
    const cb = (255 + bDelta * t) | 0
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`
    ctx.fillRect(f.x1, rowTop, w, rowHeight)
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  source: SourceRenderData,
  regionStart: number,
  block: WiggleRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  if (source.numFeatures === 0) {
    return
  }
  ctx.strokeStyle = rgb
  ctx.lineWidth = 1
  ctx.beginPath()
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)

  let prevY = scoreToY(source.featureScores[0]!) + rowTop
  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, regionStart, block, bpLength, fullBlockWidth)
    const scoreY = scoreToY(f.score) + rowTop
    if (i > 0) {
      ctx.moveTo(f.x1, prevY)
      ctx.lineTo(f.x1, scoreY)
    }
    ctx.moveTo(f.x1, scoreY)
    ctx.lineTo(f.x2, scoreY)
    prevY = scoreY
  }
  ctx.stroke()
}

function drawScatter(
  ctx: CanvasRenderingContext2D,
  source: SourceRenderData,
  regionStart: number,
  block: WiggleRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  ctx.fillStyle = rgb
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, regionStart, block, bpLength, fullBlockWidth)
    const scoreY = scoreToY(f.score) + rowTop
    const w = Math.max(1.5, f.x2 - f.x1)
    ctx.fillRect(f.x1, scoreY - 1, w, 2)
  }
}

export function Canvas2DWiggleRenderer(
  canvas: HTMLCanvasElement,
): WiggleBackend {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context not available')
  }
  const regions = new Map<number, Canvas2DRegionData>()

  return {
    uploadRegion(regionNumber, regionStart, sources) {
      let totalFeatures = 0
      for (const source of sources) {
        totalFeatures += source.numFeatures
      }
      if (totalFeatures === 0 || sources.length === 0) {
        regions.delete(regionNumber)
        return
      }
      regions.set(regionNumber, {
        regionStart,
        sources,
        numRows: computeNumRows(sources),
      })
    },

    renderBlocks(blocks, renderState) {
      const { canvasWidth, canvasHeight, renderingType, scaleType, domainY } =
        renderState
      prepareCanvas(canvas, ctx, canvasWidth, canvasHeight)

      for (const block of blocks) {
        const region = regions.get(block.regionNumber)
        if (!region || region.sources.length === 0) {
          continue
        }
        const clip = clipBlockForCanvas(block, canvasWidth)
        if (!clip) {
          continue
        }
        const { fullBlockWidth, bpLength } = clip

        ctx.save()
        ctx.beginPath()
        ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
        ctx.clip()

        const rowHeight = canvasHeight / region.numRows

        for (const source of region.sources) {
          const rowTop = source.rowIndex * rowHeight
          const r = Math.round(source.color[0] * 255)
          const g = Math.round(source.color[1] * 255)
          const b = Math.round(source.color[2] * 255)
          const rgb = `rgb(${r},${g},${b})`

          if (renderingType === RENDERING_TYPE_LINE) {
            drawLine(
              ctx,
              source,
              region.regionStart,
              block,
              bpLength,
              fullBlockWidth,
              rowHeight,
              rowTop,
              domainY,
              scaleType,
              rgb,
            )
          } else if (renderingType === RENDERING_TYPE_DENSITY) {
            drawDensity(
              ctx,
              source,
              region.regionStart,
              block,
              bpLength,
              fullBlockWidth,
              rowHeight,
              rowTop,
              domainY,
              scaleType,
              r,
              g,
              b,
            )
          } else if (renderingType === RENDERING_TYPE_SCATTER) {
            drawScatter(
              ctx,
              source,
              region.regionStart,
              block,
              bpLength,
              fullBlockWidth,
              rowHeight,
              rowTop,
              domainY,
              scaleType,
              rgb,
            )
          } else {
            drawXYPlot(
              ctx,
              source,
              region.regionStart,
              block,
              bpLength,
              fullBlockWidth,
              rowHeight,
              rowTop,
              domainY,
              scaleType,
              rgb,
            )
          }
        }
        ctx.restore()
      }
    },

    pruneRegions(activeRegions) {
      pruneRegionMap(regions, activeRegions)
    },

    dispose() {
      regions.clear()
    },
  }
}
