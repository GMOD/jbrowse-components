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
} from '../PileupRenderer/renderers/cigarUtil'

// Handles both packed Uint32Array and unpacked number[] formats
export function getNextRefPos(
  cigarOps: ArrayLike<number>,
  positions: number[],
) {
  let readPos = 0
  let refPos = 0
  let currPos = 0
  const ret = []

  for (
    let i = 0, l = cigarOps.length, l2 = positions.length;
    i < l && currPos < l2;
    i++
  ) {
    const packed = cigarOps[i]!
    const len = packed >> 4
    const op = packed & 0xf
    if (op === CIGAR_S || op === CIGAR_I) {
      for (let i = 0; i < len && currPos < l2; i++) {
        if (positions[currPos] === readPos + i) {
          currPos++
        }
      }
      readPos += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      refPos += len
    } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
      for (let i = 0; i < len && currPos < l2; i++) {
        if (positions[currPos] === readPos + i) {
          ret.push({
            ref: refPos + i,
            idx: currPos,
          })
          currPos++
        }
      }
      readPos += len
      refPos += len
    }
  }

  return ret
}
