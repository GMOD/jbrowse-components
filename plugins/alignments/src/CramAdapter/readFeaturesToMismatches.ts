import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '@jbrowse/cigar-utils'

import type { CramRecord } from '@gmod/cram'
import type { MismatchCallback } from '@jbrowse/cigar-utils'

type ReadFeatures = CramRecord['readFeatures']

// Pure readFeatures→mismatch walk backing CramSlightlyLazyFeature.forEachMismatch
// (extracted so it's unit-testable with plain fixtures, like
// readFeaturesToNumericCIGAR). refPos is read-relative; windowStart/windowEnd are
// passed already converted to that space, or ±Infinity for no clip.
export function readFeaturesToMismatches(
  readFeatures: ReadFeatures,
  featStart: number,
  qual: ArrayLike<number> | null | undefined,
  wLo: number,
  wHi: number,
  callback: MismatchCallback,
) {
  if (readFeatures !== undefined) {
    const hasQual = !!qual
    const len = readFeatures.length
    let insertedBases = ''
    let insertedBasesLen = 0
    let insertionPos = 0

    for (let i = 0; i < len; i++) {
      const rf = readFeatures[i]!
      const refPos = rf.refPos - 1 - featStart
      const { code } = rf

      // Consecutive single-base 'i' features at the same refPos accumulate into
      // one insertion. Flush it before processing any non-'i' feature (or an 'i'
      // that starts a new position). Flushing here (rather than after) emits the
      // insertion ahead of a same-position mismatch, matching the BAM/CRAM
      // readFeatures order.
      if (insertedBasesLen > 0 && (code !== 'i' || refPos !== insertionPos)) {
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

      const inWindow = refPos < wHi && refPos + 1 > wLo

      if (code === 'X') {
        if (inWindow) {
          const refCharCode = rf.ref ? rf.ref.charCodeAt(0) & ~0x20 : 0
          callback(
            MISMATCH_TYPE,
            refPos,
            1,
            rf.sub ?? 'N',
            hasQual ? qual[rf.pos - 1]! : -1,
            refCharCode,
            0,
          )
        }
      } else if (code === 'I') {
        if (inWindow) {
          callback(INSERTION_TYPE, refPos, 0, rf.data, -1, 0, rf.data.length)
        }
      } else if (code === 'N') {
        if (refPos < wHi && refPos + rf.data > wLo) {
          callback(SKIP_TYPE, refPos, rf.data, 'N', -1, 0, 0)
        }
      } else if (code === 'S') {
        if (inWindow) {
          const dataLen = rf.data.length
          callback(SOFTCLIP_TYPE, refPos, 1, `S${dataLen}`, -1, 0, dataLen)
        }
      } else if (code === 'H') {
        if (inWindow) {
          callback(HARDCLIP_TYPE, refPos, 1, `H${rf.data}`, -1, 0, rf.data)
        }
      } else if (code === 'D') {
        if (refPos < wHi && refPos + rf.data > wLo) {
          callback(DELETION_TYPE, refPos, rf.data, '*', -1, 0, 0)
        }
      } else if (code === 'i') {
        // consecutive 'i' features share a refPos; record where they insert
        insertionPos = refPos
        insertedBases += rf.data
        insertedBasesLen++
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
