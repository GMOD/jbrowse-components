import {
  CIGAR_D,
  CIGAR_E,
  CIGAR_EQ,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from './index'

import type { Mismatch } from '../shared/types'

// Optimized version that works with parseCigar2 output (all numeric)
// ops array format: [length1, opCode1, length2, opCode2, ...]
// where opCode is char code (M=77, I=73, etc)
export function cigarToMismatches2(
  ops: number[],
  seq?: string,
  ref?: string,
  qual?: Uint8Array,
) {
  let roffset = 0
  let soffset = 0
  const mismatches: Mismatch[] = []
  const hasRefAndSeq = ref && seq

  for (let i = 0; i < ops.length; i += 2) {
    const len = ops[i]!
    const op = ops[i + 1]!

    if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_E) {
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
        base: `${len}`,
        insertedBases: seq?.slice(soffset, soffset + len),
        length: 0,
      })
      soffset += len
    } else if (op === CIGAR_D) {
      mismatches.push({
        start: roffset,
        type: 'deletion',
        base: '*',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_N) {
      mismatches.push({
        start: roffset,
        type: 'skip',
        base: 'N',
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
        base: `H${len}`,
        cliplen: len,
        length: 1,
      })
    } else if (op === CIGAR_S) {
      mismatches.push({
        start: roffset,
        type: 'softclip',
        base: `S${len}`,
        cliplen: len,
        length: 1,
      })
      soffset += len
    }
  }

  return mismatches
}
