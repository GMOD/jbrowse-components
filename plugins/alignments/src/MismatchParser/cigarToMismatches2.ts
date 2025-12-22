import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '../PileupRenderer/renderers/cigarUtil'

import type { Mismatch } from '../shared/types'

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
              type: 'mismatch',
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
        type: 'insertion',
        insertlen: len,
        insertedBases: seq?.slice(soffset, soffset + len),
        length: 0,
      })
      soffset += len
    } else if (op === CIGAR_D) {
      mismatches.push({
        start: roffset,
        type: 'deletion',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_N) {
      mismatches.push({
        start: roffset,
        type: 'skip',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_X) {
      for (let j = 0; j < len; j++) {
        mismatches.push({
          start: roffset + j,
          type: 'mismatch',
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
        type: 'hardclip',
        cliplen: len,
        length: 1,
      })
    } else if (op === CIGAR_S) {
      mismatches.push({
        start: roffset,
        type: 'softclip',
        cliplen: len,
        length: 1,
      })
      soffset += len
    }
  }

  return mismatches
}
