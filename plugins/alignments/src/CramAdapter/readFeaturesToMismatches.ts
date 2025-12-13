import { CODE_D, CODE_H, CODE_I, CODE_N, CODE_S, CODE_X, CODE_i } from './const'
import {
  CHAR_H,
  CHAR_N,
  CHAR_PLUS,
  CHAR_S,
  CHAR_STAR,
  CHAR_X,
  TYPE_DELETION,
  TYPE_HARDCLIP,
  TYPE_INSERTION,
  TYPE_MISMATCH,
  TYPE_SKIP,
  TYPE_SOFTCLIP,
  createMismatchesSOA,
  pushMismatch,
  trimMismatchesSOA,
} from '../shared/MismatchesSOA'

import type { MismatchesSOA } from '../shared/MismatchesSOA'
import type { CramRecord } from '@gmod/cram'

type ReadFeatures = CramRecord['readFeatures']

export function readFeaturesToMismatches(
  readFeatures: ReadFeatures = [],
  start: number,
  qual?: number[] | null,
): MismatchesSOA {
  const len = readFeatures.length
  let soa = createMismatchesSOA(Math.max(len, 4))
  let refPos = 0
  let sublen = 0
  let lastPos = start
  let insertedBases = ''
  let insertedBasesLen = 0
  let insertedBasesRefPos = 0

  for (let i = 0; i < len; i++) {
    const { refPos: p, code, pos, data, sub, ref } = readFeatures[i]!
    sublen = refPos - lastPos
    lastPos = refPos

    if (sublen && insertedBasesLen > 0) {
      // insertion: length=insertion length
      soa = pushMismatch(
        soa,
        insertedBasesRefPos,
        insertedBasesLen,
        TYPE_INSERTION,
        CHAR_PLUS,
        0,
        0,
        insertedBases,
      )
      insertedBases = ''
      insertedBasesLen = 0
    }
    refPos = p - 1 - start

    const codeChar = code.charCodeAt(0)

    if (codeChar === CODE_X) {
      // substitution: length=1
      const baseCharCode = sub ? sub.charCodeAt(0) : CHAR_X
      const altbaseCharCode = ref ? ref.toUpperCase().charCodeAt(0) : 0
      const qualVal = qual?.[pos - 1] ?? 0
      soa = pushMismatch(
        soa,
        refPos,
        1,
        TYPE_MISMATCH,
        baseCharCode,
        qualVal,
        altbaseCharCode,
      )
    } else if (codeChar === CODE_I) {
      // insertion: length=insertion length
      const dataLen = data.length
      soa = pushMismatch(
        soa,
        refPos,
        dataLen,
        TYPE_INSERTION,
        CHAR_PLUS,
        0,
        0,
        data,
      )
    } else if (codeChar === CODE_N) {
      // reference skip: length=skip length
      soa = pushMismatch(soa, refPos, data, TYPE_SKIP, CHAR_N, 0, 0)
    } else if (codeChar === CODE_S) {
      // soft clip: length=clip length
      const dataLen = data.length
      soa = pushMismatch(soa, refPos, dataLen, TYPE_SOFTCLIP, CHAR_S, 0, 0)
    } else if (codeChar === CODE_H) {
      // hard clip: length=clip length
      soa = pushMismatch(soa, refPos, data, TYPE_HARDCLIP, CHAR_H, 0, 0)
    } else if (codeChar === CODE_D) {
      // deletion: length=deletion length
      soa = pushMismatch(soa, refPos, data, TYPE_DELETION, CHAR_STAR, 0, 0)
    } else if (codeChar === CODE_i) {
      // single-base insertion, we collect these if there are multiple in a row
      // into a single insertion entry
      if (insertedBasesLen === 0) {
        insertedBasesRefPos = refPos
      }
      insertedBases += data
      insertedBasesLen++
    }
    // Skip CODE_P, CODE_b, CODE_q, CODE_B, CODE_Q (no-ops)
  }

  if (insertedBasesLen > 0) {
    // insertion: length=insertion length
    soa = pushMismatch(
      soa,
      insertedBasesRefPos,
      insertedBasesLen,
      TYPE_INSERTION,
      CHAR_PLUS,
      0,
      0,
      insertedBases,
    )
  }

  return trimMismatchesSOA(soa)
}
