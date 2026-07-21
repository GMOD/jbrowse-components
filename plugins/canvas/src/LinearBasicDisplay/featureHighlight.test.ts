import { featureMatchesHighlight } from './featureHighlight.ts'

import type { FeatureHighlight } from './featureHighlight.ts'

const gene: FeatureHighlight = {
  refName: 'chr1',
  start: 1000,
  end: 2000,
  name: 'BRCA1',
}

test('exact span matches regardless of the stored label', () => {
  expect(
    featureMatchesHighlight({ startBp: 1000, endBp: 2000 }, 'chr1', gene),
  ).toBe(true)
})

test('off-by-one span (base convention drift) still matches', () => {
  expect(
    featureMatchesHighlight({ startBp: 999, endBp: 2000 }, 'chr1', gene),
  ).toBe(true)
})

test('an overlapping but non-exact span does not match (no overlap fallback)', () => {
  // previously rescued by a matching name; text search now resolves by span
  // alone, so a nested/overlapping feature no longer gets swept in
  expect(
    featureMatchesHighlight({ startBp: 1200, endBp: 1800 }, 'chr1', gene),
  ).toBe(false)
})

test('a non-overlapping span (paralog elsewhere) does not match', () => {
  expect(
    featureMatchesHighlight({ startBp: 50000, endBp: 51000 }, 'chr1', gene),
  ).toBe(false)
})

test('wrong refName never matches', () => {
  expect(
    featureMatchesHighlight({ startBp: 1000, endBp: 2000 }, 'chr2', gene),
  ).toBe(false)
})
