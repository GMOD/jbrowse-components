import { CHAR_SIZE_WIDTH } from '../../LinearMafRenderer/rendering/types.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafBackendTypes.ts'

const decoder = new TextDecoder()

export interface VisibleLabel {
  x: number
  y: number
  text: string
  lowerBase: string
}

interface LabelView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    screenStartPx: number
  }[]
  bpPerPx: number
}

interface ComputeVisibleLabelsParams {
  view: LabelView
  rpcDataMap: { get(idx: number): MafRegionData | undefined }
  rowHeight: number
  rowProportion: number
  showAllLetters: boolean
  showAsUpperCase: boolean
}

export function computeVisibleLabels(
  params: ComputeVisibleLabelsParams,
): VisibleLabel[] {
  const {
    view,
    rpcDataMap,
    rowHeight,
    rowProportion,
    showAllLetters,
    showAsUpperCase,
  } = params

  const labels: VisibleLabel[] = []
  const scale = 1 / view.bpPerPx
  if (scale < CHAR_SIZE_WIDTH) {
    return labels
  }

  const h = rowHeight * rowProportion
  const hp2 = h / 2
  const offset = (rowHeight - h) / 2
  const halfScale = scale / 2

  for (const vr of view.visibleRegions) {
    const regionData = rpcDataMap.get(vr.displayedRegionIndex)
    if (!regionData) {
      continue
    }
    for (const block of regionData.blocks) {
      const leftPx = vr.screenStartPx + (block.startBp - vr.start) * scale
      const refSeq = decoder.decode(block.refSeqBytes)

      for (const row of block.rows) {
        const alignment = decoder.decode(row.alignmentBytes)
        const rowTop = offset + rowHeight * row.rowIndex
        const yPos = Math.round(hp2 + rowTop)

        for (let i = 0, genomicOffset = 0; i < alignment.length; i++) {
          const refChar = refSeq[i]!
          if (refChar !== '-') {
            const alignChar = alignment[i]!
            if (
              (showAllLetters ||
                refChar.toLowerCase() !== alignChar.toLowerCase()) &&
              alignChar !== '-'
            ) {
              labels.push({
                x: leftPx + scale * genomicOffset + halfScale,
                y: yPos,
                text: showAsUpperCase ? alignChar.toUpperCase() : alignChar,
                lowerBase: alignChar.toLowerCase(),
              })
            }
            genomicOffset++
          }
        }
      }
    }
  }

  return labels
}
