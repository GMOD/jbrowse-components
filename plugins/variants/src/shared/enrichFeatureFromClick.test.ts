import { enrichFeatureFromClick } from './enrichFeatureFromClick.ts'

import type { VariantFeatureInfo } from './types.ts'

const baseFeature = {
  id: () => 'bnd1',
  toJSON: () => ({
    uniqueId: 'bnd1',
    refName: 'chr1',
    start: 100,
    end: 101,
    name: 'bnd1',
  }),
}

const featureInfo: VariantFeatureInfo = {
  ref: 'A',
  alt: ['A[chr2:200['],
  name: 'bnd1',
  description: 'breakend',
  length: 1,
  type: 'breakend',
  genotypeCodes: new Uint16Array(),
}

const clickResult = {
  sampleName: 'HG001',
  genotype: '1',
  alleles: 'A[chr2:200[',
}

test('carries type through so the widget can show SV/breakend panels', () => {
  const f = enrichFeatureFromClick(baseFeature, featureInfo, clickResult)
  expect(f.get('type')).toBe('breakend')
  expect(f.get('ALT')).toEqual(['A[chr2:200['])
  expect(f.get('REF')).toBe('A')
  expect(f.get('clickedSample')).toBe('HG001')
})

test('positional fields from the base feature survive', () => {
  const f = enrichFeatureFromClick(baseFeature, featureInfo, clickResult)
  expect(f.get('refName')).toBe('chr1')
  expect(f.get('start')).toBe(100)
})
