import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import {
  rowBandGeometry,
  visibleRowRange,
} from '../LinearMafDisplay/components/visibleRegionGeometry.ts'
import { buildColumnForGenomicOffset } from './binning.ts'
import { renderBases } from './rendering/bases.ts'
import { makeRowFlank } from './rendering/rowFlank.ts'

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
    scrollTop,
    showAllLetters,
    mismatchRendering,
    palette,
    binBp,
  } = state
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
  // Rows scrolled off the canvas cost nothing: skipping them here is what keeps
  // a pinned row height affordable on an alignment hundreds of species deep,
  // where the per-base walk below is the expensive part.
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    canvasHeight,
  )
  const cellColorConfig = { ...palette, showAllLetters, mismatchRendering }

  forEachClippedBlock(
    ctx,
    renderBlocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (regionData, renderBlock) => {
      const renderingContext = {
        ctx,
        h,
        cellColorConfig,
        bpToPx: makeBpMapper(renderBlock),
        binBp,
      }

      const rowFlank = makeRowFlank(regionData.blocks)
      for (let i = 0; i < regionData.blocks.length; i++) {
        const mafBlock = regionData.blocks[i]!
        const { refSeqBytes, startBp: blockStartBp } = mafBlock
        // Once per block, not per row: the map is a property of the block's
        // reference, and rebuilding it per row would put the O(columns x rows)
        // walk back that stepping by `binBp` exists to remove.
        const columns = buildColumnForGenomicOffset(refSeqBytes)
        for (const row of mafBlock.rows) {
          if (row.rowIndex >= firstRow && row.rowIndex < endRow) {
            renderBases(
              renderingContext,
              row.alignmentBytes,
              refSeqBytes,
              columns,
              blockStartBp,
              offset + rowHeight * row.rowIndex,
              rowFlank(i, row.rowIndex),
            )
          }
        }
      }
    },
  )
}
