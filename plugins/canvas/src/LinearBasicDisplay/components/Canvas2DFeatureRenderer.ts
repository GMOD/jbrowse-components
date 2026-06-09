import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
  HEAD_HALF_H_PX,
  MIN_RECT_WIDTH_PX,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
} from './sharedRendererConstants.ts'

import type {
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'
import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/core/gpu/canvas2dUtils'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const CHEVRON_HALF_W = CHEVRON_W_PX * 0.5
const CHEVRON_HALF_H = CHEVRON_H_PX * 0.5

type BpToScreen = (bp: number) => number

function drawLines(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  scrollY: number,
) {
  for (let i = 0; i < region.lineYs.length; i++) {
    const startBp = region.linePositions[i * 2]!
    const endBp = region.linePositions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const y = Math.floor(region.lineYs[i]! - scrollY + 0.5) + 0.5
    ctx.strokeStyle = abgrToCssRgba(region.lineColors[i]!)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()

    // On reversed blocks the render axis flips, so strand-direction glyphs
    // (chevrons, arrows) flip too — matches the GPU shader's
    // `lerp(dir, -dir, u.reversed)`.
    const rawDir = region.lineDirections[i]!
    const dir = block.reversed ? -rawDir : rawDir
    if (dir !== 0) {
      ctx.lineWidth = CHEVRON_THICKNESS_PX
      const lineWidthPx = Math.abs(x2 - x1)
      // Skip chevrons when the line is too short to host even one with
      // reasonable margins (half the nominal spacing).
      if (lineWidthPx >= CHEVRON_SPACING_PX * 0.5) {
        const totalChevrons = Math.max(
          1,
          Math.floor(lineWidthPx / CHEVRON_SPACING_PX),
        )
        // N chevrons with gaps at both ends ⇒ N+1 evenly-sized gaps.
        const spacing = lineWidthPx / (totalChevrons + 1)
        const minX = Math.min(x1, x2)
        for (let c = 0; c < totalChevrons; c++) {
          const cx = minX + spacing * (c + 1)
          // Three-segment "<" or ">" centred on (cx, y). The two outer
          // points share an x offset on the side opposite to `dir`, so
          // flipping dir flips the chevron's apex.
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

function drawRects(
  ctx: Ctx2D,
  region: RegionRenderData,
  toX: BpToScreen,
  scrollY: number,
) {
  for (let i = 0; i < region.rectYs.length; i++) {
    const startBp = region.rectPositions[i * 2]!
    const endBp = region.rectPositions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const y = Math.floor(region.rectYs[i]! - scrollY + 0.5)
    const h = Math.floor(region.rectHeights[i]! + 0.5)
    // On reversed blocks bpToScreenPx flips so x1 > x2; use abs + min for a
    // width-agnostic draw that matches the GPU shader's MIN_RECT_WIDTH clamp.
    const xLeft = Math.min(x1, x2)
    const w = Math.max(MIN_RECT_WIDTH_PX, Math.abs(x2 - x1))

    ctx.fillStyle = abgrToCssRgba(region.rectColors[i]!)
    ctx.fillRect(xLeft, y, w, h)
    if (region.outlineColor && w > 2) {
      ctx.strokeStyle = abgrToCssRgba(region.outlineColor)
      ctx.lineWidth = 1
      ctx.strokeRect(xLeft + 0.5, y + 0.5, w - 1, h - 1)
    }
  }
}

function drawArrows(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  scrollY: number,
) {
  for (let i = 0; i < region.arrowYs.length; i++) {
    const xBp = region.arrowXs[i]!
    const cx = toX(xBp)
    const y = Math.floor(region.arrowYs[i]! - scrollY + 0.5) + 0.5
    const rawDir = region.arrowDirections[i]!
    const dir = block.reversed ? -rawDir : rawDir
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

/**
 * Pure draw entry point. Paints lines, rects, and arrows for the laid-out
 * feature data into any 2D-canvas-like context. Per-block scissor clips so
 * partial blocks don't bleed across boundaries. No `this`, no DOM, no DPR
 * scaling — the on-screen `Canvas2DFeatureRenderer` wraps this with
 * `prepareCanvas`; SVG export calls it directly with an `SvgCanvas`.
 */
export function drawFeatureBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, RegionRenderData>,
  blocks: FeatureRenderBlock[],
  state: RenderState,
) {
  const { canvasWidth, canvasHeight, scrollY } = state
  if (regions.size === 0) {
    return
  }

  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (!region) {
      continue
    }

    const clip = clipBlockForCanvas(block, canvasWidth)
    if (!clip) {
      continue
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    const toX = makeBpMapper(block)
    drawLines(ctx, region, block, toX, scrollY)
    drawRects(ctx, region, toX, scrollY)
    drawArrows(ctx, region, block, toX, scrollY)

    ctx.restore()
  }
}

export class Canvas2DFeatureRenderer extends Canvas2DPerRegionRenderingBackend<
  RegionRenderData,
  RenderState
> {
  protected draw(
    blocks: FeatureRenderBlock[],
    regions: ReadonlyMap<number, RegionRenderData>,
    state: RenderState,
  ) {
    drawFeatureBlocks(this.ctx, regions, blocks, state)
  }
}
