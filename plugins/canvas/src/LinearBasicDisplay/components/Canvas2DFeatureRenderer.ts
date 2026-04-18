import {
  bpToScreenX as bpToScreenXUtil,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

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
import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { Canvas2DRenderBlock } from '@jbrowse/core/gpu/canvas2dUtils'
import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

const CHEVRON_HALF_W = CHEVRON_W_PX * 0.5
const CHEVRON_HALF_H = CHEVRON_H_PX * 0.5

type Ctx = CanvasRenderingContext2D | SvgCanvas

export function drawLines(
  ctx: Ctx,
  region: RegionRenderData,
  block: Canvas2DRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  scrollY: number,
) {
  const dirFlip = block.reversed ? -1 : 1
  for (let i = 0; i < region.lineYs.length; i++) {
    const startBp = region.linePositions[i * 2]! + region.regionStart
    const endBp = region.linePositions[i * 2 + 1]! + region.regionStart
    const x1 = bpToScreenXUtil(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenXUtil(endBp, block, bpLength, fullBlockWidth)
    const y = Math.floor(region.lineYs[i]! - scrollY + 0.5) + 0.5
    ctx.strokeStyle = abgrToCssRgba(region.lineColors[i]!)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()

    // Directions come from the feature strand; on reversed blocks the render
    // axis is flipped so chevrons/arrows must point the opposite way (matches
    // the GPU shader's `lerp(dir, -dir, reversed)`).
    const dir = region.lineDirections[i]! * dirFlip
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

export function drawRects(
  ctx: Ctx,
  region: RegionRenderData,
  block: Canvas2DRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  scrollY: number,
) {
  for (let i = 0; i < region.rectYs.length; i++) {
    const startBp = region.rectPositions[i * 2]! + region.regionStart
    const endBp = region.rectPositions[i * 2 + 1]! + region.regionStart
    const x1 = bpToScreenXUtil(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenXUtil(endBp, block, bpLength, fullBlockWidth)
    const y = Math.floor(region.rectYs[i]! - scrollY + 0.5)
    const h = Math.floor(region.rectHeights[i]! + 0.5)
    // On reversed blocks bpToScreenX flips so x1 > x2; use abs + min for a
    // width-agnostic draw that matches the GPU shader's MIN_RECT_WIDTH clamp.
    const xLeft = Math.min(x1, x2)
    const w = Math.max(MIN_RECT_WIDTH_PX, Math.abs(x2 - x1))

    ctx.fillStyle = abgrToCssRgba(region.rectColors[i]!)
    ctx.fillRect(xLeft, y, w, h)
  }
}

export function drawArrows(
  ctx: Ctx,
  region: RegionRenderData,
  block: Canvas2DRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  scrollY: number,
) {
  const dirFlip = block.reversed ? -1 : 1
  for (let i = 0; i < region.arrowYs.length; i++) {
    const xBp = region.arrowXs[i]! + region.regionStart
    const cx = bpToScreenXUtil(xBp, block, bpLength, fullBlockWidth)
    const y = Math.floor(region.arrowYs[i]! - scrollY + 0.5) + 0.5
    const dir = region.arrowDirections[i]! * dirFlip
    ctx.fillStyle = abgrToCssRgba(region.arrowColors[i]!)

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

export class Canvas2DFeatureRenderer implements CanvasFeatureBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions = new Map<number, RegionRenderData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadRegion(regionNumber: number, data: RegionRenderData) {
    this.regions.set(regionNumber, data)
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

      drawLines(ctx, region, block, bpLength, fullBlockWidth, scrollY)
      drawRects(ctx, region, block, bpLength, fullBlockWidth, scrollY)
      drawArrows(ctx, region, block, bpLength, fullBlockWidth, scrollY)

      ctx.restore()
    }
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  dispose() {
    this.regions.clear()
  }
}
