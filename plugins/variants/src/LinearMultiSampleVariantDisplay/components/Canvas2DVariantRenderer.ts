import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawVariantShape } from './variantShape.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Pure draw entry point shared by the on-screen Canvas2D backend (via
 * `Canvas2DVariantRenderer.renderBlocks`) and the SVG export path
 * (`renderSvg.tsx` → `paintLayer` with an `SvgCanvas`). Per-block scissor
 * clip keeps cells from bleeding across block boundaries; per-row Y-cull
 * skips off-screen rows fast for tall scrolled matrices.
 */
export function drawVariantBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, VariantUploadData>,
  blocks: VariantRenderBlock[],
  state: VariantRenderState,
) {
  const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state
  // 1px-min row height (sub-pixel rows draw 1px tall). Mirrors
  // max(u.rowHeight, 1.0) in shaders/variant.slang + VariantComponent.tsx.
  const drawnRowHeight = Math.max(rowHeight, 1)

  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (!region || region.numCells === 0) {
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
    let prevColor = -1
    for (let i = 0; i < region.numCells; i++) {
      // Y-cull first: y depends only on rowIndex + scroll, so off-screen
      // rows skip all the bp→px math below. Meaningful when scrolling
      // through a dense matrix where most rows are out of view.
      const y = region.cellRowIndices[i]! * rowHeight - scrollTop
      if (y + drawnRowHeight < 0 || y > canvasHeight) {
        continue
      }

      const startBp = region.cellPositions[i * 2]!
      const endBp = region.cellPositions[i * 2 + 1]!

      const x1_raw = toX(startBp)
      const x2_raw = toX(endBp)
      const x1 = Math.min(x1_raw, x2_raw)
      const spanPx = Math.abs(x2_raw - x1_raw)
      const w = Math.max(2, spanPx)

      const color = region.cellColors[i]!
      if (color !== prevColor) {
        ctx.fillStyle = abgrToCssRgba(color)
        prevColor = color
      }
      drawVariantShape(
        ctx,
        region.cellShapeTypes[i]!,
        x1,
        y,
        w,
        drawnRowHeight,
        spanPx,
      )
    }

    ctx.restore()
  }
}

export class Canvas2DVariantRenderer extends Canvas2DPerRegionRenderingBackend<
  VariantUploadData,
  VariantRenderState
> {
  protected draw(
    blocks: VariantRenderBlock[],
    regions: ReadonlyMap<number, VariantUploadData>,
    state: VariantRenderState,
  ) {
    drawVariantBlocks(this.ctx, regions, blocks, state)
  }
}
