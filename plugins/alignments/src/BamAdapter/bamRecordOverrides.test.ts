import { BamRecord } from '@gmod/bam'

import BamSlightlyLazyFeature from './BamSlightlyLazyFeature.ts'

// The members BamSlightlyLazyFeature deliberately overrides on BamRecord.
// Everything else it defines must be a name BamRecord does not have.
const INTENDED_OVERRIDES = ['forEachMismatch', 'toJSON']

const own = (c: { prototype: object }) =>
  Object.getOwnPropertyNames(c.prototype).filter(n => n !== 'constructor')

// BamSlightlyLazyFeature is the ONE class here that extends a library class —
// SamRecordFeature and CramSlightlyLazyFeature only `implements
// MismatchFeature`. That inheritance makes a purely additive @gmod/bam release
// able to break us, and semver will not warn: adding a method to a class is a
// minor bump, but it is not additive for a subclass that already has that name.
//
// It has happened once already. 8.6.0 introduced `BamRecord.forEachMismatch`,
// and our pre-existing method of that name — positional `(callback,
// windowStart?, windowEnd?)` — became an override whose signature disagreed
// with its base. That one was LOUD: tsc rejected it, which is why the 8.6.0
// adaptation was a real piece of work rather than a version bump.
//
// This test is for the quiet version. If @gmod/bam adds a member whose name we
// already use and whose signature happens to be compatible, nothing complains:
// ours silently shadows theirs, and the record starts answering our way in a
// path that expected the library's. `mismatches`/`getMismatches` and
// `next_ref`/`next_refid` are each one rename away from exactly that.
//
// Same doctrine as bamCodes.test.ts next door: pin the surface, in the place
// that notices a library moved under us.
test('BamSlightlyLazyFeature shadows only what it means to', () => {
  const base = new Set(own(BamRecord))
  const collisions = own(BamSlightlyLazyFeature).filter(n => base.has(n))
  expect(collisions.sort()).toEqual([...INTENDED_OVERRIDES].sort())
})

// The reverse direction, and the reason the list above is exact rather than a
// subset: if a rename or a refactor drops one of our overrides, the base
// implementation silently takes over instead. BamRecord.toJSON emits BAM's own
// field names, not a SimpleFeatureSerialized.
test('the intended overrides still exist on both sides', () => {
  for (const name of INTENDED_OVERRIDES) {
    expect(own(BamRecord)).toContain(name)
    expect(own(BamSlightlyLazyFeature)).toContain(name)
  }
})
