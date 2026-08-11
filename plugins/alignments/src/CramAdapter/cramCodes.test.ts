import {
  RF_DELETION,
  RF_HARD_CLIP,
  RF_INSERTION,
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

// CramSlightlyLazyFeature hands its callback straight to @gmod/cram's
// forEachMismatch, which reports a difference by its CRAM feature code. That
// only works while our constants ARE those codes. If this fails, either
// @gmod/cram renumbered its feature codes or someone renumbered ours, and the
// CRAM path is silently reporting every difference as the wrong type — nothing
// else would catch it, because both sides are plain numbers.
//
// cigar-utils cannot import these itself: it is format-agnostic and does not
// depend on @gmod/cram. So the agreement is pinned here, where the dependency
// already exists.
test('our mismatch type constants are @gmod/cram feature codes', () => {
  expect(MISMATCH_TYPE).toBe(RF_SUBST)
  expect(INSERTION_TYPE).toBe(RF_INSERTION)
  expect(DELETION_TYPE).toBe(RF_DELETION)
  expect(SKIP_TYPE).toBe(RF_REF_SKIP)
  expect(SOFTCLIP_TYPE).toBe(RF_SOFT_CLIP)
  expect(HARDCLIP_TYPE).toBe(RF_HARD_CLIP)
})
