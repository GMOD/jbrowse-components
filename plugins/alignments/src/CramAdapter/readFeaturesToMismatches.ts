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
  let refPos = 0
  let sublen = 0
  let lastPos = start
  let insertedBases = ''

  for (const ret of readFeatures) {
    const { refPos: p, code, pos, data, sub, ref } = ret
    sublen = refPos - lastPos
    lastPos = refPos

    if (sublen && insertedBases.length > 0) {
      mismatches[j++] = {
        start: refPos,
        type: 'insertion',
        base: `${insertedBases.length}`,
        insertedBases,
        length: 0,
      }
      insertedBases = ''
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
      console.log('HERE', ret)
      // insertion
      mismatches[j++] = {
        start: refPos,
        type: 'insertion',
        base: `${data.length}`,
        insertedBases: data,
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
      insertedBases += data
    } else if (code === 'Q') {
      // single quality value
    }
  }

  if (sublen && insertedBases.length > 0) {
    mismatches[j++] = {
      start: refPos,
      type: 'insertion',
      base: `${insertedBases.length}`,
      insertedBases,
      length: 0,
    }
    insertedBases = ''
  }

  return mismatches.slice(0, j)
}
