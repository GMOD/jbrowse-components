import { CODE_D, CODE_H, CODE_I, CODE_N, CODE_S, CODE_X, CODE_i } from './const'
import {
  MISMATCH_TYPE_DELETION,
  MISMATCH_TYPE_HARDCLIP,
  MISMATCH_TYPE_INSERTION,
  MISMATCH_TYPE_MISMATCH,
  MISMATCH_TYPE_SKIP,
  MISMATCH_TYPE_SOFTCLIP,
} from '../shared/types'

import type { Mismatch } from '../shared/types'
import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

export function readFeaturesToMismatches(
  readFeatures: ReadFeatures = [],
  start: number,
  qual?: number[] | null,
) {
  const len = readFeatures.length
  const mismatches: Mismatch[] = new Array(len)
  let j = 0
  let refPos = 0
  let sublen = 0
  let lastPos = start
  let insertedBases = ''
  let insertedBasesLen = 0

  for (let i = 0; i < len; i++) {
    const { refPos: p, code, pos, data, sub, ref } = readFeatures[i]!
    sublen = refPos - lastPos
    lastPos = refPos

    if (sublen && insertedBasesLen > 0) {
      mismatches[j++] = {
        start: refPos,
        type: MISMATCH_TYPE_INSERTION,
        base: String(insertedBasesLen),
        insertedBases,
        length: 0,
      }
      insertedBases = ''
      insertedBasesLen = 0
    }
    refPos = p - 1 - start

    const codeChar = code.charCodeAt(0)

    if (codeChar === CODE_X) {
      // substitution
      mismatches[j++] = {
        start: refPos,
        length: 1,
        base: sub!,
        qual: qual?.[pos - 1],
        altbase: ref?.toUpperCase(),
        type: MISMATCH_TYPE_MISMATCH,
      }
    } else if (codeChar === CODE_I) {
      // insertion
      mismatches[j++] = {
        start: refPos,
        type: MISMATCH_TYPE_INSERTION,
        base: String(data.length),
        insertedBases: data,
        length: 0,
      }
    } else if (codeChar === CODE_N) {
      // reference skip
      mismatches[j++] = {
        type: MISMATCH_TYPE_SKIP,
        length: data,
        start: refPos,
        base: 'N',
      }
    } else if (codeChar === CODE_S) {
      // soft clip
      const dataLen = data.length
      mismatches[j++] = {
        start: refPos,
        type: MISMATCH_TYPE_SOFTCLIP,
        base: `S${dataLen}`,
        cliplen: dataLen,
        length: 1,
      }
    } else if (codeChar === CODE_H) {
      // hard clip
      mismatches[j++] = {
        start: refPos,
        type: MISMATCH_TYPE_HARDCLIP,
        base: `H${data}`,
        cliplen: data,
        length: 1,
      }
    } else if (codeChar === CODE_D) {
      // deletion
      mismatches[j++] = {
        type: MISMATCH_TYPE_DELETION,
        length: data,
        start: refPos,
        base: '*',
      }
    } else if (codeChar === CODE_i) {
      // single-base insertion, we collect these if there are multiple in a row
      // into a single insertion entry
      insertedBases += data
      insertedBasesLen++
    }
    // Skip CODE_P, CODE_b, CODE_q, CODE_B, CODE_Q (no-ops)
  }

  if (sublen && insertedBasesLen > 0) {
    mismatches[j++] = {
      start: refPos,
      type: MISMATCH_TYPE_INSERTION,
      base: String(insertedBasesLen),
      insertedBases,
      length: 0,
    }
  }

  return j !== len ? mismatches.slice(0, j) : mismatches
}
