import { clipBlockForCanvas } from '@jbrowse/core/gpu/canvas2dUtils'

import { renderGaps } from './rendering/gaps.ts'
import { renderInsertions } from './rendering/insertions.ts'
import { renderMatches } from './rendering/matches.ts'
import { renderMismatches } from './rendering/mismatches.ts'
import { getCharWidthHeight, getColorBaseMap } from './util.ts'

import type { MafGPURenderState, MafRegionData } from './mafBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { Theme } from '@mui/material'

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
  const { charHeight } = getCharWidthHeight()
  const colorForBase = getColorBaseMap(theme)
  const h = rowHeight * rowProportion
  const offset = (rowHeight - h) / 2
  const decoder = new TextDecoder()

  for (const block of renderBlocks) {
    const entry = rpcDataMap.get(block.displayedRegionIndex)
    if (entry) {
      const { regionData } = entry
      const clip = clipBlockForCanvas(block, canvasWidth)
      if (clip) {
        const bpPerPx = clip.bpLength / clip.fullBlockWidth
        const scale = 1 / bpPerPx
        const leftPx =
          block.screenStartPx +
          (regionData.startBp - block.bpRangeX[0]) / bpPerPx

        ctx.save()
        ctx.beginPath()
        ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
        ctx.clip()

        const renderingContext = {
          ctx,
          scale,
          canvasWidth,
          rowHeight,
          h,
          colorForBase,
          showAllLetters,
          mismatchRendering,
          charHeight,
        }

        const refSeq = decoder.decode(regionData.refSeqBytes)
        for (const row of regionData.rows) {
          const alignment = decoder.decode(row.alignmentBytes)
          const rowTop = offset + rowHeight * row.rowIndex
          renderGaps(renderingContext, alignment, refSeq, leftPx, rowTop)
          renderMatches(renderingContext, alignment, refSeq, leftPx, rowTop)
          renderMismatches(renderingContext, alignment, refSeq, leftPx, rowTop)
          renderInsertions(
            renderingContext,
            alignment,
            refSeq,
            leftPx,
            rowTop,
            bpPerPx,
          )
        }

        ctx.restore()
      }
    }
  }
}
