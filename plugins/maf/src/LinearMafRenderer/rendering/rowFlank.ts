import { DASH, SPACE } from '../../util/asciiBytes.ts'

import type { MafBlock } from '../mafRenderingBackendTypes.ts'

export interface RowFlank {
  /** the sample resumes aligned sequence in the block abutting on the left */
  boundedLeft: boolean
  /** ...and on the right */
  boundedRight: boolean
}

function isAligned(byte: number | undefined) {
  return byte !== undefined && byte !== DASH && byte !== SPACE
}

// A neighbouring block resolves a run only when it abuts in reference
// coordinates AND carries this row with sequence at the shared seam.
function seamAligned(
  neighbour: MafBlock | undefined,
  abuts: boolean,
  rowIndex: number,
  seamByte: (alignmentBytes: Uint8Array) => number | undefined,
) {
  const row =
    neighbour !== undefined && abuts
      ? neighbour.rows.find(r => r.rowIndex === rowIndex)
      : undefined
  return row !== undefined && isAligned(seamByte(row.alignmentBytes))
}

const lastByte = (bytes: Uint8Array) => bytes[bytes.length - 1]
const firstByte = (bytes: Uint8Array) => bytes[0]

/**
 * `makeRowFlank`'s answer for a single (block, row), read straight off the two
 * abutting blocks instead of indexing every block's rows first.
 *
 * The hover hit-test needs exactly one flank per mousemove, and building the
 * whole index for it was the entire cost: the fetched region is the *buffered*
 * one, so on the UCSC ce11 26-way shape that is ~48k blocks x 26 rows of set
 * inserts on every pointer move. The per-frame walks below still want the index
 * — they ask for every (block, row) — so both live here and
 * `rowFlank.test.ts` pins them to the same answer.
 */
export function rowFlankAt(
  blocks: MafBlock[],
  blockIndex: number,
  rowIndex: number,
): RowFlank {
  const block = blocks[blockIndex]!
  const prev = blocks[blockIndex - 1]
  const next = blocks[blockIndex + 1]
  return {
    boundedLeft: seamAligned(
      prev,
      prev?.endBp === block.startBp,
      rowIndex,
      lastByte,
    ),
    boundedRight: seamAligned(
      next,
      next?.startBp === block.endBp,
      rowIndex,
      firstByte,
    ),
  }
}

/**
 * Resolves, per block and row, whether a gap run running off either end of that
 * row is closed by the neighbouring block — the input `resolvedExtent` needs to
 * tell a real block-edge deletion from a chunking artifact.
 *
 * A side is bounded when the neighbouring block abuts in reference coordinates
 * AND carries this row with sequence right at the shared seam. Both halves
 * matter: blocks separated by a reference gap say nothing about each other, and
 * a neighbour whose row also starts with gaps means the run continues past it,
 * so its length is still unknown from here.
 *
 * Only the last byte of the left neighbour and the first byte of the right one
 * are read, so this is a single O(rows) pass per block rather than a walk. The
 * outermost blocks of a fetched region have no neighbour to consult and so read
 * as unbounded, which errs toward blank — the same call the middle of a long
 * non-alignment gets.
 */
/** Bits of a block's per-row edge mask: does this row's own sequence reach the
 *  block's first / last column. */
const STARTS_ALIGNED = 1
const ENDS_ALIGNED = 2

export function makeRowFlank(blocks: MafBlock[]) {
  // A block's edges are one **byte per row** — two bits, indexed by `rowIndex` —
  // not two `Set<number>`. Row indices are dense and small (the display's row
  // count), so the set was a hash table per side per block to answer a question
  // a bit already answers, and it is built once per block per pass whatever the
  // caller skips.
  //
  // That mattered because the lazy fill below does NOT help the caller that
  // needs this most. The two Canvas2D painters skip the buffered region's
  // off-screen blocks first (`computeVisibleDeletions` by visible span,
  // `drawMafBlocks` by render-block clip), so they touch about half the blocks —
  // but `buildInstanceBuffer` encodes the *whole* region, so it always paid the
  // worst case: on the UCSC ce11 26-way shape (48k blocks, median 7bp, 26 rows)
  // ~96k sets and ~1.2M inserts on every encode, which is every zoom tier, theme
  // change and row reorder. Measured over that shape, flank + `resolvedExtent`
  // went 949ms -> 256ms, byte-identical on 1.2M (block, row) pairs.
  //
  // Sized to the block's own highest row index rather than the display's row
  // count, which is not known here; a row index past the end reads `undefined`
  // and falls to 0, which is the right answer — that row is not in this block.
  const edges = new Array<Uint8Array | undefined>(blocks.length)

  function edgesAt(blockIndex: number): Uint8Array {
    const cached = edges[blockIndex]
    if (cached !== undefined) {
      return cached
    }
    const { rows } = blocks[blockIndex]!
    let maxRow = -1
    for (const row of rows) {
      if (row.rowIndex > maxRow) {
        maxRow = row.rowIndex
      }
    }
    const mask = new Uint8Array(maxRow + 1)
    for (const { rowIndex, alignmentBytes } of rows) {
      mask[rowIndex] =
        (isAligned(alignmentBytes[0]) ? STARTS_ALIGNED : 0) |
        (isAligned(alignmentBytes[alignmentBytes.length - 1])
          ? ENDS_ALIGNED
          : 0)
    }
    edges[blockIndex] = mask
    return mask
  }

  return function rowFlank(blockIndex: number, rowIndex: number): RowFlank {
    const block = blocks[blockIndex]!
    const prev = blocks[blockIndex - 1]
    const next = blocks[blockIndex + 1]
    return {
      boundedLeft:
        prev !== undefined &&
        prev.endBp === block.startBp &&
        ((edgesAt(blockIndex - 1)[rowIndex] ?? 0) & ENDS_ALIGNED) !== 0,
      boundedRight:
        next !== undefined &&
        next.startBp === block.endBp &&
        ((edgesAt(blockIndex + 1)[rowIndex] ?? 0) & STARTS_ALIGNED) !== 0,
    }
  }
}
