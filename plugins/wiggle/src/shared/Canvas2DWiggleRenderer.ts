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

function normalizeScore(
  score: number,
  domainY: [number, number],
  scaleType: number,
) {
  if (scaleType === SCALE_TYPE_LOG) {
    const logMin = Math.log2(Math.max(domainY[0], 1))
    const logMax = Math.log2(Math.max(domainY[1], 1))
    const logScore = Math.log2(Math.max(score, 1))
    const range = logMax - logMin
    if (range === 0) {
      return 0
    }
    return Math.max(0, Math.min(1, (logScore - logMin) / range))
  }
  const range = domainY[1] - domainY[0]
  if (range === 0) {
    return 0
  }
  return Math.max(0, Math.min(1, (score - domainY[0]) / range))
}

function scoreToY(
  score: number,
  domainY: [number, number],
  height: number,
  scaleType: number,
) {
  return (1 - normalizeScore(score, domainY, scaleType)) * height
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
        const rowTop = row * rowHeight
        const [r, g, b] = source.color
        const r8 = Math.round(r * 255)
        const g8 = Math.round(g * 255)
        const b8 = Math.round(b * 255)

        if (renderingType === RENDERING_TYPE_LINE) {
          this.drawLine(
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
            r8,
            g8,
            b8,
          )
        } else if (renderingType === RENDERING_TYPE_DENSITY) {
          this.drawDensity(
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
            r8,
            g8,
            b8,
          )
        } else if (renderingType === RENDERING_TYPE_SCATTER) {
          this.drawScatter(
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
            r8,
            g8,
            b8,
          )
        } else {
          this.drawXYPlot(
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
            r8,
            g8,
            b8,
          )
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

  private drawXYPlot(
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
    ctx.fillStyle = `rgb(${r},${g},${b})`
    const originY = scoreToY(0, domainY, rowHeight, scaleType) + rowTop

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY =
        scoreToY(source.featureScores[i]!, domainY, rowHeight, scaleType) +
        rowTop

      const yTop = Math.min(scoreY, originY)
      const yBot = Math.max(scoreY, originY)
      const w = Math.max(1.5, x2 - x1)

      ctx.fillRect(x1, yTop, w, yBot - yTop)
    }
  }

  private drawDensity(
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
    const zeroNorm = normalizeScore(0, domainY, scaleType)
    const maxDist = Math.max(zeroNorm, 1 - zeroNorm)

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const w = Math.max(1.5, x2 - x1)

      const norm = normalizeScore(source.featureScores[i]!, domainY, scaleType)
      const t = maxDist > 0.0001 ? Math.abs(norm - zeroNorm) / maxDist : 0

      const cr = Math.round(255 + (r - 255) * t)
      const cg = Math.round(255 + (g - 255) * t)
      const cb = Math.round(255 + (b - 255) * t)
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.fillRect(x1, rowTop, w, rowHeight)
    }
  }

  private drawLine(
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
    if (source.numFeatures === 0) {
      return
    }

    ctx.strokeStyle = `rgb(${r},${g},${b})`
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY =
        scoreToY(source.featureScores[i]!, domainY, rowHeight, scaleType) +
        rowTop
      const prevScore =
        i === 0 ? source.featureScores[i]! : source.featureScores[i - 1]!
      const prevY = scoreToY(prevScore, domainY, rowHeight, scaleType) + rowTop

      ctx.moveTo(x1, prevY)
      ctx.lineTo(x1, scoreY)
      ctx.moveTo(x1, scoreY)
      ctx.lineTo(x2, scoreY)
    }

    ctx.stroke()
  }

  private drawScatter(
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
    ctx.fillStyle = `rgb(${r},${g},${b})`

    for (let i = 0; i < source.numFeatures; i++) {
      const startBp = source.featurePositions[i * 2]! + regionStart
      const endBp = source.featurePositions[i * 2 + 1]! + regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const scoreY =
        scoreToY(source.featureScores[i]!, domainY, rowHeight, scaleType) +
        rowTop
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
