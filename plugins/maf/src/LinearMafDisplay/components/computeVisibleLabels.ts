import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'
import { CHAR_SIZE_WIDTH } from '../../LinearMafRenderer/rendering/types.ts'
import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'


import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

export interface VisibleLabel {
  x: number
  y: number
  text: string
  lowerBase: string
}

interface ComputeVisibleLabelsParams {
  view: VisibleRegionsView
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
  if (1 / view.bpPerPx < CHAR_SIZE_WIDTH) {
    return labels
  }

  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)
  const hp2 = h / 2

  for (const { data: regionData, bpToPx } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    for (const block of regionData.blocks) {
      const refSeqBytes = block.refSeqBytes

      for (const row of block.rows) {
        const alignmentBytes = row.alignmentBytes
        const rowTop = offset + rowHeight * row.rowIndex
        const yPos = Math.round(hp2 + rowTop)
        // Defensive min() guards malformed files (worker output should match).
        const len = Math.min(alignmentBytes.length, refSeqBytes.length)

        // Hot per-cell loop: work directly on bytes (skips a per-row
        // TextDecoder.decode() that would allocate a string only to be
        // immediately reduced to char codes). ASCII bit math matches
        // resolveCellColor's `(byte | 0x20)` match check.
        for (let i = 0, genomicOffset = 0; i < len; i++) {
          const refCode = refSeqBytes[i]!
          if (refCode !== DASH) {
            const alnCode = alignmentBytes[i]!
            if (alnCode !== DASH && alnCode !== SPACE) {
              const isMatch = (refCode | LOWER_BIT) === (alnCode | LOWER_BIT)
              if (showAllLetters || !isMatch) {
                const displayCode = showAsUpperCase
                  ? alnCode & ~LOWER_BIT
                  : alnCode
                labels.push({
                  // +0.5 → cell center, orientation-aware via bpToPx
                  x: bpToPx(block.startBp + genomicOffset + 0.5),
                  y: yPos,
                  text: String.fromCharCode(displayCode),
                  lowerBase: String.fromCharCode(alnCode | LOWER_BIT),
                })
              }
            }
            genomicOffset++
          }
        }
      }
    }
  }

  return labels
}
