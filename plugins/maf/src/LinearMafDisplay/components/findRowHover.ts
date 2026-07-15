import { insertionBarWidth } from '@jbrowse/alignments-core'

import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'
import { forEachInsertion } from '../../LinearMafRenderer/rendering/forEachInsertion.ts'
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

export interface InsertionHit {
  kind: 'insertion'
  /** number of inserted bases in this sample relative to the reference */
  length: number
  /** the inserted bases (sample sequence within the ref-gap run) */
  sequence: string
  chr?: string
  /** 0-based forward-strand genomic coord of the first inserted base */
  pos?: number
  strand?: number
}

export interface DeletionHit {
  kind: 'deletion'
  /** number of reference bases this sample deletes (the gap-run length) */
  length: number
}

export interface EmptyHit {
  kind: 'empty'
  status: MafStatus
  chr: string
  start: number
  size: number
  strand: number
}

export type RowHit = CellHit | InsertionHit | DeletionHit | EmptyHit

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

// Resolve an insertion marker under the cursor. Insertions are interbase (the
// reference has gaps where this sample carries bases) so they are drawn at a
// cell boundary, not on a cell — hit-test by genomic distance to the marker
// anchor, mirroring plugin-alignments (same insertionBarWidth+4px box). The
// `forEachInsertion` walk is shared with the renderers so hover and draw can't
// disagree. `gposFrac` is the absolute fractional cursor coordinate; distance
// is orientation-independent.
function insertionHitInRow(
  block: MafBlock,
  row: MafAlignedRow,
  gposFrac: number,
  bpPerPx: number,
  showAsUpperCase: boolean,
): InsertionHit | undefined {
  const aln = row.alignmentBytes
  let hit: InsertionHit | undefined
  forEachInsertion(
    block.refSeqBytes,
    aln,
    block.startBp,
    (anchorBp, length, baseOffset, byteStart, byteEnd) => {
      const rectWidthPx = insertionBarWidth(length, 1 / bpPerPx) + 4
      const halfBp = (rectWidthPx / 2) * bpPerPx
      if (!hit && Math.abs(gposFrac - anchorBp) < halfBp) {
        let sequence = ''
        for (let k = byteStart; k < byteEnd; k++) {
          const code = aln[k]!
          if (code !== DASH && code !== SPACE) {
            sequence += String.fromCharCode(
              showAsUpperCase ? code & ~LOWER_BIT : code,
            )
          }
        }
        hit = {
          kind: 'insertion',
          length,
          sequence,
          chr: row.chr,
          pos: forwardPos(row, baseOffset),
          strand: row.strand,
        }
      }
    },
  )
  return hit
}

// Resolve a deletion under the cursor: a run of reference bases where this
// sample carries an alignment gap. Shares the `forEachDeletion` walk with the
// bp-count overlay + Canvas2D export so hover and draw can't disagree on where
// deletions are or how long they are.
function deletionHitInRow(
  block: MafBlock,
  row: MafAlignedRow,
  targetBp: number,
): DeletionHit | undefined {
  let hit: DeletionHit | undefined
  forEachDeletion(
    block.refSeqBytes,
    row.alignmentBytes,
    block.startBp,
    (start, length) => {
      if (targetBp >= start && targetBp < start + length) {
        hit = { kind: 'deletion', length }
      }
    },
  )
  return hit
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
 * (`cell`), an interbase `insertion` marker, a `deletion` run, or a
 * bridged/empty region (`empty`). An insertion under the cursor wins over the
 * base it abuts (within its narrow marker box), matching plugin-alignments; a
 * gap cell falls through to the deletion run that covers it. Returns undefined
 * when no block covers the bp or the row is absent. Blocks are genomically
 * disjoint and sorted, so the first covering
 * block is authoritative. `gposFrac` is the fractional cursor coordinate (its
 * integer floor selects the cell; the fraction enables px-accurate insertion
 * hit-testing).
 */
export function findRowHoverAtBp(
  region: MafRegionData,
  gposFrac: number,
  rowIndex: number,
  showAsUpperCase: boolean,
  bpPerPx: number,
): RowHit | undefined {
  const targetBp = Math.floor(gposFrac)
  for (const block of region.blocks) {
    if (block.startBp > targetBp) {
      break
    }
    if (targetBp < block.endBp) {
      const row = block.rows.find(r => r.rowIndex === rowIndex)
      if (row) {
        return (
          insertionHitInRow(block, row, gposFrac, bpPerPx, showAsUpperCase) ??
          cellHitInRow(block, row, targetBp, showAsUpperCase) ??
          deletionHitInRow(block, row, targetBp)
        )
      }
      const empty = block.empties.find(e => e.rowIndex === rowIndex)
      return empty ? emptyHit(empty) : undefined
    }
  }
  return undefined
}
