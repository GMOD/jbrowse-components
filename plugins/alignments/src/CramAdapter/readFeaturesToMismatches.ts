import {
  RF_BASE_QUAL,
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
// (extracted so it's unit-testable with plain fixtures). refPos is
// read-relative; windowStart/windowEnd are passed already converted to that
// space, or ±Infinity for no clip.
//
// Reads cram-js's columnar read features rather than `record.readFeatures`,
// which rebuilds an array of ~64-byte objects on every access. Only the
// insertion branches touch a payload string, and only inside the window.
//
// Quality comes in as the record's slice-wide column plus its offset into it,
// not as `record.qualityScores` — that getter builds a fresh ~104-byte subarray
// view on every access, and this is called once per read per render pass. It is
// the same pair cram-js's own forEachMismatch takes, for the same reason.
//
// @gmod/cram has this same walk as `CramRecord.forEachMismatch`, and delegating
// to it was tried: it is correct (identical emissions, 3,140,520 of them, on
// 628 ONT reads) but **17% slower**, because the vocabularies differ — cram-js
// reports the CRAM feature code and absolute positions, jbrowse's callback
// wants a `*_TYPE` constant and read-relative ones, so delegating puts a
// translating callback between the walk and this one's consumer. Measured one
// variant per process, fastest of 9: 266ms against 312ms on 200x.longread, and
// 13.2ms against 18.4ms on 200x.shortread. Consolidating the translation into
// lookup tables and a single call site made no difference — the cost is the
// indirect call per emission, which is the same thing @gmod/cram's ADR 0006
// measured for forEachCigarOp. This is the plotting path, so the duplication
// stays and is kept honest against cram-js's copy instead.
export function readFeaturesToMismatches(
  arena: ReadFeatureArena | undefined,
  featureStart: number,
  featureCount: number,
  featStart: number,
  qualColumn: Uint8Array | undefined,
  qualStart: number,
  wLo: number,
  wHi: number,
  callback: MismatchCallback,
) {
  if (arena !== undefined) {
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
              // arena pos is 0-based as of @gmod/cram v10, so it indexes the
              // record's own scores directly; the old `- 1` read one base early
              // and returned undefined for a substitution at the read's first base
              qualColumn === undefined ? -1 : qualColumn[qualStart + pos[i]!]!,
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
        } else if (code === RF_BASE_QUAL) {
          // 'B' stores one read base verbatim with its own quality score
          // instead of through the substitution matrix 'X' uses. It aligns as a
          // match, so it is a difference only when the base it carries is not
          // the reference base — and with no reference applied there is nothing
          // to compare against, so a refCode of 0 reports nothing rather than
          // guessing. `num` is B's own quality, which is the one the file
          // preserved for this base. Matches cram-js's forEachMismatch, which
          // is where this branch came from; this walk used to drop B entirely.
          const refCharCode = refCodes[i]! & ~0x20
          const base = arena.payloadByteAt(i) & ~0x20
          if (inWindow && refCharCode !== 0 && base !== refCharCode) {
            callback(
              MISMATCH_TYPE,
              rPos,
              1,
              String.fromCharCode(base),
              n,
              refCharCode,
              0,
            )
          }
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
