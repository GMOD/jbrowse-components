import { DASH, isGapByte } from '@jbrowse/core/util/alignedBytes'

import { forwardPos } from './findRowHover.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

/** An aligned sample's own coordinates, half-open, forward strand. */
export interface RowSpan {
  refName: string
  start: number
  end: number
}

// Widen `spans[row.rowIndex]` by the row's coordinates over the reference
// range. A block on a different chromosome than the one recorded contributes
// nothing, keeping one navigable locus across a rearrangement.
function widenRowSpan(
  spans: Map<number, RowSpan>,
  block: MafBlock,
  row: MafAlignedRow,
  startBp: number,
  endBp: number,
) {
  const refName = row.srcRefName
  const current = spans.get(row.rowIndex)
  if (
    refName !== undefined &&
    (current === undefined || current.refName === refName)
  ) {
    const ref = block.refSeqBytes
    const aln = row.alignmentBytes
    const len = Math.min(ref.length, aln.length)
    let genomicOffset = 0
    let baseOffset = 0
    let min = 0
    let max = 0
    let found = false
    for (let i = 0; i < len; i++) {
      const code = aln[i]!
      const isBase = !isGapByte(code)
      const bp = block.startBp + genomicOffset
      // `bp` only ever increases, so the right edge ends this block's walk
      if (bp >= endBp) {
        break
      }
      if (isBase && bp >= startBp) {
        const pos = forwardPos(row, baseOffset)
        if (pos !== undefined) {
          min = found ? Math.min(min, pos) : pos
          max = found ? Math.max(max, pos) : pos
          found = true
        }
      }
      if (isBase) {
        baseOffset++
      }
      if (ref[i] !== DASH) {
        genomicOffset++
      }
    }
    if (found) {
      spans.set(
        row.rowIndex,
        current
          ? {
              refName,
              start: Math.min(current.start, min),
              end: Math.max(current.end, max + 1),
            }
          : { refName, start: min, end: max + 1 },
      )
    }
  }
}

/**
 * Each requested row's own locus under a reference bp range: the extent of its
 * non-gap bases between `startBp` and `endBp`. The span form of
 * `findRowHoverAtBp`'s coordinate, sharing `forwardPos` with it.
 *
 * A row that changes chromosome keeps the first chromosome that contributes a
 * base. A row with no aligned base in the range, or whose blocks carry no
 * per-row coordinates, is absent.
 *
 * Walks every requested row at once, because the track menu asks for all of
 * them (`visibleRowTargets`).
 */
export function findRowSpans(
  region: MafRegionData,
  startBp: number,
  endBp: number,
  rowIndices: ReadonlySet<number>,
) {
  const spans = new Map<number, RowSpan>()
  for (const block of region.blocks) {
    if (block.startBp >= endBp) {
      break
    }
    if (block.endBp > startBp) {
      for (const row of block.rows) {
        if (rowIndices.has(row.rowIndex)) {
          widenRowSpan(spans, block, row, startBp, endBp)
        }
      }
    }
  }
  return spans
}
