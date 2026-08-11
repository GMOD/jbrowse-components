import {
  CHAR_FROM_CODE,
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '@jbrowse/cigar-utils'

import type { Mismatch, MismatchCallback } from '@jbrowse/cigar-utils'

// Builds a Mismatch[] by driving forEachMismatch. Not used by the hot render
// path (which drives forEachMismatch directly, zero-alloc) — kept for
// get('mismatches') and feature details. Shared by BAM and CRAM lazy features.
export function collectMismatches(feature: {
  forEachMismatch: (callback: MismatchCallback) => void
}): Mismatch[] {
  const mismatches: Mismatch[] = []
  feature.forEachMismatch(
    (type, start, length, base, qual, altbase, cliplen) => {
      if (type === MISMATCH_TYPE) {
        mismatches.push({
          type: 'mismatch',
          start,
          length,
          base,
          qual: qual !== undefined && qual >= 0 ? qual : undefined,
          altbase:
            altbase !== undefined && altbase > 0
              ? CHAR_FROM_CODE[altbase]
              : undefined,
        })
      } else if (type === INSERTION_TYPE) {
        mismatches.push({
          type: 'insertion',
          start,
          length,
          insertlen: cliplen!,
          insertedBases: base,
        })
        // a clip occupies one reference column whatever its read length, which
        // travels in `cliplen`. Set here rather than per emission: the walks
        // report `length` 0 for a clip (it consumes no reference), and the hot
        // render path reads `cliplen` and ignores `length` entirely, so this is
        // the only place the object convention has to hold.
      } else if (type === SOFTCLIP_TYPE) {
        mismatches.push({
          type: 'softclip',
          start,
          length: 1,
          cliplen: cliplen!,
        })
      } else if (type === HARDCLIP_TYPE) {
        mismatches.push({
          type: 'hardclip',
          start,
          length: 1,
          cliplen: cliplen!,
        })
      } else if (type === DELETION_TYPE) {
        mismatches.push({ type: 'deletion', start, length })
      } else if (type === SKIP_TYPE) {
        mismatches.push({ type: 'skip', start, length })
      }
    },
  )
  return mismatches
}
