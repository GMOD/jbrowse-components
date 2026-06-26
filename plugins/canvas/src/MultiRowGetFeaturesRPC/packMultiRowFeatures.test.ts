import { tagColorPalette } from '@jbrowse/core/ui/theme'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { MULTIROW_DEFAULT_COLOR } from './multiRowColors.ts'
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
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: 'goldenrod',
    sampleColorMap: {},
  })
  expect(r.partitionValues).toEqual(['mom', 'offspring01'])
  expect([...r.featurePartitionIndex]).toEqual([0, 1, 1])
  expect([...r.featureStarts]).toEqual([0, 0, 30])
  expect([...r.featureEnds]).toEqual([50, 30, 50])
})

test('resolves a jexl color expression per feature (the demo rgb() form)', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: `jexl:'rgb('+get(feature,'itemRgb')+')'`,
    sampleColorMap: {},
    jexl: createJexlInstance(),
  })
  expect([...r.featureColors]).toEqual([
    cssColorToABGR('rgb(227,26,28)'),
    cssColorToABGR('rgb(31,120,180)'),
    cssColorToABGR('rgb(170,170,170)'),
  ])
})

test('a feature with empty itemRgb (-> "rgb()") degrades to magenta, not a crash', () => {
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 5, sample: 'mom', itemRgb: '227,26,28' }),
      feat({ start: 5, end: 9, sample: 'mom', itemRgb: '' }),
    ],
    partitionField: 'sample',
    colorConfig: `jexl:'rgb('+get(feature,'itemRgb')+')'`,
    sampleColorMap: {},
    jexl: createJexlInstance(),
  })
  expect([...r.featureColors]).toEqual([
    cssColorToABGR('rgb(227,26,28)'),
    cssColorToABGR('magenta'),
  ])
})

test('plain (non-jexl) color applies to every feature', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: 'red',
    sampleColorMap: {},
  })
  const red = cssColorToABGR('red')
  expect([...r.featureColors]).toEqual([red, red, red])
})

test('sampleColorMap overrides the color slot for matching partition values', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: 'red',
    sampleColorMap: { offspring01: 'blue' },
  })
  // 'mom' has no map entry -> falls back to the 'red' color slot; offspring01
  // rows take the mapped blue
  expect([...r.featureColors]).toEqual([
    cssColorToABGR('red'),
    cssColorToABGR('blue'),
    cssColorToABGR('blue'),
  ])
})

test('default color slot auto-assigns a per-row palette color by partition index', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: MULTIROW_DEFAULT_COLOR,
    sampleColorMap: {},
  })
  // mom -> palette[0]; both offspring01 features share row 1 -> palette[1]
  expect([...r.featureColors]).toEqual([
    cssColorToABGR(tagColorPalette[0]!),
    cssColorToABGR(tagColorPalette[1]!),
    cssColorToABGR(tagColorPalette[1]!),
  ])
})

test('sampleColorMap entry wins over the palette; unmapped rows still get it', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: MULTIROW_DEFAULT_COLOR,
    sampleColorMap: { mom: 'black' },
  })
  expect([...r.featureColors]).toEqual([
    cssColorToABGR('black'),
    cssColorToABGR(tagColorPalette[1]!),
    cssColorToABGR(tagColorPalette[1]!),
  ])
})

test('missing partition value collapses to a single empty-string row', () => {
  const r = packMultiRowFeatures({
    features: [feat({ start: 1, end: 2 }), feat({ start: 3, end: 4 })],
    partitionField: 'sample',
    colorConfig: 'red',
    sampleColorMap: {},
  })
  expect(r.partitionValues).toEqual([''])
  expect([...r.featurePartitionIndex]).toEqual([0, 0])
})

test('captures feature name for tooltips ("" when absent)', () => {
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 5, sample: 'mom', name: 'mom_maternal' }),
      feat({ start: 5, end: 9, sample: 'mom' }),
    ],
    partitionField: 'sample',
    colorConfig: 'red',
    sampleColorMap: {},
  })
  expect(r.featureNames).toEqual(['mom_maternal', ''])
})
