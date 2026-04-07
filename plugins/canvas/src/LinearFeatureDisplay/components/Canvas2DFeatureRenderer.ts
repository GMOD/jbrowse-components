import {
  bpToScreenX as bpToScreenXUtil,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'

import {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_W_PX,
  HEAD_HALF_H_PX,
  MIN_RECT_WIDTH_PX,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
} from './sharedRendererConstants.ts'

import type {
  CanvasFeatureBackend,
  FeatureRenderBlock,
} from './canvasFeatureBackendTypes.ts'
import type { RegionGpuData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

const CHEVRON_HALF_W = CHEVRON_W_PX * 0.5
const CHEVRON_HALF_H = CHEVRON_H_PX * 0.5

interface Canvas2DRegionData {
  regionStart: number
  rectPositions: Uint32Array
  rectYs: Float32Array
  rectHeights: Float32Array
  rectColors: Uint8Array
  numRects: number
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColors: Uint8Array
  lineDirections: Int8Array
  numLines: number
  arrowXs: Uint32Array
  arrowYs: Float32Array
  arrowDirections: Int8Array
  arrowHeights: Float32Array
  arrowColors: Uint8Array
  numArrows: number
}

export class Canvas2DFeatureRenderer implements CanvasFeatureBackend {
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

  uploadRegion(regionNumber: number, data: RegionGpuData) {
    this.regions.set(regionNumber, {
      regionStart: data.regionStart,
      rectPositions: data.rectPositions,
      rectYs: data.rectYs,
      rectHeights: data.rectHeights,
      rectColors: data.rectColors,
      numRects: data.numRects,
      linePositions: data.linePositions,
      lineYs: data.lineYs,
      lineColors: data.lineColors,
      lineDirections: data.lineDirections,
      numLines: data.numLines,
      arrowXs: data.arrowXs,
      arrowYs: data.arrowYs,
      arrowDirections: data.arrowDirections,
      arrowHeights: data.arrowHeights,
      arrowColors: data.arrowColors,
      numArrows: data.numArrows,
    })
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    const { canvasWidth, canvasHeight, scrollY } = state

    if (this.regions.size === 0) {
      return
    }

    const ctx = this.ctx
    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region) {
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

      this.drawLines(ctx, region, block, bpLength, fullBlockWidth, scrollY)
      this.drawRects(ctx, region, block, bpLength, fullBlockWidth, scrollY)
      this.drawArrows(ctx, region, block, bpLength, fullBlockWidth, scrollY)

      ctx.restore()
    }
  }

  private bpToScreenX(
    absBp: number,
    block: FeatureRenderBlock,
    bpLength: number,
    fullBlockWidth: number,
  ) {
    return bpToScreenXUtil(absBp, block, bpLength, fullBlockWidth)
  }

  private drawLines(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: FeatureRenderBlock,
    bpLength: number,
    fullBlockWidth: number,
    scrollY: number,
  ) {
    for (let i = 0; i < region.numLines; i++) {
      const startBp = region.linePositions[i * 2]! + region.regionStart
      const endBp = region.linePositions[i * 2 + 1]! + region.regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y = Math.floor(region.lineYs[i]! - scrollY) + 0.5
      const r = region.lineColors[i * 4]!
      const g = region.lineColors[i * 4 + 1]!
      const b = region.lineColors[i * 4 + 2]!
      const a = region.lineColors[i * 4 + 3]! / 255

      ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()

      const dir = region.lineDirections[i]!
      if (dir !== 0) {
        ctx.lineWidth = 1.5
        const lineWidthPx = Math.abs(x2 - x1)
        if (lineWidthPx >= CHEVRON_SPACING_PX * 0.5) {
          const totalChevrons = Math.max(
            1,
            Math.floor(lineWidthPx / CHEVRON_SPACING_PX),
          )
          const spacing = lineWidthPx / (totalChevrons + 1)
          const minX = Math.min(x1, x2)
          for (let c = 0; c < totalChevrons; c++) {
            const cx = minX + spacing * (c + 1)
            ctx.beginPath()
            ctx.moveTo(cx - CHEVRON_HALF_W * dir, y - CHEVRON_HALF_H)
            ctx.lineTo(cx + CHEVRON_HALF_W * dir, y)
            ctx.lineTo(cx - CHEVRON_HALF_W * dir, y + CHEVRON_HALF_H)
            ctx.stroke()
          }
        }
      }
    }
  }

  private drawRects(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: FeatureRenderBlock,
    bpLength: number,
    fullBlockWidth: number,
    scrollY: number,
  ) {
    for (let i = 0; i < region.numRects; i++) {
      const startBp = region.rectPositions[i * 2]! + region.regionStart
      const endBp = region.rectPositions[i * 2 + 1]! + region.regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y = Math.floor(region.rectYs[i]! - scrollY + 0.5)
      const h = Math.floor(region.rectHeights[i]! + 0.5)
      const r = region.rectColors[i * 4]!
      const g = region.rectColors[i * 4 + 1]!
      const b = region.rectColors[i * 4 + 2]!
      const a = region.rectColors[i * 4 + 3]! / 255

      const w = Math.max(MIN_RECT_WIDTH_PX, x2 - x1)

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.fillRect(x1, y, w, h)
    }
  }

  private drawArrows(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: FeatureRenderBlock,
    bpLength: number,
    fullBlockWidth: number,
    scrollY: number,
  ) {
    for (let i = 0; i < region.numArrows; i++) {
      const xBp = region.arrowXs[i]! + region.regionStart
      const cx = this.bpToScreenX(xBp, block, bpLength, fullBlockWidth)
      const y = Math.floor(region.arrowYs[i]! - scrollY + 0.5) + 0.5
      const dir = region.arrowDirections[i]!
      const r = region.arrowColors[i * 4]!
      const g = region.arrowColors[i * 4 + 1]!
      const b = region.arrowColors[i * 4 + 2]!
      const a = region.arrowColors[i * 4 + 3]! / 255

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`

      const stemEndX = cx + STEM_LENGTH_PX * 0.5 * dir
      ctx.fillRect(
        Math.min(cx, stemEndX),
        y - STEM_HALF_H_PX,
        Math.abs(stemEndX - cx),
        STEM_HALF_H_PX * 2,
      )

      const headTipX = cx + STEM_LENGTH_PX * dir
      ctx.beginPath()
      ctx.moveTo(stemEndX, y - HEAD_HALF_H_PX)
      ctx.lineTo(stemEndX, y + HEAD_HALF_H_PX)
      ctx.lineTo(headTipX, y)
      ctx.closePath()
      ctx.fill()
    }
  }

  pruneStaleRegions(activeRegions: number[]) {
    const activeSet = new Set(activeRegions)
    for (const regionNumber of this.regions.keys()) {
      if (!activeSet.has(regionNumber)) {
        this.regions.delete(regionNumber)
      }
    }
  }

  dispose() {
    this.regions.clear()
  }
}
