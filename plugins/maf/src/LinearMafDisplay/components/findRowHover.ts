import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafEmptyRow,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentContext, MafStatus } from '../../types.ts'

export interface CellHit {
  kind: 'cell'
  base: string
  chr?: string
  /** 0-based forward-strand genomic coord of this base (undefined if unknown) */
  pos?: number
  strand?: number
  context?: AlignmentContext
}

export interface EmptyHit {
  kind: 'empty'
  status: MafStatus
  chr: string
  start: number
  size: number
  strand: number
}

export type RowHit = CellHit | EmptyHit

// Forward-strand coordinate of the base `baseOffset` non-gap bases into the row.
// For '-' rows the MAF start is relative to the reverse complement, so we mirror
// through srcSize (the standard MAF coordinate transform).
function forwardPos(row: MafAlignedRow, baseOffset: number) {
  if (row.start === undefined) {
    return undefined
  }
  return row.strand === -1
    ? row.srcSize === undefined
      ? undefined
      : row.srcSize - 1 - row.start - baseOffset
    : row.start + baseOffset
}

function cellHitInRow(
  block: MafBlock,
  row: MafAlignedRow,
  targetBp: number,
  showAsUpperCase: boolean,
): CellHit | undefined {
  const ref = block.refSeqBytes
  const aln = row.alignmentBytes
  const len = Math.min(ref.length, aln.length)
  let genomicOffset = 0
  let baseOffset = 0
  for (let i = 0; i < len; i++) {
    const code = aln[i]!
    const refIsBase = ref[i] !== DASH
    if (refIsBase && block.startBp + genomicOffset === targetBp) {
      return code === DASH || code === SPACE
        ? undefined
        : {
            kind: 'cell',
            base: String.fromCharCode(
              showAsUpperCase ? code & ~LOWER_BIT : code,
            ),
            chr: row.chr,
            pos: forwardPos(row, baseOffset),
            strand: row.strand,
            context: row.context,
          }
    }
    if (code !== DASH && code !== SPACE) {
      baseOffset++
    }
    if (refIsBase) {
      genomicOffset++
    }
  }
  return undefined
}

function emptyHit(e: MafEmptyRow): EmptyHit {
  return {
    kind: 'empty',
    status: e.status,
    chr: e.chr,
    start: e.start,
    size: e.size,
    strand: e.strand,
  }
}

/**
 * Resolve what `rowIndex` shows at absolute genomic `bp`: an aligned base
 * (`cell`) or a bridged/empty region (`empty`). Returns undefined when no block
 * covers the bp, the row is absent from the covering block, or the cell is a
 * gap. Blocks are genomically disjoint and sorted, so the first covering block
 * is authoritative.
 */
export function findRowHoverAtBp(
  region: MafRegionData,
  bp: number,
  rowIndex: number,
  showAsUpperCase: boolean,
): RowHit | undefined {
  const targetBp = Math.floor(bp)
  for (const block of region.blocks) {
    if (block.startBp > targetBp) {
      break
    }
    if (targetBp < block.endBp) {
      const row = block.rows.find(r => r.rowIndex === rowIndex)
      if (row) {
        return cellHitInRow(block, row, targetBp, showAsUpperCase)
      }
      const empty = block.empties.find(e => e.rowIndex === rowIndex)
      return empty ? emptyHit(empty) : undefined
    }
  }
  return undefined
}
