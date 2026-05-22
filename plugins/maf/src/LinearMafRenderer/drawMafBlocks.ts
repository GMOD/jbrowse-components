import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/core/gpu/canvas2dUtils'

import { renderBases } from './rendering/bases.ts'
import { renderInsertions } from './rendering/insertions.ts'

import type { MafGPURenderState, MafRegionData } from './mafBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const decoder = new TextDecoder()

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
  const h = rowHeight * rowProportion
  const offset = (rowHeight - h) / 2

  for (const renderBlock of renderBlocks) {
    const regionData = regions.get(renderBlock.displayedRegionIndex)
    if (!regionData) {
      continue
    }
    const clip = clipBlockForCanvas(renderBlock, canvasWidth)
    if (!clip) {
      continue
    }
    const bpPerPx = clip.bpLength / clip.fullBlockWidth
    const scale = 1 / bpPerPx
    const { reversed } = renderBlock
    const bpToPx = makeBpMapper({
      start: renderBlock.bpRangeX[0],
      end: renderBlock.bpRangeX[1],
      screenStartPx: renderBlock.screenStartPx,
      screenEndPx: renderBlock.screenEndPx,
      reversed,
    })
    // For non-reversed, bpToPx(bp) is the LEFT edge of the cell at bp.
    // For reversed, bpToPx(bp) is the RIGHT edge — subtract one cell width.
    const bpToCellLeftPx = reversed
      ? (bp: number) => bpToPx(bp) - scale
      : bpToPx
    const renderingContext = {
      ctx,
      scale,
      rowHeight,
      h,
      palette,
      showAllLetters,
      mismatchRendering,
      reversed,
      bpToCellLeftPx,
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    for (const mafBlock of regionData.blocks) {
      const refSeq = decoder.decode(mafBlock.refSeqBytes)
      for (const row of mafBlock.rows) {
        const alignment = decoder.decode(row.alignmentBytes)
        const rowTop = offset + rowHeight * row.rowIndex
        renderBases(
          renderingContext,
          alignment,
          refSeq,
          mafBlock.startBp,
          rowTop,
        )
        renderInsertions(
          renderingContext,
          alignment,
          refSeq,
          mafBlock.startBp,
          rowTop,
          bpPerPx,
        )
      }
    }

    ctx.restore()
  }
}
