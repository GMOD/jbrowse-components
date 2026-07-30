import { isFeatureAdapter, isRefNameSource } from './util.ts'

import type { AnyDataAdapter } from './util.ts'

// A refName-only adapter: it can name its contigs but serves something other
// than features (PlinkLDTabixAdapter serves precomputed LD pairs this way).
const refNameOnly = {
  getRefNames: async () => ['2L'],
} as unknown as AnyDataAdapter

const featureish = {
  getRefNames: async () => ['chr1'],
  getFeatures: () => {},
  setSequenceAdapterConfig: () => {},
} as unknown as AnyDataAdapter

const neither = { getSequence: () => {} } as unknown as AnyDataAdapter

describe('isRefNameSource', () => {
  // The bug this pins: refName renaming used to be gated on isFeatureAdapter,
  // so an adapter like this reported zero refNames. An empty refName list makes
  // the assembly's refName map empty, which makes renaming a silent no-op,
  // which leaves every record dropped by a later exact-match refName test. The
  // user-visible symptom is a blank track with no error whenever the file's
  // contig names differ from the assembly's canonical ones.
  it('accepts an adapter that names contigs but serves no features', () => {
    expect(isRefNameSource(refNameOnly)).toBe(true)
    expect(isFeatureAdapter(refNameOnly)).toBe(false)
  })

  it('still accepts feature adapters', () => {
    expect(isRefNameSource(featureish)).toBe(true)
    expect(isFeatureAdapter(featureish)).toBe(true)
  })

  it('rejects an adapter with no getRefNames', () => {
    expect(isRefNameSource(neither)).toBe(false)
  })
})
