import {
  clipBlockForCanvas,
  makeCellLeftMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { rowBandGeometry } from '../LinearMafDisplay/components/visibleRegionGeometry.ts'
import { renderBases } from './rendering/bases.ts'

import type {
  MafGPURenderState,
  MafRegionData,
} from './mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * Paint the per-base SNP/sequence cells for the visible MAF blocks, the
 * Canvas2D equivalent of the GPU shader's rect pass (so both backends and the
 * SVG export produce the same base coloring). Insertion markers and deletion
 * count labels are drawn separately from positioned markers (see the
 * insertion/deletion overlays + SVG export), not here, so this stays a pure
 * base-cell pass with no double-drawing when the overlays sit on top.
 */
export function drawMafBlocks(
  ctx: Ctx2D,
  regions: { get(key: number): MafRegionData | undefined },
  renderBlocks: RenderBlock[],
  state: MafGPURenderState,
) {
  const {
    canvasWidth,
    canvasHeight,
    rowHeight,
    rowProportion,
    showAllLetters,
    mismatchRendering,
    palette,
  } = state
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)
  const cellColorConfig = { ...palette, showAllLetters, mismatchRendering }

  for (const renderBlock of renderBlocks) {
    const regionData = regions.get(renderBlock.displayedRegionIndex)
    if (!regionData) {
      continue
    }
    const clip = clipBlockForCanvas(renderBlock, canvasWidth)
    if (!clip) {
      continue
    }
    const scale = clip.fullBlockWidth / clip.bpLength
    const bpToCellLeftPx = makeCellLeftMapper(renderBlock)
    const renderingContext = { ctx, scale, h, cellColorConfig, bpToCellLeftPx }

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    for (const mafBlock of regionData.blocks) {
      const { refSeqBytes, startBp: blockStartBp } = mafBlock
      for (const row of mafBlock.rows) {
        const rowTop = offset + rowHeight * row.rowIndex
        renderBases(
          renderingContext,
          row.alignmentBytes,
          refSeqBytes,
          blockStartBp,
          rowTop,
        )
      }
    }

    ctx.restore()
  }
}
