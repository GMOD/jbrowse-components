import { CHAR_SIZE_WIDTH, VERTICAL_TEXT_OFFSET } from '../../LinearMafRenderer/rendering/types.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafBackendTypes.ts'

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
  rpcDataMap: { get(idx: number): { regionData: MafRegionData } | undefined }
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
  const decoder = new TextDecoder()
  const xOffsetInCell = (scale - CHAR_SIZE_WIDTH) / 2 + 1

  for (const vr of view.visibleRegions) {
    const entry = rpcDataMap.get(vr.displayedRegionIndex)
    if (!entry) {
      continue
    }
    const { regionData } = entry
    const leftPx = vr.screenStartPx + (regionData.startBp - vr.start) * scale
    const refSeq = decoder.decode(regionData.refSeqBytes)

    for (const row of regionData.rows) {
      const alignment = decoder.decode(row.alignmentBytes)
      const rowTop = offset + rowHeight * row.rowIndex
      const yPos = hp2 + rowTop + VERTICAL_TEXT_OFFSET

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
              x: leftPx + scale * genomicOffset + xOffsetInCell,
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

  return labels
}
