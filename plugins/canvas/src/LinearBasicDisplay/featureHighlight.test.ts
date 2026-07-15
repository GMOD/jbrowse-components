import { featureMatchesHighlight } from './featureHighlight.ts'

import type { FeatureHighlight } from './featureHighlight.ts'

const gene: FeatureHighlight = {
  refName: 'chr1',
  start: 1000,
  end: 2000,
  name: 'BRCA1',
}

test('exact span matches regardless of name', () => {
  expect(
    featureMatchesHighlight({ startBp: 1000, endBp: 2000 }, 'chr1', gene),
  ).toBe(true)
  // shortened/missing label still matches on coords alone
  expect(
    featureMatchesHighlight(
      { startBp: 1000, endBp: 2000, name: 'BRCA1...' },
      'chr1',
      gene,
    ),
  ).toBe(true)
})

test('off-by-one span (base convention drift) still matches', () => {
  expect(
    featureMatchesHighlight({ startBp: 999, endBp: 2000 }, 'chr1', gene),
  ).toBe(true)
})

test('different span but overlapping + same name matches', () => {
  // e.g. a transcript indexed under the gene, collapsed to the gene glyph
  expect(
    featureMatchesHighlight(
      { startBp: 1200, endBp: 1800, name: 'brca1' },
      'chr1',
      gene,
    ),
  ).toBe(true)
})

test('overlapping but different name does not match', () => {
  expect(
    featureMatchesHighlight(
      { startBp: 1200, endBp: 1800, name: 'TP53' },
      'chr1',
      gene,
    ),
  ).toBe(false)
})

test('same name but non-overlapping (paralog elsewhere) does not match', () => {
  expect(
    featureMatchesHighlight(
      { startBp: 50000, endBp: 51000, name: 'BRCA1' },
      'chr1',
      gene,
    ),
  ).toBe(false)
})

test('wrong refName never matches', () => {
  expect(
    featureMatchesHighlight(
      { startBp: 1000, endBp: 2000, name: 'BRCA1' },
      'chr2',
      gene,
    ),
  ).toBe(false)
})
