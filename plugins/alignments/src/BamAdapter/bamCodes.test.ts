import {
  MISMATCH_DELETION,
  MISMATCH_HARD_CLIP,
  MISMATCH_INSERTION,
  MISMATCH_REF_SKIP,
  MISMATCH_SOFT_CLIP,
  MISMATCH_SUBST,
} from '@gmod/bam'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '@jbrowse/cigar-utils'

// BamSlightlyLazyFeature hands its callback straight to @gmod/bam's
// forEachMismatchNumeric, which reports a difference by a CIGAR char code.
// That only works while our constants ARE those codes. If this fails, either
// @gmod/bam renumbered them or someone renumbered ours, and the BAM path is
// silently reporting every difference as the wrong type — nothing else would
// catch it, because both sides are plain numbers.
//
// The CRAM twin of this is cramCodes.test.ts; between them they pin the one
// vocabulary all three libraries share. cigar-utils cannot assert it itself:
// it is format-agnostic and depends on neither library.
test('our mismatch type constants are @gmod/bam mismatch codes', () => {
  expect(MISMATCH_TYPE).toBe(MISMATCH_SUBST)
  expect(INSERTION_TYPE).toBe(MISMATCH_INSERTION)
  expect(DELETION_TYPE).toBe(MISMATCH_DELETION)
  expect(SKIP_TYPE).toBe(MISMATCH_REF_SKIP)
  expect(SOFTCLIP_TYPE).toBe(MISMATCH_SOFT_CLIP)
  expect(HARDCLIP_TYPE).toBe(MISMATCH_HARD_CLIP)
})
