import { clipBlockForCanvas } from '@jbrowse/core/gpu/canvas2dUtils'

import { renderBases } from './rendering/bases.ts'
import { renderGaps } from './rendering/gaps.ts'
import { renderInsertions } from './rendering/insertions.ts'
import { getColorBaseMap } from './util.ts'

import type { MafGPURenderState, MafRegionData } from './mafBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { Theme } from '@mui/material'

const decoder = new TextDecoder()

export function drawMafBlocks(
  ctx: Ctx2D,
  rpcDataMap: { get(key: number): { regionData: MafRegionData } | undefined },
  renderBlocks: RenderBlock[],
  state: MafGPURenderState,
  theme: Theme,
) {
  const {
    canvasWidth,
    canvasHeight,
    rowHeight,
    rowProportion,
    showAllLetters,
    mismatchRendering,
  } = state
  const colorForBase = getColorBaseMap(theme)
  const h = rowHeight * rowProportion
  const offset = (rowHeight - h) / 2

  for (const renderBlock of renderBlocks) {
    const entry = rpcDataMap.get(renderBlock.displayedRegionIndex)
    if (!entry) {
      continue
    }
    const clip = clipBlockForCanvas(renderBlock, canvasWidth)
    if (!clip) {
      continue
    }
    const bpPerPx = clip.bpLength / clip.fullBlockWidth
    const scale = 1 / bpPerPx
    const renderingContext = {
      ctx,
      scale,
      rowHeight,
      h,
      colorForBase,
      showAllLetters,
      mismatchRendering,
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    for (const mafBlock of entry.regionData.blocks) {
      const leftPx =
        renderBlock.screenStartPx +
        (mafBlock.startBp - renderBlock.bpRangeX[0]) / bpPerPx
      const refSeq = decoder.decode(mafBlock.refSeqBytes)
      for (const row of mafBlock.rows) {
        const alignment = decoder.decode(row.alignmentBytes)
        const rowTop = offset + rowHeight * row.rowIndex
        renderGaps(renderingContext, alignment, refSeq, leftPx, rowTop)
        renderBases(renderingContext, alignment, refSeq, leftPx, rowTop)
        renderInsertions(
          renderingContext,
          alignment,
          refSeq,
          leftPx,
          rowTop,
          bpPerPx,
        )
      }
    }

    ctx.restore()
  }
}
