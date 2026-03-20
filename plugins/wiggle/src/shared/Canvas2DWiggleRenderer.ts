import { WIGGLE_FUDGE_FACTOR, normalizeScore } from '../util.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  SCALE_TYPE_LOG,
} from './wiggleShader.ts'

import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './WiggleRenderer.ts'

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

export class Canvas2DWiggleRenderer {
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

    let numRows = 0
    for (const [i, source] of sources.entries()) {
      const r = (source.rowIndex ?? i) + 1
      if (r > numRows) {
        numRows = r
      }
    }

    this.regions.set(regionNumber, { regionStart, sources, numRows })
  }

  renderBlocks(blocks: WiggleRenderBlock[], renderState: WiggleGPURenderState) {
    const { canvasWidth, canvasHeight, renderingType, scaleType, domainY } =
      renderState
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region || region.sources.length === 0) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const bpLength = block.bpRangeX[1] - block.bpRangeX[0]

      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, 0, scissorW, canvasHeight)
      ctx.clip()

      const numRows = region.numRows
      const rowHeight = canvasHeight / numRows

      for (const [idx, source] of region.sources.entries()) {
        const row = source.rowIndex ?? idx
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

  private bpToScreenX(
    absBp: number,
    block: WiggleRenderBlock,
    bpLength: number,
    fullBlockWidth: number,
  ) {
    return (
      block.screenStartPx +
      ((absBp - block.bpRangeX[0]) / bpLength) * fullBlockWidth
    )
  }

  private makeScoreToY(p: DrawParams) {
    const { rowHeight, domainY, scaleType } = p
    const isLog = scaleType === SCALE_TYPE_LOG
    if (isLog) {
      const logMin = Math.log2(Math.max(domainY[0], 1))
      const logRange = Math.log2(Math.max(domainY[1], 1)) - logMin
      if (logRange === 0) {
        return () => 0
      }
      return (score: number) => {
        const logScore = Math.log2(Math.max(score, 1))
        const norm = Math.max(0, Math.min(1, (logScore - logMin) / logRange))
        return (1 - norm) * rowHeight
      }
    }
    const domMin = domainY[0]
    const domRange = domainY[1] - domMin
    if (domRange === 0) {
      return () => 0
    }
    const invRange = 1 / domRange
    return (score: number) => {
      const norm = Math.max(0, Math.min(1, (score - domMin) * invRange))
      return (1 - norm) * rowHeight
    }
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
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
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
    const domMin = domainY[0]
    const domMax = domainY[1]
    const zeroNorm = normalizeScore(0, domMin, domMax, isLog)
    const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
    const invMaxDist = maxDist > 0.0001 ? 1 / maxDist : 0
    const rDelta = r - 255
    const gDelta = g - 255
    const bDelta = b - 255

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const w = Math.max(1.5, x2 - x1 + WIGGLE_FUDGE_FACTOR)

      const norm = normalizeScore(
        source.featureScores[i]!,
        domMin,
        domMax,
        isLog,
      )
      const t = Math.abs(norm - zeroNorm) * invMaxDist

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
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY = scoreToY(source.featureScores[i]!) + rowTop
      const prevScore =
        i === 0 ? source.featureScores[i]! : source.featureScores[i - 1]!
      const prevY = scoreToY(prevScore) + rowTop

      ctx.moveTo(x1, prevY)
      ctx.lineTo(x1, scoreY)
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
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY = scoreToY(source.featureScores[i]!) + rowTop
      const w = Math.max(1.5, x2 - x1)

      ctx.fillRect(x1, scoreY - 1, w, 2)
    }
  }

  pruneStaleRegions(activeRegionNumbers: Set<number>) {
    for (const regionNumber of this.regions.keys()) {
      if (!activeRegionNumbers.has(regionNumber)) {
        this.regions.delete(regionNumber)
      }
    }
  }

  destroy() {
    this.regions.clear()
  }
}
