import {
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import { drawVariantShape } from './variantShape.ts'

import type {
  VariantBackend,
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantBackendTypes.ts'

export class Canvas2DVariantRenderer implements VariantBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions = new Map<number, VariantUploadData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadRegion(regionNumber: number, data: VariantUploadData) {
    if (data.numCells === 0) {
      this.regions.delete(regionNumber)
    } else {
      this.regions.set(regionNumber, data)
    }
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  renderBlocks(blocks: VariantRenderBlock[], state: VariantRenderState) {
    const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state

    const ctx = this.ctx
    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region || region.numCells === 0) {
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

      for (let i = 0; i < region.numCells; i++) {
        const startBp = region.cellPositions[i * 2]! + region.regionStart
        const endBp = region.cellPositions[i * 2 + 1]! + region.regionStart
        const rowIdx = region.cellRowIndices[i]!
        const shapeType = region.cellShapeTypes[i]!

        const frac1 = (startBp - block.bpRangeX[0]) / bpLength
        const frac2 = (endBp - block.bpRangeX[0]) / bpLength
        const rawX1 = block.reversed
          ? block.screenEndPx - frac1 * fullBlockWidth
          : block.screenStartPx + frac1 * fullBlockWidth
        const rawX2 = block.reversed
          ? block.screenEndPx - frac2 * fullBlockWidth
          : block.screenStartPx + frac2 * fullBlockWidth
        const x1 = Math.min(rawX1, rawX2)
        const x2 = Math.max(rawX1, rawX2)
        const y = rowIdx * rowHeight - scrollTop
        const w = Math.max(2, x2 - x1)

        if (y + rowHeight < 0 || y > canvasHeight) {
          continue
        }

        ctx.fillStyle = abgrToCssRgba(region.cellColors[i]!)
        drawVariantShape(ctx, shapeType, x1, y, w, rowHeight)
      }

      ctx.restore()
    }
  }

  dispose() {
    this.regions.clear()
  }
}
