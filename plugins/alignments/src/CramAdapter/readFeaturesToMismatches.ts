import {
  RF_DELETION,
  RF_HARD_CLIP,
  RF_INSERTION,
  RF_INSERT_BASE,
  RF_POSITIONAL,
  RF_REF_SKIP,
  RF_SOFT_CLIP,
  RF_SUBST,
} from '@gmod/cram'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '@jbrowse/cigar-utils'

import type { ReadFeatureArena } from '@gmod/cram'
import type { MismatchCallback } from '@jbrowse/cigar-utils'

// A clip has no bases to report — its length travels in `cliplen`, which is what
// every consumer reads. Matches forEachMismatchNumeric.
const NO_BASES = ''

// Pure readFeatures→mismatch walk backing CramSlightlyLazyFeature.forEachMismatch
// (extracted so it's unit-testable with plain fixtures, like
// readFeaturesToNumericCIGAR). refPos is read-relative; windowStart/windowEnd are
// passed already converted to that space, or ±Infinity for no clip.
//
// Reads cram-js's columnar read features rather than `record.readFeatures`,
// which rebuilds an array of ~64-byte objects on every access. Only the
// insertion branches touch a payload string, and only inside the window.
export function readFeaturesToMismatches(
  arena: ReadFeatureArena | undefined,
  featureStart: number,
  featureCount: number,
  featStart: number,
  qual: ArrayLike<number> | null | undefined,
  wLo: number,
  wHi: number,
  callback: MismatchCallback,
) {
  if (arena !== undefined) {
    const hasQual = !!qual
    const { codes, pos, refPos, num, refCodes, subCodes } = arena
    const end = featureStart + featureCount
    let insertedBases = ''
    let insertedBasesLen = 0
    let insertionPos = 0

    for (let i = featureStart; i < end; i++) {
      const code = codes[i]!
      // skips q/Q, whose refPos reports where a quality score sits in the
      // read rather than an alignment position — see RF_POSITIONAL in
      // @gmod/cram. Letting one through flushes the insertion accumulator
      // below and splits a 2-base insertion into two 1-base callbacks
      if (RF_POSITIONAL[code]) {
        const rPos = refPos[i]! - featStart

        // Consecutive single-base 'i' features at the same refPos accumulate into
        // one insertion. Flush it before processing any non-'i' feature (or an 'i'
        // that starts a new position). Flushing here (rather than after) emits the
        // insertion ahead of a same-position mismatch, matching the BAM/CRAM
        // readFeatures order.
        if (
          insertedBasesLen > 0 &&
          (code !== RF_INSERT_BASE || rPos !== insertionPos)
        ) {
          if (insertionPos >= wLo && insertionPos < wHi) {
            callback(
              INSERTION_TYPE,
              insertionPos,
              0,
              insertedBases,
              -1,
              0,
              insertedBasesLen,
            )
          }
          insertedBases = ''
          insertedBasesLen = 0
        }

        const inWindow = rPos < wHi && rPos + 1 > wLo
        // the data value for D/N/H, the payload length for I/i
        const n = num[i]!

        if (code === RF_SUBST) {
          if (inWindow) {
            // 0 where the reference base is unknown, and 0 & ~0x20 is still 0
            const refCharCode = refCodes[i]! & ~0x20
            const subCode = subCodes[i]!
            callback(
              MISMATCH_TYPE,
              rPos,
              1,
              subCode === 0 ? 'N' : String.fromCharCode(subCode),
              // arena pos is 0-based as of @gmod/cram v10, so it indexes qual
              // directly; the old `- 1` read one base early and returned
              // undefined for a substitution at the first base of a read
              hasQual ? qual[pos[i]!]! : -1,
              refCharCode,
              0,
            )
          }
        } else if (code === RF_INSERTION) {
          if (inWindow) {
            callback(
              INSERTION_TYPE,
              rPos,
              0,
              arena.payloadStringAt(i),
              -1,
              0,
              n,
            )
          }
        } else if (code === RF_REF_SKIP) {
          if (rPos < wHi && rPos + n > wLo) {
            callback(SKIP_TYPE, rPos, n, 'N', -1, 0, 0)
          }
        } else if (code === RF_SOFT_CLIP) {
          if (inWindow) {
            callback(SOFTCLIP_TYPE, rPos, 1, NO_BASES, -1, 0, n)
          }
        } else if (code === RF_HARD_CLIP) {
          if (inWindow) {
            callback(HARDCLIP_TYPE, rPos, 1, NO_BASES, -1, 0, n)
          }
        } else if (code === RF_DELETION) {
          if (rPos < wHi && rPos + n > wLo) {
            callback(DELETION_TYPE, rPos, n, '*', -1, 0, 0)
          }
        } else if (code === RF_INSERT_BASE) {
          // consecutive 'i' features share a refPos; record where they insert
          insertionPos = rPos
          insertedBases += arena.payloadStringAt(i)
          insertedBasesLen += n
        }
      }
    }

    // Flush any remaining accumulated insertions
    if (insertedBasesLen > 0 && insertionPos >= wLo && insertionPos < wHi) {
      callback(
        INSERTION_TYPE,
        insertionPos,
        0,
        insertedBases,
        -1,
        0,
        insertedBasesLen,
      )
    }
  }
}
