import { clipBlockForCanvas } from '@jbrowse/core/gpu/canvas2dUtils'

import { renderGaps } from './rendering/gaps.ts'
import { renderInsertions } from './rendering/insertions.ts'
import { renderMatches } from './rendering/matches.ts'
import { renderMismatches } from './rendering/mismatches.ts'
import {
  CHAR_SIZE_WIDTH,
  FONT_CONFIG,
  VERTICAL_TEXT_OFFSET,
} from './rendering/types.ts'
import { getCharWidthHeight, getColorBaseMap, getContrastBaseMap } from './util.ts'

import type { MafGPURenderState, MafRegionData } from './mafBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Theme } from '@mui/material'

export function drawMafBlocks(
  ctx: CanvasRenderingContext2D,
  rpcDataMap: { get(key: number): { regionData: MafRegionData } | undefined },
  renderBlocks: RenderBlock[],
  state: MafGPURenderState,
  theme: Theme,
) {
  const { canvasWidth, canvasHeight, rowHeight, rowProportion, showAllLetters, mismatchRendering, showAsUpperCase } = state
  const { charHeight } = getCharWidthHeight()
  const colorForBase = getColorBaseMap(theme)
  const contrastForBase = getContrastBaseMap(theme)
  const h = rowHeight * rowProportion
  const hp2 = h / 2
  const offset = (rowHeight - h) / 2

  ctx.font = FONT_CONFIG

  for (const block of renderBlocks) {
    const entry = rpcDataMap.get(block.displayedRegionIndex)
    if (!entry) {
      continue
    }

    const { regionData } = entry
    const clip = clipBlockForCanvas(block, canvasWidth)
    if (!clip) {
      continue
    }

    const bpPerPx = clip.bpLength / clip.fullBlockWidth
    const scale = 1 / bpPerPx
    const leftPx = block.screenStartPx + (regionData.startBp - block.bpRangeX[0]) / bpPerPx

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    const renderingContext = {
      ctx,
      scale,
      bpPerPx,
      canvasWidth,
      rowHeight,
      h,
      hp2,
      offset,
      colorForBase,
      showAllLetters,
      mismatchRendering,
      charHeight,
    }

    const refSeq = new TextDecoder().decode(regionData.refSeqBytes)
    for (const row of regionData.rows) {
      const alignment = new TextDecoder().decode(row.alignmentBytes)
      const rowTop = offset + rowHeight * row.rowIndex
      renderGaps(renderingContext, alignment, refSeq, leftPx, rowTop)
      renderMatches(renderingContext, alignment, refSeq, leftPx, rowTop)
      renderMismatches(renderingContext, alignment, refSeq, leftPx, rowTop)
      renderInsertions(renderingContext, alignment, refSeq, leftPx, rowTop, bpPerPx)

      if (scale >= CHAR_SIZE_WIDTH) {
        ctx.font = FONT_CONFIG
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        for (let i = 0, genomicOffset = 0; i < alignment.length; i++) {
          const refChar = refSeq[i]!
          if (refChar !== '-') {
            const alignChar = alignment[i]!
            if (
              (showAllLetters || refChar.toLowerCase() !== alignChar.toLowerCase()) &&
              alignChar !== '-'
            ) {
              const xPos = leftPx + scale * genomicOffset
              if (xPos >= clip.scissorX - scale && xPos <= clip.scissorX + clip.scissorW) {
                ctx.fillStyle = mismatchRendering
                  ? (contrastForBase[alignChar.toLowerCase()] ?? 'black')
                  : 'black'
                ctx.fillText(
                  showAsUpperCase ? alignChar.toUpperCase() : alignChar,
                  xPos + (scale - CHAR_SIZE_WIDTH) / 2 + 1,
                  hp2 + rowTop + VERTICAL_TEXT_OFFSET,
                )
              }
            }
            genomicOffset++
          }
        }
      }
    }

    ctx.restore()
  }
}
