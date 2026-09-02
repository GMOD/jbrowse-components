import { insertionBarWidth } from '@jbrowse/alignments-core'

import { blockIndexAtBp } from '../../LinearMafRenderer/blockAtBp.ts'
import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'
import { forEachInsertion } from '../../LinearMafRenderer/rendering/forEachInsertion.ts'
import { rowFlankAt } from '../../LinearMafRenderer/rendering/rowFlank.ts'
import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafEmptyRow,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { RowFlank } from '../../LinearMafRenderer/rendering/rowFlank.ts'
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
  /**
   * the inserted bases in alignment order, which is the reference's left-to-
   * right direction — on a '-' row that is the reverse complement of the
   * sample's own forward strand
   */
  sequence: string
  chr?: string
  /**
   * 0-based forward-strand genomic coord of the first inserted base in
   * alignment order; on a '-' row that is the run's highest coordinate — see
   * `insertionForwardStart`
   */
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

/**
 * The cursor's genomic position in the two forms a row hover needs, which are
 * genuinely different questions and used to be answered by one number.
 *
 * `gposFrac` is continuous, and the insertion hit-test wants exactly that: an
 * insertion is *interbase*, so what decides the hit is the px distance from the
 * cursor to a cell boundary.
 *
 * `baseBp` names a cell, so it has to be the base the painters actually put
 * under that pixel — `basePaintedAt` / render-core's `bpAtPx`, which pivot one
 * base on a reversed region. `Math.floor(gposFrac)` is not that: reversed, bp
 * runs leftward, so a base covers `(b, b+1]` and the floor names the base to
 * its right — `region.end` itself, outside the region entirely, on the region's
 * first pixel column. Every reader of this in the plugin (`openSubsequenceWidget`,
 * the coverage tooltip) already asked `basePaintedAt`; the row hover, the CDS
 * frame lookup and the codon tooltip were the three that still floored, so on a
 * flipped region they named a different base than the coverage band did for the
 * same pixel.
 */
export interface HoverBp {
  gposFrac: number
  baseBp: number
}

// Forward-strand coordinate of the base `baseOffset` non-gap bases into the row.
// For '-' rows the MAF start is relative to the reverse complement, so we mirror
// through srcSize (the standard MAF coordinate transform).
export function forwardPos(row: MafAlignedRow, baseOffset: number) {
  if (row.start === undefined) {
    return undefined
  }
  return row.strand === -1
    ? row.srcSize === undefined
      ? undefined
      : row.srcSize - 1 - row.start - baseOffset
    : row.start + baseOffset
}

// Lowest forward coordinate of an insertion's bases. `InsertionHit.pos` is the
// first inserted base in ALIGNMENT order, and `forwardPos` mirrors a '-' row
// through srcSize, so there that base is the span's highest coordinate and the
// run extends leftward.
export function insertionForwardStart(
  pos: number,
  length: number,
  strand: number | undefined,
) {
  return strand === -1 ? pos - length + 1 : pos
}

/**
 * The block column carrying reference position `targetBp`, or -1 when the
 * block's reference never reaches it.
 *
 * Row-independent — it reads `refSeqBytes` and nothing else — which is the point:
 * a caller comparing *every* row at one position resolves the column once and
 * then indexes each row's bytes, where `alignedColumnAt` would re-walk the
 * block's columns per row. "Sort rows by base here" is that caller.
 *
 * `alignedColumnAt` stays a separate walk rather than being written on top of
 * this, because its `baseOffset` is a count of the row's own bases up to the
 * column and so needs the row walked anyway.
 */
export function refColumnAt(block: MafBlock, targetBp: number) {
  const ref = block.refSeqBytes
  let genomicOffset = 0
  let column = -1
  for (let i = 0; i < ref.length && column === -1; i++) {
    if (ref[i] !== DASH) {
      if (block.startBp + genomicOffset === targetBp) {
        column = i
      }
      genomicOffset++
    }
  }
  return column
}

/**
 * The aligned byte a row carries in the reference column at `targetBp` — a
 * base, or `DASH`/`SPACE` where the row has a gap there — plus how many of the
 * row's own bases precede it. Undefined when the block's reference never
 * reaches that column. The hover's walk; see `refColumnAt` for the per-row
 * comparison that does not need `baseOffset`.
 */
export function alignedColumnAt(
  block: MafBlock,
  row: MafAlignedRow,
  targetBp: number,
): { code: number; baseOffset: number } | undefined {
  const ref = block.refSeqBytes
  const aln = row.alignmentBytes
  const len = Math.min(ref.length, aln.length)
  let genomicOffset = 0
  let baseOffset = 0
  for (let i = 0; i < len; i++) {
    const code = aln[i]!
    const refIsBase = ref[i] !== DASH
    if (refIsBase && block.startBp + genomicOffset === targetBp) {
      return { code, baseOffset }
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

function cellHitInRow(
  block: MafBlock,
  row: MafAlignedRow,
  targetBp: number,
  showAsUpperCase: boolean,
): CellHit | undefined {
  const column = alignedColumnAt(block, row, targetBp)
  if (!column || column.code === DASH || column.code === SPACE) {
    return undefined
  }
  const { code, baseOffset } = column
  return {
    kind: 'cell',
    base: String.fromCharCode(showAsUpperCase ? code & ~LOWER_BIT : code),
    chr: row.chr,
    pos: forwardPos(row, baseOffset),
    strand: row.strand,
    context: row.context,
  }
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
  flank: RowFlank,
): DeletionHit | undefined {
  let hit: DeletionHit | undefined
  forEachDeletion(
    block.refSeqBytes,
    row.alignmentBytes,
    block.startBp,
    flank,
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
 * disjoint and sorted, so `blockIndexAtBp` binary-searches the one covering
 * block — this runs on every mousemove against the *buffered* region, which is
 * tens of thousands of blocks on a fine-grained multiz. See `HoverBp` for why
 * the cell and the interbase marker are selected by two different readings of
 * the same cursor.
 */
export function findRowHoverAtBp(
  region: MafRegionData,
  bp: HoverBp,
  rowIndex: number,
  showAsUpperCase: boolean,
  bpPerPx: number,
): RowHit | undefined {
  const { gposFrac, baseBp: targetBp } = bp
  const i = blockIndexAtBp(region.blocks, targetBp)
  if (i === -1) {
    return undefined
  }
  const block = region.blocks[i]!
  const row = block.rows.find(r => r.rowIndex === rowIndex)
  if (row) {
    return (
      insertionHitInRow(block, row, gposFrac, bpPerPx, showAsUpperCase) ??
      cellHitInRow(block, row, targetBp, showAsUpperCase) ??
      deletionHitInRow(
        block,
        row,
        targetBp,
        rowFlankAt(region.blocks, i, rowIndex),
      )
    )
  }
  const empty = block.empties.find(e => e.rowIndex === rowIndex)
  return empty ? emptyHit(empty) : undefined
}
