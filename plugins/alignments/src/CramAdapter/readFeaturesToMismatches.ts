import { CODE_D, CODE_H, CODE_I, CODE_N, CODE_S, CODE_X, CODE_i } from './const'
import {
  TYPE_DELETION,
  TYPE_HARDCLIP,
  TYPE_INSERTION,
  TYPE_MISMATCH,
  TYPE_SKIP,
  TYPE_SOFTCLIP,
  createMismatchesSOA,
  pushMismatch,
  trimMismatchesSOA,
} from '../BamAdapter/MismatchesSOA'

import type { MismatchesSOA } from '../BamAdapter/MismatchesSOA'
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
      soa = pushMismatch(
        soa,
        insertedBasesRefPos,
        0,
        TYPE_INSERTION,
        insertedBasesLen,
        0,
        0,
        insertedBasesLen,
        insertedBases,
      )
      insertedBases = ''
      insertedBasesLen = 0
    }
    refPos = p - 1 - start

    const codeChar = code.charCodeAt(0)

    if (codeChar === CODE_X) {
      // substitution
      const baseCharCode = sub ? sub.charCodeAt(0) : 88 // 'X'
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
        0,
      )
    } else if (codeChar === CODE_I) {
      // insertion
      const dataLen = data.length
      soa = pushMismatch(
        soa,
        refPos,
        0,
        TYPE_INSERTION,
        dataLen,
        0,
        0,
        dataLen,
        data,
      )
    } else if (codeChar === CODE_N) {
      // reference skip
      // 'N' = 78
      soa = pushMismatch(soa, refPos, data, TYPE_SKIP, 78, 0, 0, 0)
    } else if (codeChar === CODE_S) {
      // soft clip
      const dataLen = data.length
      // 'S' = 83
      soa = pushMismatch(soa, refPos, 1, TYPE_SOFTCLIP, 83, 0, 0, dataLen)
    } else if (codeChar === CODE_H) {
      // hard clip
      // 'H' = 72
      soa = pushMismatch(soa, refPos, 1, TYPE_HARDCLIP, 72, 0, 0, data)
    } else if (codeChar === CODE_D) {
      // deletion
      // '*' = 42
      soa = pushMismatch(soa, refPos, data, TYPE_DELETION, 42, 0, 0, 0)
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

  if (sublen && insertedBasesLen > 0) {
    soa = pushMismatch(
      soa,
      insertedBasesRefPos,
      0,
      TYPE_INSERTION,
      insertedBasesLen,
      0,
      0,
      insertedBasesLen,
      insertedBases,
    )
  }

  return trimMismatchesSOA(soa)
}
