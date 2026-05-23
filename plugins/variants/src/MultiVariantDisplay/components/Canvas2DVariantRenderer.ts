import {
  clipBlockForCanvas,
  makeBpMapper,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DPerRegionBackend } from '@jbrowse/core/gpu/perRegionBackend'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import { drawVariantShape } from './variantShape.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Pure draw entry point. Paints the variant matrix cells (one shape per
 * variant×sample) into any 2D-canvas-like context. Per-block scissor clip
 * keeps off-block cells from bleeding across boundaries; per-row Y-cull
 * skips off-screen rows fast (meaningful when the matrix is taller than the
 * viewport and scrolled).
 *
 * The on-screen `Canvas2DVariantRenderer` wraps this with `prepareCanvas`;
 * SVG export calls it directly with an `SvgCanvas`.
 */
export function drawVariantBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, VariantUploadData>,
  blocks: VariantRenderBlock[],
  state: VariantRenderState,
) {
  const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state

  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
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

    const toX = makeBpMapper(block)
    let prevColor = -1
    for (let i = 0; i < region.numCells; i++) {
      // Y-cull first: y depends only on rowIndex + scroll, so off-screen
      // rows skip all the bp→px math below. Meaningful when scrolling
      // through a dense matrix where most rows are out of view.
      const y = region.cellRowIndices[i]! * rowHeight - scrollTop
      if (y + rowHeight < 0 || y > canvasHeight) {
        continue
      }

      const startBp = region.cellPositions[i * 2]!
      const endBp = region.cellPositions[i * 2 + 1]!

      const x1_raw = toX(startBp)
      const x2_raw = toX(endBp)
      const x1 = Math.min(x1_raw, x2_raw)
      const w = Math.max(2, Math.abs(x2_raw - x1_raw))

      const color = region.cellColors[i]!
      if (color !== prevColor) {
        ctx.fillStyle = abgrToCssRgba(color)
        prevColor = color
      }
      drawVariantShape(ctx, region.cellShapeTypes[i]!, x1, y, w, rowHeight)
    }

    ctx.restore()
  }
}

// One-shot pure entry point used by SVG export per ARCHITECTURE.md "SVG
// export pipeline". On-screen uses the streamed per-region path via
// Canvas2DVariantRenderer because perRegionCellData entries arrive incrementally.
// VariantCellData is a structural superset of VariantUploadData (extra fields
// are flatbush + genotype maps for hit-testing), so pass-through is type-safe.
export function drawVariantsToCtx(
  ctx: Ctx2D,
  sources: { perRegionCellData: Record<number, VariantUploadData> },
  blocks: VariantRenderBlock[],
  state: VariantRenderState,
) {
  const regions = new Map<number, VariantUploadData>()
  for (const [idxStr, data] of Object.entries(sources.perRegionCellData)) {
    if (data.numCells > 0) {
      regions.set(Number(idxStr), data)
    }
  }
  drawVariantBlocks(ctx, regions, blocks, state)
}

export class Canvas2DVariantRenderer extends Canvas2DPerRegionBackend<
  VariantUploadData,
  VariantRenderState
> {
  renderBlocks(
    blocks: VariantRenderBlock[],
    regions: ReadonlyMap<number, VariantUploadData>,
    state: VariantRenderState,
  ) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawVariantBlocks(this.ctx, regions, blocks, state)
  }
}
