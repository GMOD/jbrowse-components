import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { packMultiRowFeatures } from './packMultiRowFeatures.ts'

import type { Feature } from '@jbrowse/core/util'

function feat(attrs: Record<string, unknown>): Feature {
  return {
    get: (k: string) => attrs[k],
    id: () => String(attrs.id ?? `${attrs.start}`),
  } as Feature
}

const features = [
  feat({ start: 0, end: 50, sample: 'mom', itemRgb: '227,26,28' }),
  feat({ start: 0, end: 30, sample: 'offspring01', itemRgb: '31,120,180' }),
  feat({ start: 30, end: 50, sample: 'offspring01', itemRgb: '170,170,170' }),
]

test('dedupes partition values and indexes features into them', () => {
  const r = packMultiRowFeatures(features, 'sample', 'goldenrod')
  expect(r.partitionValues).toEqual(['mom', 'offspring01'])
  expect([...r.featurePartitionIndex]).toEqual([0, 1, 1])
  expect([...r.featureStarts]).toEqual([0, 0, 30])
  expect([...r.featureEnds]).toEqual([50, 30, 50])
})

test('resolves a jexl color expression per feature (the demo rgb() form)', () => {
  const jexl = createJexlInstance()
  const r = packMultiRowFeatures(
    features,
    'sample',
    `jexl:'rgb('+get(feature,'itemRgb')+')'`,
    jexl,
  )
  expect([...r.featureColors]).toEqual([
    cssColorToABGR('rgb(227,26,28)'),
    cssColorToABGR('rgb(31,120,180)'),
    cssColorToABGR('rgb(170,170,170)'),
  ])
})

test('plain (non-jexl) color applies to every feature', () => {
  const r = packMultiRowFeatures(features, 'sample', 'red')
  const red = cssColorToABGR('red')
  expect([...r.featureColors]).toEqual([red, red, red])
})

test('missing partition value collapses to a single empty-string row', () => {
  const r = packMultiRowFeatures(
    [feat({ start: 1, end: 2 }), feat({ start: 3, end: 4 })],
    'sample',
    'red',
  )
  expect(r.partitionValues).toEqual([''])
  expect([...r.featurePartitionIndex]).toEqual([0, 0])
})

test('captures feature name for tooltips ("" when absent)', () => {
  const r = packMultiRowFeatures(
    [
      feat({ start: 0, end: 5, sample: 'mom', name: 'mom_maternal' }),
      feat({ start: 5, end: 9, sample: 'mom' }),
    ],
    'sample',
    'red',
  )
  expect(r.featureNames).toEqual(['mom_maternal', ''])
})
