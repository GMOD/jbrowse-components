import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { snapVariantCellX } from './snapVariantCellX.ts'
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
  // The painted cell height, floored at 2px — variant.slang's own rule,
  // generated into TS (adr-051), so the hit test cannot disagree with it.
  const drawnRowHeight = drawnCellHeightPx(rowHeight)

  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => {
      const region = regions.get(block.displayedRegionIndex)
      return region && region.numCells > 0 ? region : undefined
    },
    (region, block) => {
      const toX = makeBpMapper(block)
      let prevColor = -1
      for (let i = 0; i < region.numCells; i++) {
        // Y-cull first: y depends only on rowIndex + scroll, so off-screen
        // rows skip all the bp→px math below. Meaningful when scrolling
        // through a dense matrix where most rows are out of view.
        const y = region.cellRowIndices[i]! * rowHeight - scrollTop
        if (y + drawnRowHeight >= 0 && y <= canvasHeight) {
          const startBp = region.cellPositions[i * 2]!
          const endBp = region.cellPositions[i * 2 + 1]!

          // Snapped, not drawn at raw float x: the shader pixel-snaps, so an
          // unsnapped Canvas2D path (and the SVG export riding on it) rendered
          // every cell up to half a pixel off what the GPU had drawn.
          const { x: x1, width: w } = snapVariantCellX(
            toX(startBp),
            toX(endBp),
            canvasWidth,
          )

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
          )
        }
      }
    },
  )
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
