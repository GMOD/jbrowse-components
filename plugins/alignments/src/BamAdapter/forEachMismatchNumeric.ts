import {
  CIGAR_D,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M_EQ_MASK,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  SEQRET,
  SEQRET_NUMERIC_DECODER,
} from '../PileupRenderer/renderers/cigarUtil'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '../shared/forEachMismatchTypes'

import type { MismatchCallback } from '../shared/forEachMismatchTypes'

/**
 * Core mismatch iteration logic for BAM records.
 * Extracted as standalone function for testability.
 *
 * @param cigar - Packed CIGAR operations (Uint32Array)
 * @param numericSeq - Packed sequence (Uint8Array, 4-bit per base)
 * @param seqLength - Length of sequence
 * @param md - MD tag as byte array (or undefined)
 * @param qual - Quality scores (or undefined)
 * @param ref - Reference sequence for comparison when no MD tag
 * @param callback - Called for each mismatch/indel/clip
 * @param featStart - Feature's absolute start position (for region filtering)
 * @param regionStart - Region start for filtering (optional)
 * @param regionEnd - Region end for filtering (optional)
 */
export function forEachMismatchNumeric(
  cigar: ArrayLike<number>,
  numericSeq: ArrayLike<number>,
  seqLength: number,
  md: ArrayLike<number> | undefined,
  qual: ArrayLike<number> | null | undefined,
  ref: string | undefined,
  callback: MismatchCallback,
  featStart?: number,
  regionStart?: number,
  regionEnd?: number,
) {
  const hasRegionFilter =
    regionStart !== undefined &&
    regionEnd !== undefined &&
    featStart !== undefined

  const inRegion = (relStart: number, length: number, isInterbase: boolean) => {
    if (!hasRegionFilter) {
      return true
    }
    const absStart = featStart + relStart
    if (isInterbase) {
      return absStart >= regionStart && absStart < regionEnd
    }
    const absEnd = absStart + length
    return absEnd > regionStart && absStart < regionEnd
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
    const len = packed >> 4
    const op = packed & 0xf

    if ((1 << op) & CIGAR_M_EQ_MASK) {
      if (hasMD) {
        let remaining = Math.min(len, seqLength - soffset)
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
              const seqIdx = soffset + localOffset
              const sb = numericSeq[seqIdx >> 1]!
              const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf

              if (inRegion(roffset + localOffset, 1, false)) {
                callback(
                  MISMATCH_TYPE,
                  roffset + localOffset,
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
        // No MD tag - compare against reference sequence
        const safeEnd = soffset + len <= seqLength ? len : seqLength - soffset
        for (let j = 0; j < safeEnd; j++) {
          const seqIdx = soffset + j
          const sb = numericSeq[seqIdx >> 1]!
          const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
          const seqBaseCode = SEQRET_NUMERIC_DECODER[nibble]!
          const refCharCode = ref.charCodeAt(roffset + j)
          // Compare case-insensitively (| 0x20 converts uppercase to lowercase)
          if (
            seqBaseCode !== (refCharCode | 0x20) &&
            inRegion(roffset + j, 1, false)
          ) {
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
      if (inRegion(roffset, 0, true)) {
        let insertedBases = ''
        for (let j = 0; j < len && soffset + j < seqLength; j++) {
          const seqIdx = soffset + j
          const sb = numericSeq[seqIdx >> 1]!
          const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
          insertedBases += SEQRET[nibble]!
        }
        callback(INSERTION_TYPE, roffset, 0, insertedBases, -1, 0, len)
      }
      soffset += len
    } else if (op === CIGAR_D) {
      if (inRegion(roffset, len, false)) {
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
      if (inRegion(roffset, len, false)) {
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
        }

        if (inRegion(roffset + j, 1, false)) {
          callback(
            MISMATCH_TYPE,
            roffset + j,
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
      if (inRegion(roffset, 0, true)) {
        callback(SOFTCLIP_TYPE, roffset, 1, `S${len}`, -1, 0, len)
      }
      soffset += len
    } else if (op === CIGAR_H) {
      if (inRegion(roffset, 0, true)) {
        callback(HARDCLIP_TYPE, roffset, 1, `H${len}`, -1, 0, len)
      }
    }
  }
}
