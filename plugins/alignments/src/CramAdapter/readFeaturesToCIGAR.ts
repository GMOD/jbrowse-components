import type { Mismatch } from '../shared/types'
import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

export function readFeaturesToMismatches(
  readFeatures: ReadFeatures = [],
  start: number,
  qual?: number[] | null,
) {
  const mismatches: Mismatch[] = new Array(readFeatures.length)
  let j = 0
  let insLen = 0
  let refPos = 0
  let sublen = 0
  let lastPos = start

  for (const ret of readFeatures) {
    const { refPos: p, code, pos, data, sub, ref } = ret
    sublen = refPos - lastPos
    lastPos = refPos

    if (sublen && insLen > 0) {
      mismatches[j++] = {
        start: refPos,
        type: 'insertion',
        base: `${insLen}`,
        insertedBases: data,
        length: 0,
      }
      insLen = 0
    }
    refPos = p - 1 - start

    if (code === 'X') {
      // substitution
      mismatches[j++] = {
        start: refPos,
        length: 1,
        base: sub!,
        qual: qual?.[pos - 1],
        altbase: ref?.toUpperCase(),
        type: 'mismatch',
      }
    } else if (code === 'I') {
      // insertion
      mismatches[j++] = {
        start: refPos,
        type: 'insertion',
        base: `${data.length}`,
        length: 0,
      }
    } else if (code === 'N') {
      // reference skip
      mismatches[j++] = {
        type: 'skip',
        length: data,
        start: refPos,
        base: 'N',
      }
    } else if (code === 'S') {
      // soft clip
      const len = data.length
      mismatches[j++] = {
        start: refPos,
        type: 'softclip',
        base: `S${len}`,
        cliplen: len,
        length: 1,
      }
    } else if (code === 'P') {
      // padding
    } else if (code === 'H') {
      // hard clip
      const len = data
      mismatches[j++] = {
        start: refPos,
        type: 'hardclip',
        base: `H${len}`,
        cliplen: len,
        length: 1,
      }
    } else if (code === 'D') {
      // deletion
      mismatches[j++] = {
        type: 'deletion',
        length: data,
        start: refPos,
        base: '*',
      }
    } else if (code === 'b') {
      // stretch of bases
    } else if (code === 'q') {
      // stretch of qual scores
    } else if (code === 'B') {
      // a pair of [base, qual]
    } else if (code === 'i') {
      // single-base insertion, we collect these if there are multiple in a row
      // into a single insertion entry
      insLen++
    } else if (code === 'Q') {
      // single quality value
    }
  }

  if (sublen && insLen > 0) {
    mismatches[j++] = {
      start: refPos,
      type: 'insertion',
      base: `${insLen}`,
      length: 0,
    }
    insLen = 0
  }

  return mismatches.slice(0, j)
}

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
  const refStart = refRegion.start
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
