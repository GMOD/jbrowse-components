/* eslint-disable prefer-template */
import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

export function readFeaturesToCIGAR(
  readFeatures: ReadFeatures,
  alignmentStart: number,
  readLen: number,
  refRegion?: { seq: string; start: number },
) {
  if (!refRegion) {
    return ''
  }

  // Build CIGAR string using array then join - avoids O(n²) string concatenation
  const cigarParts: string[] = []

  let op = 'M'
  let oplen = 0
  let lastPos = alignmentStart
  let sublen = 0
  let insLen = 0
  let seqLength = 0

  if (readFeatures !== undefined) {
    const featuresLength = readFeatures.length
    for (let i = 0; i < featuresLength; i++) {
      const feature = readFeatures[i]!
      const { code, refPos, data } = feature
      sublen = refPos - lastPos

      // Track sequence length without building the actual sequence (unused)
      if (sublen > 0) {
        seqLength += sublen
      }
      lastPos = refPos

      if (insLen > 0 && sublen) {
        cigarParts.push(insLen + 'I')
        insLen = 0
      }
      if (oplen && op !== 'M') {
        cigarParts.push(oplen + op)
        oplen = 0
      }
      if (sublen) {
        op = 'M'
        oplen += sublen
      }

      if (code === 'b') {
        // An array of bases stored verbatim
        const addedLen = data.split(',').length
        seqLength += addedLen
        lastPos += addedLen
        oplen += addedLen
      } else if (code === 'B' || code === 'X') {
        // Single base (+ qual score) or Substitution
        seqLength++
        lastPos++
        oplen++
      } else if (code === 'D' || code === 'N') {
        // Deletion or Ref Skip
        lastPos += data
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data + code)
        oplen = 0
      } else if (code === 'I' || code === 'S') {
        // Insertion or soft-clip
        seqLength += data.length
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data.length + code)
        oplen = 0
      } else if (code === 'i') {
        // Single base insertion
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        insLen++
        seqLength++
        oplen = 0
      } else if (code === 'P') {
        // Padding
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data + 'P')
      } else if (code === 'H') {
        // Hard clip
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data + 'H')
        oplen = 0
      } // else q or Q
    }
  } else {
    sublen = readLen - seqLength
  }

  if (seqLength !== readLen) {
    sublen = readLen - seqLength

    if (oplen && op !== 'M') {
      cigarParts.push(oplen + op)
      oplen = 0
    }
    op = 'M'
    oplen += sublen
  }
  if (sublen && insLen > 0) {
    cigarParts.push(insLen + 'I')
  }
  if (oplen) {
    cigarParts.push(oplen + op)
  }

  return cigarParts.join('')
}
