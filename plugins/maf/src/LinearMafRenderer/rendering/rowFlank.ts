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
export function makeRowFlank(blocks: MafBlock[]) {
  // Filled on first use rather than up front. Every caller now skips the
  // buffered region's off-screen blocks before asking (`computeVisibleDeletions`
  // by visible span, `drawMafBlocks` by render-block clip), and eagerly indexing
  // was the one part of the pass that ignored that: two `Set`s per block, so on
  // the UCSC ce11 26-way shape ~85k sets and a million inserts per frame, most
  // of them for blocks nothing then looked at. A block's edges are still built
  // at most once per pass, so the walk-everything case costs what it did.
  interface BlockEdges {
    startsAligned: Set<number>
    endsAligned: Set<number>
  }
  const edges = new Array<BlockEdges | undefined>(blocks.length)

  function edgesAt(blockIndex: number): BlockEdges {
    const cached = edges[blockIndex]
    if (cached !== undefined) {
      return cached
    }
    const startsAligned = new Set<number>()
    const endsAligned = new Set<number>()
    for (const { rowIndex, alignmentBytes } of blocks[blockIndex]!.rows) {
      if (isAligned(alignmentBytes[0])) {
        startsAligned.add(rowIndex)
      }
      if (isAligned(alignmentBytes[alignmentBytes.length - 1])) {
        endsAligned.add(rowIndex)
      }
    }
    const entry = { startsAligned, endsAligned }
    edges[blockIndex] = entry
    return entry
  }

  return function rowFlank(blockIndex: number, rowIndex: number): RowFlank {
    const block = blocks[blockIndex]!
    const prev = blocks[blockIndex - 1]
    const next = blocks[blockIndex + 1]
    return {
      boundedLeft:
        prev !== undefined &&
        prev.endBp === block.startBp &&
        edgesAt(blockIndex - 1).endsAligned.has(rowIndex),
      boundedRight:
        next !== undefined &&
        next.startBp === block.endBp &&
        edgesAt(blockIndex + 1).startsAligned.has(rowIndex),
    }
  }
}
