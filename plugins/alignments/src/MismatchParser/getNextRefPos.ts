// CIGAR operation indices (from BAM spec)
const CIGAR_M_IDX = 0
const CIGAR_I_IDX = 1
const CIGAR_D_IDX = 2
const CIGAR_N_IDX = 3
const CIGAR_S_IDX = 4
const CIGAR_EQ_IDX = 7
const CIGAR_X_IDX = 8

// CIGAR operation char codes (for backward compatibility)
const CIGAR_M = 77
const CIGAR_I = 73
const CIGAR_D = 68
const CIGAR_N = 78
const CIGAR_S = 83
const CIGAR_EQ = 61
const CIGAR_X = 88

// get relative reference sequence positions for positions given relative to
// the read sequence
// Handles both packed Uint32Array and unpacked number[] formats
export function getNextRefPos(
  cigarOps: Uint32Array | number[],
  positions: number[],
) {
  let readPos = 0
  let refPos = 0
  let currPos = 0
  const ret = []

  // Detect packed vs unpacked format
  const isPacked =
    cigarOps instanceof Uint32Array ||
    cigarOps.length % 2 !== 0 ||
    (cigarOps[1] !== undefined && cigarOps[1] <= 15)

  if (isPacked) {
    // Packed format: (length << 4) | opIndex
    for (let i = 0; i < cigarOps.length && currPos < positions.length; i++) {
      const packed = cigarOps[i]!
      const len = packed >> 4
      const op = packed & 0xf
      if (op === CIGAR_S_IDX || op === CIGAR_I_IDX) {
        // 'S' or 'I'
        for (let i = 0; i < len && currPos < positions.length; i++) {
          if (positions[currPos] === readPos + i) {
            currPos++
          }
        }
        readPos += len
      } else if (op === CIGAR_D_IDX || op === CIGAR_N_IDX) {
        // 'D' or 'N'
        refPos += len
      } else if (op === CIGAR_M_IDX || op === CIGAR_X_IDX || op === CIGAR_EQ_IDX) {
        // 'M' or 'X' or '='
        for (let i = 0; i < len && currPos < positions.length; i++) {
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
  } else {
    // Unpacked format: [length, opCode, length, opCode, ...]
    for (let i = 0; i < cigarOps.length && currPos < positions.length; i += 2) {
      const len = cigarOps[i]!
      const op = cigarOps[i + 1]!
      if (op === CIGAR_S || op === CIGAR_I) {
        // 'S' or 'I'
        for (let i = 0; i < len && currPos < positions.length; i++) {
          if (positions[currPos] === readPos + i) {
            currPos++
          }
        }
        readPos += len
      } else if (op === CIGAR_D || op === CIGAR_N) {
        // 'D' or 'N'
        refPos += len
      } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
        // 'M' or 'X' or '='
        for (let i = 0; i < len && currPos < positions.length; i++) {
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
  }
  return ret
}
