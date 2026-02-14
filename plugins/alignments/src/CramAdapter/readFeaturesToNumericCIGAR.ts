import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

const CIGAR_OP_INDEX: Record<string, number> = {
  M: 0,
  I: 1,
  D: 2,
  N: 3,
  S: 4,
  H: 5,
  P: 6,
  '=': 7,
  X: 8,
}

// Generates packed NUMERIC_CIGAR format: Uint32Array where each value is (length << 4) | opIndex
export function readFeaturesToNumericCIGAR(
  readFeatures: ReadFeatures,
  alignmentStart: number,
  readLen: number,
): ArrayLike<number> {
  const cigarParts: number[] = []
  let op = 'M'
  let oplen = 0
  let lastPos = alignmentStart
  let insLen = 0
  let seqLen = 0

  if (readFeatures !== undefined) {
    for (let i = 0, l = readFeatures.length; i < l; i++) {
      const rf = readFeatures[i]!
      const sublen = rf.refPos - lastPos
      seqLen += sublen
      lastPos = rf.refPos

      // Flush pending insertions if we have a match region
      if (insLen && sublen) {
        cigarParts.push((insLen << 4) | CIGAR_OP_INDEX.I!)
        insLen = 0
      }
      // Flush previous non-match operation
      if (oplen && op !== 'M') {
        cigarParts.push((oplen << 4) | CIGAR_OP_INDEX[op]!)
        oplen = 0
      }
      // Accumulate match length
      if (sublen) {
        op = 'M'
        oplen += sublen
      }

      if (rf.code === 'b') {
        const addedLen = rf.data.split(',').length
        seqLen += addedLen
        lastPos += addedLen
        oplen += addedLen
      } else if (rf.code === 'B' || rf.code === 'X') {
        seqLen++
        lastPos++
        oplen++
      } else if (rf.code === 'D' || rf.code === 'N') {
        lastPos += rf.data
        if (oplen) {
          cigarParts.push((oplen << 4) | CIGAR_OP_INDEX[op]!)
          oplen = 0
        }
        cigarParts.push((rf.data << 4) | CIGAR_OP_INDEX[rf.code]!)
      } else if (rf.code === 'I' || rf.code === 'S') {
        const dataLen = rf.data.length
        seqLen += dataLen
        if (oplen) {
          cigarParts.push((oplen << 4) | CIGAR_OP_INDEX[op]!)
          oplen = 0
        }
        cigarParts.push((dataLen << 4) | CIGAR_OP_INDEX[rf.code]!)
      } else if (rf.code === 'i') {
        if (oplen) {
          cigarParts.push((oplen << 4) | CIGAR_OP_INDEX[op]!)
          oplen = 0
        }
        insLen++
        seqLen++
      } else if (rf.code === 'P' || rf.code === 'H') {
        if (oplen) {
          cigarParts.push((oplen << 4) | CIGAR_OP_INDEX[op]!)
          oplen = 0
        }
        cigarParts.push((rf.data << 4) | CIGAR_OP_INDEX[rf.code]!)
      } // else q or Q (no-op)
    }
  }

  // Handle remaining sequence length
  const remaining = readLen - seqLen
  if (remaining) {
    if (oplen && op !== 'M') {
      cigarParts.push((oplen << 4) | CIGAR_OP_INDEX[op]!)
      oplen = 0
    }
    op = 'M'
    oplen += remaining
  }

  // Flush pending insertions
  if (remaining && insLen) {
    cigarParts.push((insLen << 4) | CIGAR_OP_INDEX.I!)
  }
  // Flush final operation
  if (oplen) {
    cigarParts.push((oplen << 4) | CIGAR_OP_INDEX[op]!)
  }

  return cigarParts
}
