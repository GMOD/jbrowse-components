import type { CramRecord } from '@gmod/cram'
import {
  CODE_B,
  CODE_b,
  CODE_D,
  CODE_H,
  CODE_i,
  CODE_I,
  CODE_N,
  CODE_P,
  CODE_S,
  CODE_X,
} from './const'

type ReadFeatures = CramRecord['readFeatures']

export function readFeaturesToCIGAR(
  readFeatures: ReadFeatures,
  alignmentStart: number,
  readLen: number,
) {
  const cigarParts: string[] = []
  let op = 'M'
  let oplen = 0
  let lastPos = alignmentStart
  let insLen = 0
  let seqLen = 0

  if (readFeatures !== undefined) {
    for (const { code, refPos, data } of readFeatures) {
      const sublen = refPos - lastPos
      seqLen += sublen
      lastPos = refPos

      // Flush pending insertions if we have a match region
      if (insLen && sublen) {
        cigarParts.push(String(insLen), 'I')
        insLen = 0
      }
      // Flush previous non-match operation
      if (oplen && op !== 'M') {
        cigarParts.push(String(oplen), op)
        oplen = 0
      }
      // Accumulate match length
      if (sublen) {
        op = 'M'
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
          cigarParts.push(String(oplen), op)
          oplen = 0
        }
        cigarParts.push(String(data), code)
      } else if (codeChar === CODE_I || codeChar === CODE_S) {
        // Insertion or soft-clip
        const dataLen = data.length
        seqLen += dataLen
        if (oplen) {
          cigarParts.push(String(oplen), op)
          oplen = 0
        }
        cigarParts.push(String(dataLen), code)
      } else if (codeChar === CODE_i) {
        // Single base insertion
        if (oplen) {
          cigarParts.push(String(oplen), op)
          oplen = 0
        }
        insLen++
        seqLen++
      } else if (codeChar === CODE_P || codeChar === CODE_H) {
        // Padding or Hard clip
        if (oplen) {
          cigarParts.push(String(oplen), op)
          oplen = 0
        }
        cigarParts.push(String(data), code)
      } // else q or Q (no-op)
    }
  }

  // Handle remaining sequence length
  const remaining = readLen - seqLen
  if (remaining) {
    if (oplen && op !== 'M') {
      cigarParts.push(String(oplen), op)
      oplen = 0
    }
    op = 'M'
    oplen += remaining
  }

  // Flush pending insertions
  if (remaining && insLen) {
    cigarParts.push(String(insLen), 'I')
  }
  // Flush final operation
  if (oplen) {
    cigarParts.push(String(oplen), op)
  }

  return cigarParts.join('')
}
