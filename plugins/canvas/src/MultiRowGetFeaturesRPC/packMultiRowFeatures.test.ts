import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'

import {
  makeFeatureColorResolver,
  packMultiRowFeatures,
} from './packMultiRowFeatures.ts'
import { FEATURE_DEFAULT_COLOR } from '../RenderFeatureDataRPC/featureColors.ts'

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
    jexl: createJexlInstance(),
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
    jexl: createJexlInstance(),
  })
  expect([...r.featureColors]).toEqual([
    cssColorToABGR('rgb(227,26,28)'),
    cssColorToABGR('magenta'),
  ])
})

test('an unset color slot paints from the feature itemRgb, no jexl needed', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect([...r.featureColors]).toEqual([
    cssColorToABGR('rgb(227,26,28)'),
    cssColorToABGR('rgb(31,120,180)'),
    cssColorToABGR('rgb(170,170,170)'),
  ])
  // tells the main thread to drop the per-row palette that would cover these
  expect(r.usedItemRgb).toBe(true)
})

test('no itemRgb on the features leaves the per-row palette in charge', () => {
  const r = packMultiRowFeatures({
    features: [feat({ start: 0, end: 5, sample: 'mom' })],
    partitionField: 'sample',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.usedItemRgb).toBe(false)
  expect([...r.featureColors]).toEqual([cssColorToABGR(FEATURE_DEFAULT_COLOR)])
})

test('a placeholder itemRgb does not hijack the per-row palette', () => {
  // a plain BED12 fills itemRgb with the "no color specified" placeholder, which
  // must not read as black and knock out the palette
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 5, sample: 'mom', itemRgb: '0,0,0' }),
      feat({ start: 5, end: 9, sample: 'dad', itemRgb: '0' }),
    ],
    partitionField: 'sample',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.usedItemRgb).toBe(false)
})

test('the jexl template-string form reads a non-itemRgb color column', () => {
  const r = packMultiRowFeatures({
    features: [feat({ start: 0, end: 5, sample: 'mom', ancestryRgb: '1,2,3' })],
    partitionField: 'sample',
    colorConfig: 'jexl:`rgb(${get(feature,"ancestryRgb")})`',
    jexl: createJexlInstance(),
  })
  expect([...r.featureColors]).toEqual([cssColorToABGR('rgb(1,2,3)')])
})

test('plain (non-jexl) color applies to every feature, beating itemRgb', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    colorConfig: 'red',
    jexl: createJexlInstance(),
  })
  const red = cssColorToABGR('red')
  expect([...r.featureColors]).toEqual([red, red, red])
  expect(r.usedItemRgb).toBe(false)
})

test('missing partition value collapses to a single empty-string row', () => {
  const r = packMultiRowFeatures({
    features: [feat({ start: 1, end: 2 }), feat({ start: 3, end: 4 })],
    partitionField: 'sample',
    colorConfig: 'red',
    jexl: createJexlInstance(),
  })
  expect(r.partitionValues).toEqual([''])
  expect([...r.featurePartitionIndex]).toEqual([0, 0])
})

test('captures feature id for the click → details fetch', () => {
  const r = packMultiRowFeatures({
    features: [
      feat({ id: 'feat1', start: 0, end: 5, sample: 'mom' }),
      feat({ id: 'feat2', start: 5, end: 9, sample: 'mom' }),
    ],
    partitionField: 'sample',
    colorConfig: 'red',
    jexl: createJexlInstance(),
  })
  expect(r.featureIds).toEqual(['feat1', 'feat2'])
})

test('captures feature name for tooltips ("" when absent)', () => {
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 5, sample: 'mom', name: 'mom_maternal' }),
      feat({ start: 5, end: 9, sample: 'mom' }),
    ],
    partitionField: 'sample',
    colorConfig: 'red',
    jexl: createJexlInstance(),
  })
  expect(r.featureNames).toEqual(['mom_maternal', ''])
})

// `colorKey` in the clustering RPC is *defined* as the color painted on screen —
// rows cluster by which colors fall where. makeFeatureColorResolver is shared
// with executeMultiRowClusterFeatures so the two can't disagree; if they did, an
// itemRgb painting would cluster on a uniform color nobody sees and silently
// produce a meaningless row order.
describe('makeFeatureColorResolver (shared with clustering)', () => {
  const resolve = (colorConfig: string | undefined) =>
    features.map(makeFeatureColorResolver(colorConfig, createJexlInstance()))

  test('unset slot resolves each feature to its own itemRgb', () => {
    const colors = resolve(undefined)
    expect(colors.map(c => c.css)).toEqual([
      '227,26,28',
      '31,120,180',
      '170,170,170',
    ])
    expect(colors.every(c => c.fromBed)).toBe(true)
  })

  test('a set slot resolves every feature the same, and never claims fromBed', () => {
    const colors = resolve('red')
    expect(colors.map(c => c.css)).toEqual(['red', 'red', 'red'])
    expect(colors.some(c => c.fromBed)).toBe(false)
  })

  test('resolves the same colors the painting bakes', () => {
    // the invariant clustering depends on: colorKey IS the on-screen color
    const r = packMultiRowFeatures({
      features,
      partitionField: 'sample',
      colorConfig: undefined,
      jexl: createJexlInstance(),
    })
    expect([...r.featureColors]).toEqual(
      resolve(undefined).map(c => cssColorToABGR(c.css)),
    )
  })
})
