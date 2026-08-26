import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { paintedBpRange } from '../LinearMafDisplay/components/paintedBpRange.ts'
import {
  rowBandGeometry,
  visibleRowRange,
} from '../LinearMafDisplay/components/visibleRegionGeometry.ts'
import { ColumnMapper } from './binning.ts'
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
    rowsHeight,
    rowHeight,
    rowProportion,
    scrollTop,
    showAllLetters,
    mismatchRendering,
    palette,
    binBp,
  } = state
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
  // `rowsHeight`, not the canvas: the canvas also carries the coverage band
  // above the rows, and this paints in the rows band's own space — its caller
  // has translated to `rowsTop` and clipped there.
  //
  // Rows scrolled off the band cost nothing: skipping them here is what keeps
  // a pinned row height affordable on an alignment hundreds of species deep,
  // where the per-base walk below is the expensive part.
  const { firstRow, endRow } = visibleRowRange(rowHeight, scrollTop, rowsHeight)
  const cellColorConfig = { ...palette, showAllLetters, mismatchRendering }
  // One buffer for the whole paint, not one per block — see `ColumnMapper`.
  const columnMapper = new ColumnMapper()
  // One flank index per region for the whole paint, not one per render block.
  // A region is usually covered by several of those, and each `makeRowFlank`
  // allocates an array as long as the region's blocks — tens of thousands on the
  // ce11 26-way shape, discarded and rebuilt on the next render block, every
  // frame. The sibling walks already build theirs once per region
  // (`computeVisibleDeletions`) or once per encode (`buildInstanceBuffer`).
  const rowFlanks = new Map<number, ReturnType<typeof makeRowFlank>>()

  forEachClippedBlock(
    ctx,
    renderBlocks,
    canvasWidth,
    rowsHeight,
    block => regions.get(block.displayedRegionIndex),
    (regionData, renderBlock, clip) => {
      const renderingContext = {
        ctx,
        h,
        cellColorConfig,
        bpToPx: makeBpMapper(renderBlock),
        binBp,
      }

      const regionIndex = renderBlock.displayedRegionIndex
      let rowFlank = rowFlanks.get(regionIndex)
      if (rowFlank === undefined) {
        rowFlank = makeRowFlank(regionData.blocks)
        rowFlanks.set(regionIndex, rowFlank)
      }
      // Blocks the render block can't paint are skipped whole, rather than
      // indexed and walked column by column for the scissor to discard. The
      // fetched region is the buffered one, so on a typical view that is about
      // half of them — the same bound the identity, conservation and
      // source-chromosome painters already apply.
      const { bpLo, bpHi } = paintedBpRange(renderBlock, clip)
      for (let i = 0; i < regionData.blocks.length; i++) {
        const mafBlock = regionData.blocks[i]!
        if (mafBlock.endBp <= bpLo || mafBlock.startBp >= bpHi) {
          continue
        }
        const { refSeqBytes, startBp: blockStartBp } = mafBlock
        // Once per block, not per row: the map is a property of the block's
        // reference, and rebuilding it per row would put the O(columns x rows)
        // walk back that stepping by `binBp` exists to remove.
        const columns = columnMapper.build(refSeqBytes)
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
