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

    let prevColor = -1
    for (let i = 0; i < region.numCells; i++) {
      // Y-cull first: y depends only on rowIndex + scroll, so off-screen
      // rows skip all the bp→px math below. Meaningful when scrolling
      // through a dense matrix where most rows are out of view.
      const y = region.cellRowIndices[i]! * rowHeight - scrollTop
      if (y + rowHeight < 0 || y > canvasHeight) {
        continue
      }

      const startBp = region.cellPositions[i * 2]! + region.regionStart
      const endBp = region.cellPositions[i * 2 + 1]! + region.regionStart

      const frac1 = (startBp - block.bpRangeX[0]) / bpLength
      const frac2 = (endBp - block.bpRangeX[0]) / bpLength
      const rawX1 = block.reversed
        ? block.screenEndPx - frac1 * fullBlockWidth
        : block.screenStartPx + frac1 * fullBlockWidth
      const rawX2 = block.reversed
        ? block.screenEndPx - frac2 * fullBlockWidth
        : block.screenStartPx + frac2 * fullBlockWidth
      const x1 = Math.min(rawX1, rawX2)
      const w = Math.max(2, Math.max(rawX1, rawX2) - x1)

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

export class Canvas2DVariantRenderer implements VariantBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions = new Map<number, VariantUploadData>()

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.canvas = canvas
    this.ctx = ctx
  }

  uploadRegion(displayedRegionIndex: number, data: VariantUploadData) {
    if (data.numCells === 0) {
      this.regions.delete(displayedRegionIndex)
    } else {
      this.regions.set(displayedRegionIndex, data)
    }
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  renderBlocks(blocks: VariantRenderBlock[], state: VariantRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawVariantBlocks(this.ctx, this.regions, blocks, state)
  }

  dispose() {
    this.regions.clear()
  }
}
