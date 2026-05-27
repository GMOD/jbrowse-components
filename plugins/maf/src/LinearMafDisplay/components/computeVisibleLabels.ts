import { CHAR_SIZE_WIDTH } from '../../LinearMafRenderer/rendering/types.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafBackendTypes.ts'

const DASH = 45 // '-'.charCodeAt(0)
const SPACE = 32 // ' '.charCodeAt(0)
const LOWER_BIT = 0x20

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
    end: number
    screenStartPx: number
    reversed?: boolean
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
    const reversed = vr.reversed ?? false
    const bpEdge = reversed ? vr.end : vr.start
    // Center of the cell at bp = bpEdge ± offset, switching pivot for reversed
    // so labels land in the middle of their cell in either orientation.
    const bpCenterToPx = reversed
      ? (bp: number) => vr.screenStartPx + (bpEdge - bp) * scale - halfScale
      : (bp: number) => vr.screenStartPx + (bp - bpEdge) * scale + halfScale
    for (const block of regionData.blocks) {
      const refSeq = decoder.decode(block.refSeqBytes)

      for (const row of block.rows) {
        const alignment = decoder.decode(row.alignmentBytes)
        const rowTop = offset + rowHeight * row.rowIndex
        const yPos = Math.round(hp2 + rowTop)
        // refSeq/alignment should be same length per MAF spec; defensive
        // min() mirrors mafInstanceBuffer.ts so a malformed file doesn't
        // crash on `undefined.toLowerCase()`.
        const len = Math.min(alignment.length, refSeq.length)

        // Hot per-cell loop: use charCodeAt + ASCII bit math instead of
        // toLowerCase/toUpperCase (per-call string allocations) and ===
        // string compares. Matches resolveCellColor's `(byte | 0x20)` match
        // check so the gap/match predicate stays in sync with the renderers.
        for (let i = 0, genomicOffset = 0; i < len; i++) {
          const refCode = refSeq.charCodeAt(i)
          if (refCode !== DASH) {
            const alnCode = alignment.charCodeAt(i)
            if (alnCode !== DASH && alnCode !== SPACE) {
              const isMatch = (refCode | LOWER_BIT) === (alnCode | LOWER_BIT)
              if (showAllLetters || !isMatch) {
                labels.push({
                  x: bpCenterToPx(block.startBp + genomicOffset),
                  y: yPos,
                  text: showAsUpperCase
                    ? String.fromCharCode(alnCode & ~LOWER_BIT)
                    : alignment[i]!,
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
