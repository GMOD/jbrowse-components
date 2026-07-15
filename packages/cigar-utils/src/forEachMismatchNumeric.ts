import { SEQRET, SEQRET_NUMERIC_DECODER } from './bamSeqDecoder.ts'
import {
  CIGAR_D,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M_EQ_MASK,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from './cigarConstants.ts'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from './mismatchCallback.ts'

import type { MismatchCallback } from './mismatchCallback.ts'

/**
 * Core mismatch iteration logic for BAM records.
 * Extracted as standalone function for testability.
 *
 * @param cigar - Packed CIGAR operations (Uint32Array)
 * @param numericSeq - Packed sequence (Uint8Array, 4-bit per base)
 * @param seqLength - Length of sequence
 * @param md - MD tag as byte array (or undefined)
 * @param qual - Quality scores (or undefined)
 * @param ref - Reference sequence for comparison when no MD tag. May be a
 *   shared region-wide string covering many reads; `refOffset` locates this
 *   read's start within it (avoids slicing a substring per read).
 * @param callback - Called for each mismatch/indel/clip
 * @param refOffset - Index in `ref` of this read's first reference base
 * @param windowLo - Read-relative reference offset (roffset space) of the
 *   viewport's left edge. Ops/bases fully left of it are skipped so a
 *   whole-chromosome contig alignment only walks the visible slice of its CIGAR
 *   (and only needs `ref` covering that slice). Defaults to the whole read.
 * @param windowHi - Read-relative reference offset of the viewport's right edge.
 */
export function forEachMismatchNumeric(
  cigar: ArrayLike<number>,
  numericSeq: ArrayLike<number>,
  seqLength: number,
  md: ArrayLike<number> | undefined,
  qual: ArrayLike<number> | null | undefined,
  ref: string | undefined,
  callback: MismatchCallback,
  refOffset = 0,
  windowLo = Number.NEGATIVE_INFINITY,
  windowHi = Number.POSITIVE_INFINITY,
) {
  // Fast path for reads with no sequence (e.g. secondary alignments with SEQ='*')
  if (seqLength === 0) {
    let roffset = 0
    for (let i = 0, l = cigar.length; i < l; i++) {
      const packed = cigar[i]!
      const len = packed >>> 4
      const op = packed & 0xf
      if ((1 << op) & CIGAR_M_EQ_MASK) {
        roffset += len
      } else if (op === CIGAR_I) {
        if (roffset >= windowLo && roffset < windowHi) {
          callback(INSERTION_TYPE, roffset, 0, '*', -1, 0, len)
        }
      } else if (op === CIGAR_D) {
        if (roffset < windowHi && roffset + len > windowLo) {
          callback(DELETION_TYPE, roffset, len, '*', -1, 0, 0)
        }
        roffset += len
      } else if (op === CIGAR_N) {
        if (roffset < windowHi && roffset + len > windowLo) {
          callback(SKIP_TYPE, roffset, len, 'N', -1, 0, 0)
        }
        roffset += len
      } else if (op === CIGAR_S) {
        if (roffset >= windowLo && roffset < windowHi) {
          callback(SOFTCLIP_TYPE, roffset, 1, `S${len}`, -1, 0, len)
        }
      } else if (op === CIGAR_H) {
        if (roffset >= windowLo && roffset < windowHi) {
          callback(HARDCLIP_TYPE, roffset, 1, `H${len}`, -1, 0, len)
        }
      }
    }
    return
  }

  const mdLength = md?.length ?? 0
  const hasQual = !!qual
  const hasMD = md && mdLength > 0

  let roffset = 0
  let soffset = 0
  let mdIdx = 0
  let mdMatchRemaining = 0

  if (hasMD) {
    while (mdIdx < mdLength) {
      const c = md[mdIdx]!
      if (c >= 48 && c <= 57) {
        mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
        mdIdx++
      } else {
        break
      }
    }
  }

  for (let i = 0, l = cigar.length; i < l; i++) {
    const packed = cigar[i]!
    const len = packed >>> 4
    const op = packed & 0xf

    if ((1 << op) & CIGAR_M_EQ_MASK) {
      if (hasMD) {
        let remaining = len
        let localOffset = 0

        while (remaining > 0) {
          if (mdMatchRemaining >= remaining) {
            mdMatchRemaining -= remaining
            localOffset += remaining
            remaining = 0
          } else {
            localOffset += mdMatchRemaining
            remaining -= mdMatchRemaining
            mdMatchRemaining = 0

            if (mdIdx < mdLength && md[mdIdx]! >= 65 && md[mdIdx]! <= 90) {
              const pos = roffset + localOffset
              if (pos >= windowLo && pos < windowHi) {
                const seqIdx = soffset + localOffset
                const sb = numericSeq[seqIdx >> 1]!
                const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf

                callback(
                  MISMATCH_TYPE,
                  pos,
                  1,
                  SEQRET[nibble]!,
                  hasQual ? qual[seqIdx]! : -1,
                  md[mdIdx],
                  0,
                )
              }

              mdIdx++
              localOffset++
              remaining--
              mdMatchRemaining = 0
              while (mdIdx < mdLength) {
                const c = md[mdIdx]!
                if (c >= 48 && c <= 57) {
                  mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
                  mdIdx++
                } else {
                  break
                }
              }
            } else {
              break
            }
          }
        }
      } else if (ref) {
        // Only compare bases whose reference position falls in the viewport
        // window. A whole-chromosome contig has M ops totalling ~250M bases;
        // without this clip every one is compared (and `ref` would have to
        // cover the whole chromosome). windowLo/Hi are in roffset space.
        const jLo = windowLo > roffset ? windowLo - roffset : 0
        const jHi = windowHi < roffset + len ? windowHi - roffset : len
        for (let j = jLo; j < jHi; j++) {
          const seqIdx = soffset + j
          const sb = numericSeq[seqIdx >> 1]!
          const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
          const seqBaseCode = SEQRET_NUMERIC_DECODER[nibble]!
          const refCharCode = ref.charCodeAt(refOffset + roffset + j)
          // Compare case-insensitively (| 0x20 converts uppercase to lowercase)
          if (seqBaseCode !== (refCharCode | 0x20)) {
            callback(
              MISMATCH_TYPE,
              roffset + j,
              1,
              SEQRET[nibble]!,
              hasQual ? qual[seqIdx]! : -1,
              refCharCode,
              0,
            )
          }
        }
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_I) {
      // Optimized insertion base extraction - avoid string concat for common cases
      let insertedBases: string
      if (len === 1) {
        // Single base insertion - most common case
        const sb = numericSeq[soffset >> 1]!
        const nibble = (sb >> ((1 - (soffset & 1)) << 2)) & 0xf
        insertedBases = SEQRET[nibble]!
      } else if (len === 2) {
        // Two base insertion - second most common
        const seqIdx0 = soffset
        const sb0 = numericSeq[seqIdx0 >> 1]!
        const nibble0 = (sb0 >> ((1 - (seqIdx0 & 1)) << 2)) & 0xf
        const seqIdx1 = soffset + 1
        const sb1 = numericSeq[seqIdx1 >> 1]!
        const nibble1 = (sb1 >> ((1 - (seqIdx1 & 1)) << 2)) & 0xf
        insertedBases = SEQRET[nibble0]! + SEQRET[nibble1]!
      } else {
        const bases = new Array<string>(len)
        for (let j = 0; j < len; j++) {
          const seqIdx = soffset + j
          const sb = numericSeq[seqIdx >> 1]!
          const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
          bases[j] = SEQRET[nibble]!
        }
        insertedBases = bases.join('')
      }
      if (roffset >= windowLo && roffset < windowHi) {
        callback(INSERTION_TYPE, roffset, 0, insertedBases, -1, 0, len)
      }
      soffset += len
    } else if (op === CIGAR_D) {
      if (roffset < windowHi && roffset + len > windowLo) {
        callback(DELETION_TYPE, roffset, len, '*', -1, 0, 0)
      }

      // eslint-disable-next-line @typescript-eslint/no-confusing-non-null-assertion
      if (hasMD && mdIdx < mdLength && md[mdIdx]! === 94) {
        mdIdx++
        while (mdIdx < mdLength && md[mdIdx]! >= 65) {
          mdIdx++
        }
        mdMatchRemaining = 0
        while (mdIdx < mdLength) {
          const c = md[mdIdx]!
          if (c >= 48 && c <= 57) {
            mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
            mdIdx++
          } else {
            break
          }
        }
      }
      roffset += len
    } else if (op === CIGAR_N) {
      if (roffset < windowHi && roffset + len > windowLo) {
        callback(SKIP_TYPE, roffset, len, 'N', -1, 0, 0)
      }
      roffset += len
    } else if (op === CIGAR_X) {
      for (let j = 0; j < len; j++) {
        const seqIdx = soffset + j
        const sb = numericSeq[seqIdx >> 1]!
        const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf

        let altbaseCode = 0
        if (hasMD) {
          if (mdMatchRemaining === 0 && mdIdx < mdLength && md[mdIdx]! >= 65) {
            altbaseCode = md[mdIdx]!
            mdIdx++
            mdMatchRemaining = 0
            while (mdIdx < mdLength) {
              const c = md[mdIdx]!
              if (c >= 48 && c <= 57) {
                mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
                mdIdx++
              } else {
                break
              }
            }
          } else if (mdMatchRemaining > 0) {
            mdMatchRemaining--
          }
        } else if (ref) {
          // No MD tag - get reference base from ref string
          altbaseCode = ref.charCodeAt(refOffset + roffset + j)
        }

        const pos = roffset + j
        if (pos >= windowLo && pos < windowHi) {
          callback(
            MISMATCH_TYPE,
            pos,
            1,
            SEQRET[nibble]!,
            hasQual ? qual[seqIdx]! : -1,
            altbaseCode,
            0,
          )
        }
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_S) {
      if (roffset >= windowLo && roffset < windowHi) {
        callback(SOFTCLIP_TYPE, roffset, 1, `S${len}`, -1, 0, len)
      }
      soffset += len
    } else if (op === CIGAR_H) {
      if (roffset >= windowLo && roffset < windowHi) {
        callback(HARDCLIP_TYPE, roffset, 1, `H${len}`, -1, 0, len)
      }
    }
  }
}
