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
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'

interface Canvas2DRegionData {
  regionStart: number
  sources: SourceRenderData[]
  numRows: number
}

interface DrawParams {
  ctx: CanvasRenderingContext2D
  source: SourceRenderData
  regionStart: number
  block: WiggleRenderBlock
  bpLength: number
  fullBlockWidth: number
  rowHeight: number
  rowTop: number
  domainY: [number, number]
  scaleType: number
  r: number
  g: number
  b: number
}

export class Canvas2DWiggleRenderer implements WiggleBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions = new Map<number, Canvas2DRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }
    if (totalFeatures === 0 || sources.length === 0) {
      this.regions.delete(regionNumber)
      return
    }

    this.regions.set(regionNumber, {
      regionStart,
      sources,
      numRows: computeNumRows(sources),
    })
  }

  renderBlocks(blocks: WiggleRenderBlock[], renderState: WiggleGPURenderState) {
    const { canvasWidth, canvasHeight, renderingType, scaleType, domainY } =
      renderState

    const ctx = this.ctx
    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
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

      const numRows = region.numRows
      const rowHeight = canvasHeight / numRows

      for (const source of region.sources) {
        const row = source.rowIndex
        const [r, g, b] = source.color
        const params: DrawParams = {
          ctx,
          source,
          regionStart: region.regionStart,
          block,
          bpLength,
          fullBlockWidth,
          rowHeight,
          rowTop: row * rowHeight,
          domainY,
          scaleType,
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255),
        }

        if (renderingType === RENDERING_TYPE_LINE) {
          this.drawLine(params)
        } else if (renderingType === RENDERING_TYPE_DENSITY) {
          this.drawDensity(params)
        } else if (renderingType === RENDERING_TYPE_SCATTER) {
          this.drawScatter(params)
        } else {
          this.drawXYPlot(params)
        }
      }

      ctx.restore()
    }
  }

  private makeScoreToY(p: DrawParams) {
    const { rowHeight, domainY, scaleType } = p
    const normalize = makeScoreNormalizer(
      domainY[0],
      domainY[1],
      scaleType === SCALE_TYPE_LOG,
    )
    return (score: number) => (1 - normalize(score)) * rowHeight
  }

  private drawXYPlot(p: DrawParams) {
    const { ctx, source, regionStart, block, bpLength, fullBlockWidth } = p
    const { rowTop, r, g, b } = p
    ctx.fillStyle = `rgb(${r},${g},${b})`
    const scoreToY = this.makeScoreToY(p)
    const originY = scoreToY(0) + rowTop

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY = scoreToY(source.featureScores[i]!) + rowTop
      const w = Math.max(1.5, x2 - x1 + WIGGLE_FUDGE_FACTOR)
      const h = originY - scoreY
      if (h >= 0) {
        ctx.fillRect(x1, scoreY, w, h)
      } else {
        ctx.fillRect(x1, originY, w, -h)
      }
    }
  }

  private drawDensity(p: DrawParams) {
    const { ctx, source, regionStart, block, bpLength, fullBlockWidth } = p
    const { rowHeight, rowTop, domainY, scaleType, r, g, b } = p
    const isLog = scaleType === SCALE_TYPE_LOG
    const normalize = makeScoreNormalizer(domainY[0], domainY[1], isLog)
    const zeroNorm = normalize(0)
    const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
    const invMaxDist = maxDist > 0.0001 ? 1 / maxDist : 0
    const rDelta = r - 255
    const gDelta = g - 255
    const bDelta = b - 255

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const w = Math.max(1.5, x2 - x1 + WIGGLE_FUDGE_FACTOR)
      const t =
        Math.abs(normalize(source.featureScores[i]!) - zeroNorm) * invMaxDist
      const cr = (255 + rDelta * t) | 0
      const cg = (255 + gDelta * t) | 0
      const cb = (255 + bDelta * t) | 0
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.fillRect(x1, rowTop, w, rowHeight)
    }
  }

  private drawLine(p: DrawParams) {
    const { ctx, source, regionStart, block, bpLength, fullBlockWidth } = p
    const { rowTop, r, g, b } = p
    if (source.numFeatures === 0) {
      return
    }

    ctx.strokeStyle = `rgb(${r},${g},${b})`
    ctx.lineWidth = 1
    ctx.beginPath()

    const scoreToY = this.makeScoreToY(p)

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY = scoreToY(source.featureScores[i]!) + rowTop
      if (i > 0) {
        const prevY = scoreToY(source.featureScores[i - 1]!) + rowTop
        ctx.moveTo(x1, prevY)
        ctx.lineTo(x1, scoreY)
      }
      ctx.moveTo(x1, scoreY)
      ctx.lineTo(x2, scoreY)
    }

    ctx.stroke()
  }

  private drawScatter(p: DrawParams) {
    const { ctx, source, regionStart, block, bpLength, fullBlockWidth } = p
    const { rowTop, r, g, b } = p
    ctx.fillStyle = `rgb(${r},${g},${b})`

    const scoreToY = this.makeScoreToY(p)

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY = scoreToY(source.featureScores[i]!) + rowTop
      const w = Math.max(1.5, x2 - x1)

      ctx.fillRect(x1, scoreY - 1, w, 2)
    }
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  dispose() {
    this.regions.clear()
  }
}
