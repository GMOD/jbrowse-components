import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

// CIGAR operation char codes to indices (from BAM spec)
const CIGAR_OP_M = 0
const CIGAR_OP_I = 1
const CIGAR_OP_D = 2
const CIGAR_OP_N = 3
const CIGAR_OP_S = 4
const CIGAR_OP_H = 5
const CIGAR_OP_P = 6

// Generates packed NUMERIC_CIGAR format: Uint32Array where each value is (length << 4) | opIndex
export function readFeaturesToNumericCIGAR(
  readFeatures: ReadFeatures,
  alignmentStart: number,
  readLen: number,
): ArrayLike<number> {
  const cigarParts: number[] = []
  let op = CIGAR_OP_M
  let oplen = 0
  let lastPos = alignmentStart
  let insLen = 0
  let seqLen = 0

  if (readFeatures !== undefined) {
    for (let i = 0, l = readFeatures.length; i < l; i++) {
      const rf = readFeatures[i]!
      const { code, refPos } = rf
      const sublen = refPos - lastPos
      seqLen += sublen
      lastPos = refPos

      // Flush pending insertions if we have a match region
      if (insLen && sublen) {
        cigarParts.push((insLen << 4) | CIGAR_OP_I)
        insLen = 0
      }
      // Flush previous non-match operation
      if (oplen && op !== CIGAR_OP_M) {
        cigarParts.push((oplen << 4) | op)
        oplen = 0
      }
      // Accumulate match length
      if (sublen) {
        op = CIGAR_OP_M
        oplen += sublen
      }

      if (code === 'b') {
        const addedLen = rf.data.split(',').length
        seqLen += addedLen
        lastPos += addedLen
        oplen += addedLen
      } else if (code === 'B' || code === 'X') {
        seqLen++
        lastPos++
        oplen++
      } else if (code === 'D' || code === 'N') {
        lastPos += rf.data
        if (oplen) {
          cigarParts.push((oplen << 4) | op)
          oplen = 0
        }
        const opIndex = code === 'D' ? CIGAR_OP_D : CIGAR_OP_N
        cigarParts.push((rf.data << 4) | opIndex)
      } else if (code === 'I' || code === 'S') {
        const dataLen = rf.data.length
        seqLen += dataLen
        if (oplen) {
          cigarParts.push((oplen << 4) | op)
          oplen = 0
        }
        const opIndex = code === 'I' ? CIGAR_OP_I : CIGAR_OP_S
        cigarParts.push((dataLen << 4) | opIndex)
      } else if (code === 'i') {
        if (oplen) {
          cigarParts.push((oplen << 4) | op)
          oplen = 0
        }
        insLen++
        seqLen++
      } else if (code === 'P' || code === 'H') {
        if (oplen) {
          cigarParts.push((oplen << 4) | op)
          oplen = 0
        }
        const opIndex = code === 'P' ? CIGAR_OP_P : CIGAR_OP_H
        cigarParts.push((rf.data << 4) | opIndex)
      }
    }
  }

  // Handle remaining sequence length
  const remaining = readLen - seqLen
  if (remaining) {
    if (oplen && op !== CIGAR_OP_M) {
      cigarParts.push((oplen << 4) | op)
      oplen = 0
    }
    op = CIGAR_OP_M
    oplen += remaining
  }

  // Flush pending insertions
  if (remaining && insLen) {
    cigarParts.push((insLen << 4) | CIGAR_OP_I)
  }
  // Flush final operation
  if (oplen) {
    cigarParts.push((oplen << 4) | op)
  }

  return cigarParts
}
