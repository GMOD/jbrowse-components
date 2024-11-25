import type { Mismatch } from '../shared/types'
import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

export function readFeaturesToMismatches(
  readFeatures: ReadFeatures,
  start: number,
  qual?: number[] | null,
) {
  if (!readFeatures) {
    return []
  }
  const mismatches: Mismatch[] = new Array(readFeatures.length)
  let j = 0
  let insLen = 0
  let refPos = 0
  let sublen = 0
  let lastPos = start

  for (const { refPos: p, code, pos, data, sub, ref } of readFeatures) {
    sublen = refPos - lastPos
    lastPos = refPos

    if (sublen && insLen > 0) {
      mismatches[j++] = {
        start: refPos,
        type: 'insertion',
        base: `${insLen}`,
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
  let seq = ''
  let cigar = ''
  let op = 'M'
  let oplen = 0
  if (!refRegion) {
    return ''
  }

  // not sure I should access these, but...
  const ref = refRegion.seq
  const refStart = refRegion.start
  let lastPos = alignmentStart
  let sublen = 0
  let insLen = 0
  if (readFeatures !== undefined) {
    for (const { code, refPos, sub, data } of readFeatures) {
      sublen = refPos - lastPos
      seq += ref.slice(lastPos - refStart, refPos - refStart)
      lastPos = refPos

      if (insLen > 0 && sublen) {
        cigar += `${insLen}I`
        insLen = 0
      }
      if (oplen && op !== 'M') {
        cigar += `${oplen}${op}`
        oplen = 0
      }
      if (sublen) {
        op = 'M'
        oplen += sublen
      }

      if (code === 'b') {
        // An array of bases stored verbatim
        const ret = data.split(',')
        const added = String.fromCharCode(...ret)
        seq += added
        lastPos += added.length
        oplen += added.length
      } else if (code === 'B') {
        // Single base (+ qual score)
        seq += sub
        lastPos++
        oplen++
      } else if (code === 'X') {
        // Substitution
        seq += sub
        lastPos++
        oplen++
      } else if (code === 'D' || code === 'N') {
        // Deletion or Ref Skip
        lastPos += data
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += data + code
        oplen = 0
      } else if (code === 'I' || code === 'S') {
        // Insertion or soft-clip
        seq += data
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += data.length + code
        oplen = 0
      } else if (code === 'i') {
        // Single base insertion
        // seq += data
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        insLen++
        seq += data
        oplen = 0
      } else if (code === 'P') {
        // Padding
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += `${data}P`
      } else if (code === 'H') {
        // Hard clip
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += `${data}H`
        oplen = 0
      } // else q or Q
    }
  } else {
    sublen = readLen - seq.length
  }
  if (seq.length !== readLen) {
    sublen = readLen - seq.length
    seq += ref.slice(lastPos - refStart, lastPos - refStart + sublen)

    if (oplen && op !== 'M') {
      cigar += `${oplen}${op}`
      oplen = 0
    }
    op = 'M'
    oplen += sublen
  }
  if (sublen && insLen > 0) {
    cigar += `${insLen}I`
  }
  if (oplen) {
    cigar += `${oplen}${op}`
  }

  return cigar
}
