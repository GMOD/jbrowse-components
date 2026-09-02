import { CramRecord } from '@gmod/cram'

import CramSlightlyLazyFeature from './CramSlightlyLazyFeature.ts'

// The members CramSlightlyLazyFeature deliberately overrides on CramRecord.
// Everything else it defines must be a name CramRecord does not have.
const INTENDED_OVERRIDES = ['forEachMismatch', 'getTag', 'tags', 'toJSON']

const own = (c: { prototype: object }) =>
  Object.getOwnPropertyNames(c.prototype).filter(n => n !== 'constructor')

// The CRAM twin of bamRecordOverrides.test.ts, for the same reason: inheriting
// from a library class lets a purely additive minor release shadow one of our
// members without semver saying anything. A signature that disagrees is loud
// (tsc rejects it); this is for the quiet case, where @gmod/cram grows a
// `name`, `score` or `seq` whose signature happens to be compatible with ours
// and the record silently starts answering our way in a path that expected the
// library's.
test('CramSlightlyLazyFeature shadows only what it means to', () => {
  const base = new Set(own(CramRecord))
  const collisions = own(CramSlightlyLazyFeature).filter(n => base.has(n))
  expect(collisions.sort()).toEqual([...INTENDED_OVERRIDES].sort())
})

// The reverse direction, and the reason the list above is exact rather than a
// subset: if a rename or a refactor drops one of our overrides, the base
// implementation silently takes over instead. CramRecord.toJSON emits
// `readName` where this side emits `name`.
test('the intended overrides still exist on both sides', () => {
  for (const name of INTENDED_OVERRIDES) {
    expect(own(CramRecord)).toContain(name)
    expect(own(CramSlightlyLazyFeature)).toContain(name)
  }
})
