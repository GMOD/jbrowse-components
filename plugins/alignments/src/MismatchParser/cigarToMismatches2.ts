import {
  MISMATCH_TYPE_DELETION,
  MISMATCH_TYPE_HARDCLIP,
  MISMATCH_TYPE_INSERTION,
  MISMATCH_TYPE_MISMATCH,
  MISMATCH_TYPE_SKIP,
  MISMATCH_TYPE_SOFTCLIP,
} from '../shared/types'

import type { Mismatch } from '../shared/types'

// CIGAR operation indices (from BAM spec)
const CIGAR_M = 0
const CIGAR_I = 1
const CIGAR_D = 2
const CIGAR_N = 3
const CIGAR_S = 4
const CIGAR_H = 5
// const CIGAR_P = 6
const CIGAR_EQ = 7
const CIGAR_X = 8

// Handles packed NUMERIC_CIGAR format from @gmod/bam
// Format: Uint32Array where each value is (length << 4) | opIndex
// opIndex is 0-8: M=0, I=1, D=2, N=3, S=4, H=5, P=6, ==7, X=8
export function cigarToMismatches2(
  ops: Uint32Array,
  seq?: string,
  ref?: string,
  qual?: Uint8Array,
) {
  let roffset = 0
  let soffset = 0
  const mismatches: Mismatch[] = []
  const hasRefAndSeq = ref && seq

  for (let i = 0, l = ops.length; i < l; i++) {
    const packed = ops[i]!
    const len = packed >> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      if (hasRefAndSeq) {
        for (let j = 0; j < len; j++) {
          if (
            (seq.charCodeAt(soffset + j) | 0x20) !==
            (ref.charCodeAt(roffset + j) | 0x20)
          ) {
            mismatches.push({
              start: roffset + j,
              type: MISMATCH_TYPE_MISMATCH,
              base: seq[soffset + j]!,
              altbase: ref[roffset + j]!,
              length: 1,
            })
          }
        }
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_I) {
      mismatches.push({
        start: roffset,
        type: MISMATCH_TYPE_INSERTION,
        base: `${len}`,
        insertedBases: seq?.slice(soffset, soffset + len),
        length: 0,
      })
      soffset += len
    } else if (op === CIGAR_D) {
      mismatches.push({
        start: roffset,
        type: MISMATCH_TYPE_DELETION,
        base: '*',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_N) {
      mismatches.push({
        start: roffset,
        type: MISMATCH_TYPE_SKIP,
        base: 'N',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_X) {
      for (let j = 0; j < len; j++) {
        mismatches.push({
          start: roffset + j,
          type: MISMATCH_TYPE_MISMATCH,
          base: seq?.[soffset + j] || 'X',
          qual: qual?.[soffset + j],
          length: 1,
        })
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_H) {
      mismatches.push({
        start: roffset,
        type: MISMATCH_TYPE_HARDCLIP,
        base: `H${len}`,
        cliplen: len,
        length: 1,
      })
    } else if (op === CIGAR_S) {
      mismatches.push({
        start: roffset,
        type: MISMATCH_TYPE_SOFTCLIP,
        base: `S${len}`,
        cliplen: len,
        length: 1,
      })
      soffset += len
    }
  }

  return mismatches
}
