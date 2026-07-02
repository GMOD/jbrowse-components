import { SimpleFeature, dedupe } from '@jbrowse/core/util'

import { makeFeaturePair, pairKey } from './util.ts'

// A paired feature is inserted into both endpoints' interval trees (flip r1/r2),
// so an intra-chromosomal SV in view comes back as two features with the mate
// direction swapped. Both must reduce to a single arc.
test('mirrored r1/r2 endpoints share a canonical key', () => {
  const r1 = new SimpleFeature({
    uniqueId: 'r1',
    refName: 'chr1',
    start: 5000,
    end: 6000,
    mate: { refName: 'chr1', start: 8000, end: 9000 },
  })
  const r2 = new SimpleFeature({
    uniqueId: 'r2',
    refName: 'chr1',
    start: 8000,
    end: 9000,
    mate: { refName: 'chr1', start: 5000, end: 6000 },
  })

  const { k1: a1, k2: a2 } = makeFeaturePair(r1)
  const { k1: b1, k2: b2 } = makeFeaturePair(r2)
  expect(pairKey(a1, a2)).toBe(pairKey(b1, b2))
})

test('distinct connections get distinct keys', () => {
  const a = new SimpleFeature({
    uniqueId: 'a',
    refName: 'chr1',
    start: 5000,
    end: 6000,
    mate: { refName: 'chr1', start: 8000, end: 9000 },
  })
  const b = new SimpleFeature({
    uniqueId: 'b',
    refName: 'chr1',
    start: 5000,
    end: 6000,
    mate: { refName: 'chr2', start: 8000, end: 9000 },
  })
  const { k1: a1, k2: a2 } = makeFeaturePair(a)
  const { k1: b1, k2: b2 } = makeFeaturePair(b)
  expect(pairKey(a1, a2)).not.toBe(pairKey(b1, b2))
})

test('dedupe collapses the mirrored pair to one arc', () => {
  const feats = [
    new SimpleFeature({
      uniqueId: 'r1',
      refName: 'chr1',
      start: 5000,
      end: 6000,
      mate: { refName: 'chr1', start: 8000, end: 9000 },
    }),
    new SimpleFeature({
      uniqueId: 'r2',
      refName: 'chr1',
      start: 8000,
      end: 9000,
      mate: { refName: 'chr1', start: 5000, end: 6000 },
    }),
  ]
  const styles = feats.map(feature => ({ ...makeFeaturePair(feature) }))
  expect(dedupe(styles, s => pairKey(s.k1, s.k2))).toHaveLength(1)
})
