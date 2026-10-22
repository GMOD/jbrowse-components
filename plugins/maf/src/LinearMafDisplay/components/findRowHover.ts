import { insertionBarWidth } from '@jbrowse/alignments-core'
import { DASH, LOWER_BIT, isGapByte } from '@jbrowse/core/util/alignedBytes'

import { blockIndexAtBp } from '../../LinearMafRenderer/blockAtBp.ts'
import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'
import { forEachInsertion } from '../../LinearMafRenderer/rendering/forEachInsertion.ts'
import { mergedInsertions } from '../../LinearMafRenderer/rendering/insertions.ts'
import { rowFlankOf } from '../../LinearMafRenderer/rendering/rowFlank.ts'

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
  /** 0-based forward-strand start of the bridged span */
  srcStart: number
  size: number
  strand: number
}

export type RowHit = CellHit | InsertionHit | DeletionHit | EmptyHit

/**
 * The cursor's genomic position in the two forms a row hover needs. `gposFrac`
 * is continuous, for the insertion hit test: an insertion is interbase, so the
 * px distance to a cell boundary decides the hit. `baseBp` names a cell, so it
 * is the base the painters put under that pixel (`basePaintedAt`, render-core's
 * `bpAtPx`); on a reversed region `Math.floor(gposFrac)` names the base to its
 * right.
 */
export interface HoverBp {
  gposFrac: number
  baseBp: number
}

// Forward-strand coordinate of the base `baseOffset` non-gap bases into the
// row; for '-' rows `srcStart` is relative to the reverse complement, so mirror
// through srcSize.
export function forwardPos(row: MafAlignedRow, baseOffset: number) {
  if (row.srcStart === undefined) {
    return undefined
  }
  return row.strand === -1
    ? row.srcSize === undefined
      ? undefined
      : row.srcSize - 1 - row.srcStart - baseOffset
    : row.srcStart + baseOffset
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
 * The aligned byte a row carries in the reference column at `targetBp` — a
 * base, or `DASH`/`SPACE` where the row has a gap there — plus how many of the
 * row's own bases precede it. Undefined when the block's reference never
 * reaches that column.
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
    if (!isGapByte(code)) {
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
  if (!column || isGapByte(column.code)) {
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

// Resolve an insertion marker under the cursor from the channel the painter
// draws (each row's insertions merged per `binBp` bin). The hit test measures
// genomic distance to the marker anchor, mirroring plugin-alignments
// (insertionBarWidth+4px box); the nearest marker whose box holds the cursor
// wins.
function insertionHitInRow(
  region: MafRegionData,
  rowIndex: number,
  gposFrac: number,
  bpPerPx: number,
  rowBandPx: number,
  binBp: number,
  showAsUpperCase: boolean,
): InsertionHit | undefined {
  const { x, row, length, count } = mergedInsertions(region, binBp)
  let nearest = -1
  let nearestDist = Infinity
  for (let i = 0; i < count; i++) {
    if (row[i] === rowIndex) {
      const dist = Math.abs(gposFrac - x[i]!)
      const rectWidthPx =
        insertionBarWidth(length[i]!, 1 / bpPerPx, rowBandPx) + 4
      if (dist < (rectWidthPx / 2) * bpPerPx && dist < nearestDist) {
        nearest = i
        nearestDist = dist
      }
    }
  }
  return nearest === -1
    ? undefined
    : describeInsertion(region, rowIndex, x[nearest]!, showAsUpperCase)
}

// An insertion split across abutting blocks is one insertion: the block
// ending at the anchor and the block starting there each hold part of it.
function describeInsertion(
  region: MafRegionData,
  rowIndex: number,
  anchor: number,
  showAsUpperCase: boolean,
): InsertionHit | undefined {
  const left = blockIndexAtBp(region.blocks, anchor - 1)
  const right = blockIndexAtBp(region.blocks, anchor)
  let hit: InsertionHit | undefined
  for (const i of left === right ? [left] : [left, right]) {
    const block = region.blocks[i]
    const row = block?.rows.find(r => r.rowIndex === rowIndex)
    if (!block || !row) {
      continue
    }
    const aln = row.alignmentBytes
    forEachInsertion(
      block.refSeqBytes,
      aln,
      block.startBp,
      (anchorBp, length, baseOffset, byteStart, byteEnd) => {
        if (anchorBp !== anchor) {
          return
        }
        let sequence = ''
        for (let k = byteStart; k < byteEnd; k++) {
          const code = aln[k]!
          if (!isGapByte(code)) {
            sequence += String.fromCharCode(
              showAsUpperCase ? code & ~LOWER_BIT : code,
            )
          }
        }
        hit = hit
          ? {
              ...hit,
              length: hit.length + length,
              sequence: hit.sequence + sequence,
            }
          : {
              kind: 'insertion',
              length,
              sequence,
              chr: row.chr,
              pos: forwardPos(row, baseOffset),
              strand: row.strand,
            }
      },
    )
  }
  return hit
}

// Resolve a deletion under the cursor. Shares the `forEachDeletion` walk with
// the bp-count overlay and Canvas2D export, so hover and draw agree.
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
    srcStart: e.strand === -1 ? e.srcSize - e.srcStart - e.size : e.srcStart,
    size: e.size,
    strand: e.strand,
  }
}

/**
 * Resolve what `rowIndex` shows at absolute genomic `bp`: an aligned base
 * (`cell`), an interbase `insertion` marker, a `deletion` run, or a
 * bridged/empty region (`empty`). An insertion marker under the cursor wins
 * over the base it abuts; a gap cell falls through to the covering deletion
 * run. Returns undefined when no block covers the bp or the row is absent.
 * `blockIndexAtBp` binary-searches because this runs on every mousemove against
 * the buffered region. See `HoverBp`.
 */
export function findRowHoverAtBp(
  region: MafRegionData,
  bp: HoverBp,
  rowIndex: number,
  showAsUpperCase: boolean,
  bpPerPx: number,
  insertionBinBp: number | undefined,
  rowBandPx: number,
): RowHit | undefined {
  const { gposFrac, baseBp: targetBp } = bp
  const insertion =
    insertionBinBp === undefined
      ? undefined
      : insertionHitInRow(
          region,
          rowIndex,
          gposFrac,
          bpPerPx,
          rowBandPx,
          insertionBinBp,
          showAsUpperCase,
        )
  if (insertion) {
    return insertion
  }
  const i = blockIndexAtBp(region.blocks, targetBp)
  if (i === -1) {
    return undefined
  }
  const block = region.blocks[i]!
  const row = block.rows.find(r => r.rowIndex === rowIndex)
  if (row) {
    return (
      cellHitInRow(block, row, targetBp, showAsUpperCase) ??
      deletionHitInRow(
        block,
        row,
        targetBp,
        rowFlankOf(region.blocks)(i, rowIndex),
      )
    )
  }
  const empty = block.empties.find(e => e.rowIndex === rowIndex)
  return empty ? emptyHit(empty) : undefined
}
