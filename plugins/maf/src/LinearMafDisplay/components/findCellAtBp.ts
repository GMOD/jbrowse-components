import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafBackendTypes.ts'

/**
 * Locate the cell on `rowIndex` at absolute genomic `bp` within a region's
 * fetched MAF blocks. Returns the base (case-folded per `showAsUpperCase`)
 * or undefined when no block covers the bp, the matching block has no entry
 * for `rowIndex`, or the cell is a gap. ASCII bit math matches
 * `computeVisibleLabels` so the tooltip base case is identical to the
 * on-screen label.
 */
export function findCellAtBp(
  region: MafRegionData,
  bp: number,
  rowIndex: number,
  showAsUpperCase: boolean,
): { base: string } | undefined {
  const targetBp = Math.floor(bp)
  for (const block of region.blocks) {
    if (block.startBp > targetBp) {
      continue
    }
    const refSeqBytes = block.refSeqBytes
    const len = refSeqBytes.length
    let genomicOffset = 0
    for (let i = 0; i < len; i++) {
      if (refSeqBytes[i]! !== DASH) {
        if (block.startBp + genomicOffset === targetBp) {
          const row = block.rows.find(r => r.rowIndex === rowIndex)
          if (!row) {
            return undefined
          }
          const code = row.alignmentBytes[i]
          if (code === undefined || code === SPACE || code === DASH) {
            return undefined
          }
          const displayCode = showAsUpperCase ? code & ~LOWER_BIT : code
          return { base: String.fromCharCode(displayCode) }
        }
        genomicOffset++
        if (block.startBp + genomicOffset > targetBp) {
          break
        }
      }
    }
  }
  return undefined
}
