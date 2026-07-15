import { SimpleFeature } from '@jbrowse/core/util'

import { isMismatchFeature } from './extractCigarFeatures.ts'

describe('isMismatchFeature', () => {
  // Synteny features (PAF/MCScan) flow through the alignments render path via
  // LGVSyntenyDisplay but have no forEachMismatch — calling it would throw and
  // fail the whole RPC, so they must be detected and skipped.
  test('plain SimpleFeature (e.g. synteny) is not a mismatch feature', () => {
    const feature = new SimpleFeature({
      uniqueId: 'synteny-1',
      refName: 'chr1',
      start: 0,
      end: 100,
      strand: 1,
      CIGAR: '50M2I48M',
    })
    expect(isMismatchFeature(feature)).toBe(false)
  })

  test('feature exposing forEachMismatch is a mismatch feature', () => {
    const feature = Object.assign(
      new SimpleFeature({
        uniqueId: 'read-1',
        refName: 'chr1',
        start: 0,
        end: 10,
      }),
      { forEachMismatch: () => {} },
    )
    expect(isMismatchFeature(feature)).toBe(true)
  })
})
