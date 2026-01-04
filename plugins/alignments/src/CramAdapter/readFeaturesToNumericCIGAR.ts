import {
  CODE_B,
  CODE_D,
  CODE_H,
  CODE_I,
  CODE_N,
  CODE_P,
  CODE_S,
  CODE_X,
  CODE_b,
  CODE_i,
} from './const'

import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

// CIGAR operation char codes to indices (from BAM spec)
const CIGAR_CODE_TO_INDEX: Record<number, number> = {
  77: 0, // M
  73: 1, // I
  68: 2, // D
  78: 3, // N
  83: 4, // S
  72: 5, // H
  80: 6, // P
  61: 7, // =
  88: 8, // X
}

// Generates packed NUMERIC_CIGAR format: Uint32Array where each value is (length << 4) | opIndex
export function readFeaturesToNumericCIGAR(
  readFeatures: ReadFeatures,
  alignmentStart: number,
  readLen: number,
): ArrayLike<number> {
  const cigarParts: number[] = []
  let op = 77 // 'M'
  let oplen = 0
  let lastPos = alignmentStart
  let insLen = 0
  let seqLen = 0

  if (readFeatures !== undefined) {
    for (let i = 0, l = readFeatures.length; i < l; i++) {
      const { code, refPos, data } = readFeatures[i]!
      const sublen = refPos - lastPos
      seqLen += sublen
      lastPos = refPos

      // Flush pending insertions if we have a match region
      if (insLen && sublen) {
        const opIndex = CIGAR_CODE_TO_INDEX[73]! // I
        cigarParts.push((insLen << 4) | opIndex)
        insLen = 0
      }
      // Flush previous non-match operation
      if (oplen && op !== 77) {
        const opIndex = CIGAR_CODE_TO_INDEX[op]!
        cigarParts.push((oplen << 4) | opIndex)
        oplen = 0
      }
      // Accumulate match length
      if (sublen) {
        op = 77 // 'M'
        oplen += sublen
      }

      const codeChar = code.charCodeAt(0)

      if (codeChar === CODE_b) {
        // An array of bases stored verbatim
        const addedLen = data.split(',').length
        seqLen += addedLen
        lastPos += addedLen
        oplen += addedLen
      } else if (codeChar === CODE_B || codeChar === CODE_X) {
        // Single base (+ qual score) or Substitution - both increment by 1
        seqLen++
        lastPos++
        oplen++
      } else if (codeChar === CODE_D || codeChar === CODE_N) {
        // Deletion or Ref Skip
        lastPos += data
        if (oplen) {
          const opIndex = CIGAR_CODE_TO_INDEX[op]!
          cigarParts.push((oplen << 4) | opIndex)
          oplen = 0
        }
        const opIndex = CIGAR_CODE_TO_INDEX[codeChar]!
        cigarParts.push((data << 4) | opIndex)
      } else if (codeChar === CODE_I || codeChar === CODE_S) {
        // Insertion or soft-clip
        const dataLen = data.length
        seqLen += dataLen
        if (oplen) {
          const opIndex = CIGAR_CODE_TO_INDEX[op]!
          cigarParts.push((oplen << 4) | opIndex)
          oplen = 0
        }
        const opIndex = CIGAR_CODE_TO_INDEX[codeChar]!
        cigarParts.push((dataLen << 4) | opIndex)
      } else if (codeChar === CODE_i) {
        // Single base insertion
        if (oplen) {
          const opIndex = CIGAR_CODE_TO_INDEX[op]!
          cigarParts.push((oplen << 4) | opIndex)
          oplen = 0
        }
        insLen++
        seqLen++
      } else if (codeChar === CODE_P || codeChar === CODE_H) {
        // Padding or Hard clip
        if (oplen) {
          const opIndex = CIGAR_CODE_TO_INDEX[op]!
          cigarParts.push((oplen << 4) | opIndex)
          oplen = 0
        }
        const opIndex = CIGAR_CODE_TO_INDEX[codeChar]!
        cigarParts.push((data << 4) | opIndex)
      } // else q or Q (no-op)
    }
  }

  // Handle remaining sequence length
  const remaining = readLen - seqLen
  if (remaining) {
    if (oplen && op !== 77) {
      const opIndex = CIGAR_CODE_TO_INDEX[op]!
      cigarParts.push((oplen << 4) | opIndex)
      oplen = 0
    }
    op = 77 // 'M'
    oplen += remaining
  }

  // Flush pending insertions
  if (remaining && insLen) {
    const opIndex = CIGAR_CODE_TO_INDEX[73]! // I
    cigarParts.push((insLen << 4) | opIndex)
  }
  // Flush final operation
  if (oplen) {
    const opIndex = CIGAR_CODE_TO_INDEX[op]!
    cigarParts.push((oplen << 4) | opIndex)
  }

  return cigarParts
}
