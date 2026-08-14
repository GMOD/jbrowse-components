// get relative reference sequence positions for positions given relative to
// the read sequence

import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from './cigarConstants.ts'

/**
 * #api
 * Maps read-sequence positions to reference-sequence positions via the CIGAR,
 * invoking the callback for each. Handles both packed Uint32Array and unpacked
 * number[] CIGAR formats.
 *
 * **Driven by the POSITIONS, not by the read bases.** This used to run an inner
 * loop over every base an op spans, testing `positions[currPos] === readPos + j`
 * — so it was O(read length) to find something O(positions) in size. On the full
 * extent of `200x.longread.mod.bam` that is 43.7 Mbp of read sequence scanned to
 * place 0.84M modification calls. Within one op the read-to-reference offset is
 * a constant, so each position's answer is one addition and the ops only have to
 * be walked once: O(positions + ops).
 * `plugins/alignments/benches/cigarWalkShape.bench.ts` prices it at **1.17x on
 * the whole per-read modification pipeline**, of which this walk is 45%.
 *
 * The iteration count does not fall as far as that ratio suggests, and the bench
 * header says why: these reads carry 7,000 cigar ops apiece, so the op loop —
 * which neither shape avoids — is most of what is left.
 *
 * `positions` must be ASCENDING, which every caller's producer guarantees. The
 * one behaviour that changed with the shape: a REPEATED position used to be
 * dropped and to block every position after it (the per-base loop could match at
 * most one position per base offset), and now emits once per occurrence.
 */
export function getNextRefPos(
  cigarOps: ArrayLike<number>,
  positions: number[],
  callback: (ref: number, idx: number) => void,
): void {
  const l2 = positions.length
  if (l2 === 0) {
    return
  }
  let readPos = 0
  let refPos = 0
  let currPos = 0

  for (let i = 0, l = cigarOps.length; i < l && currPos < l2; i++) {
    const packed = cigarOps[i]!
    const len = packed >>> 4
    const op = packed & 0xf

    if (op === CIGAR_S || op === CIGAR_I) {
      // Consumes read but not reference: skip the positions that land in it.
      const readEnd = readPos + len
      while (currPos < l2 && positions[currPos]! < readEnd) {
        currPos++
      }
      readPos = readEnd
    } else if (op === CIGAR_D || op === CIGAR_N) {
      refPos += len
    } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
      const readEnd = readPos + len
      // Constant across the op, so placing a position is one add.
      const delta = refPos - readPos
      while (currPos < l2 && positions[currPos]! < readEnd) {
        callback(positions[currPos]! + delta, currPos)
        currPos++
      }
      readPos = readEnd
      refPos += len
    }
  }
}
