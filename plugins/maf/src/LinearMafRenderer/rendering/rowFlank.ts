import { DASH, isGapByte } from '@jbrowse/core/util/alignedBytes'

import type { MafBlock } from '../mafRenderingBackendTypes.ts'

export interface RowFlank {
  /** the sample resumes aligned sequence in the block abutting on the left */
  boundedLeft: boolean
  /** ...and on the right */
  boundedRight: boolean
}

export type RowFlankOf = (blockIndex: number, rowIndex: number) => RowFlank

const STARTS_ALIGNED = 1
const ENDS_ALIGNED = 2

function isAligned(byte: number | undefined) {
  return byte !== undefined && !isGapByte(byte)
}

function firstRefColumn(ref: Uint8Array) {
  for (let i = 0; i < ref.length; i++) {
    if (ref[i] !== DASH) {
      return i
    }
  }
  return -1
}

function lastRefColumn(ref: Uint8Array) {
  for (let i = ref.length - 1; i >= 0; i--) {
    if (ref[i] !== DASH) {
      return i
    }
  }
  return -1
}

function edgeMask({ rows, refSeqBytes }: MafBlock) {
  let maxRow = -1
  for (const row of rows) {
    maxRow = Math.max(maxRow, row.rowIndex)
  }
  const mask = new Uint8Array(maxRow + 1)
  const first = firstRefColumn(refSeqBytes)
  if (first !== -1) {
    const last = lastRefColumn(refSeqBytes)
    for (const { rowIndex, alignmentBytes } of rows) {
      mask[rowIndex] =
        (isAligned(alignmentBytes[first]) ? STARTS_ALIGNED : 0) |
        (isAligned(alignmentBytes[last]) ? ENDS_ALIGNED : 0)
    }
  }
  return mask
}

const flankCache = new WeakMap<readonly MafBlock[], RowFlankOf>()

/**
 * Whether a gap run off either end of a block's row is closed by the
 * neighbouring block, which tells a real block-edge deletion from a chunking
 * artifact. A side is bounded when the neighbour abuts in reference
 * coordinates and carries this row with a base at its own reference column on
 * the seam. The seam column is the neighbour's first or last reference column,
 * not its first or last byte, which can be an insertion column where this row
 * is a gap only because another species inserted. A region's outermost blocks
 * read as unbounded.
 */
export function rowFlankOf(blocks: readonly MafBlock[]): RowFlankOf {
  let flank = flankCache.get(blocks)
  if (flank === undefined) {
    const edges = new Array<Uint8Array | undefined>(blocks.length)
    const edgesAt = (i: number) => (edges[i] ??= edgeMask(blocks[i]!))
    flank = (blockIndex, rowIndex) => {
      const block = blocks[blockIndex]!
      const prev = blocks[blockIndex - 1]
      const next = blocks[blockIndex + 1]
      return {
        boundedLeft:
          prev?.endBp === block.startBp &&
          ((edgesAt(blockIndex - 1)[rowIndex] ?? 0) & ENDS_ALIGNED) !== 0,
        boundedRight:
          next?.startBp === block.endBp &&
          ((edgesAt(blockIndex + 1)[rowIndex] ?? 0) & STARTS_ALIGNED) !== 0,
      }
    }
    flankCache.set(blocks, flank)
  }
  return flank
}
