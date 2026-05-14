import { clipBlockForCanvas } from '@jbrowse/core/gpu/canvas2dUtils'

import { CHAR_SIZE_WIDTH, VERTICAL_TEXT_OFFSET } from '../../LinearMafRenderer/rendering/types.ts'

import type { MafGPURenderState, MafRegionData } from '../../LinearMafRenderer/mafBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface VisibleLabel {
  x: number
  y: number
  text: string
  lowerBase: string
}

export function computeVisibleLabels(
  renderBlocks: RenderBlock[],
  rpcDataMap: { get(key: number): { regionData: MafRegionData } | undefined },
  state: MafGPURenderState,
): VisibleLabel[] {
  const { canvasWidth, rowHeight, rowProportion, showAllLetters, showAsUpperCase } = state
  const h = rowHeight * rowProportion
  const hp2 = h / 2
  const offset = (rowHeight - h) / 2
  const labels: VisibleLabel[] = []

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

    if (scale < CHAR_SIZE_WIDTH) {
      continue
    }

    const leftPx = block.screenStartPx + (regionData.startBp - block.bpRangeX[0]) / bpPerPx
    const refSeq = new TextDecoder().decode(regionData.refSeqBytes)

    for (const row of regionData.rows) {
      const alignment = new TextDecoder().decode(row.alignmentBytes)
      const rowTop = offset + rowHeight * row.rowIndex

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
              labels.push({
                x: xPos + (scale - CHAR_SIZE_WIDTH) / 2 + 1,
                y: hp2 + rowTop + VERTICAL_TEXT_OFFSET,
                text: showAsUpperCase ? alignChar.toUpperCase() : alignChar,
                lowerBase: alignChar.toLowerCase(),
              })
            }
          }
          genomicOffset++
        }
      }
    }
  }

  return labels
}
