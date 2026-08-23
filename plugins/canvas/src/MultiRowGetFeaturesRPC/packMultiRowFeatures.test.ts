import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { FEATURE_DEFAULT_COLOR } from '../RenderFeatureDataRPC/featureColors.ts'
import {
  makeFeatureColorResolver,
  packMultiRowFeatures,
} from './packMultiRowFeatures.ts'

import type { Feature } from '@jbrowse/core/util'

// A real SimpleFeature rather than a stub of one. The pack reads features three
// ways now — `get`, `id` and (for the partition candidates) `toJSON` — and a
// hand-rolled object answering those independently can pass a test while naming
// a column nothing can be read from. It also needs no cast.
function feat(
  attrs: Record<string, unknown> & { start: number; end: number },
): Feature {
  return new SimpleFeature({
    uniqueId: String(attrs.id ?? attrs.start),
    // required of a serialized feature and irrelevant to every assertion here;
    // ahead of the spread so a case can still name its own
    refName: 'ctgA',
    ...attrs,
  })
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
    lengthField: '',
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
    lengthField: '',
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
    lengthField: '',
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
    lengthField: '',
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
    lengthField: '',
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
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.usedItemRgb).toBe(false)
})

test('the jexl template-string form reads a non-itemRgb color column', () => {
  const r = packMultiRowFeatures({
    features: [feat({ start: 0, end: 5, sample: 'mom', ancestryRgb: '1,2,3' })],
    partitionField: 'sample',
    lengthField: '',
    colorConfig: 'jexl:`rgb(${get(feature,"ancestryRgb")})`',
    jexl: createJexlInstance(),
  })
  expect([...r.featureColors]).toEqual([cssColorToABGR('rgb(1,2,3)')])
})

test('plain (non-jexl) color applies to every feature, beating itemRgb', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    lengthField: '',
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
    lengthField: '',
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
    lengthField: '',
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
    lengthField: '',
    colorConfig: 'red',
    jexl: createJexlInstance(),
  })
  expect(r.featureNames).toEqual(['mom_maternal', ''])
})

test('a numeric name column is a label, not an absent name', () => {
  // same coercion the partition value gets, and for the same reason: which of
  // string/number a BED column arrives as is the parser's business. Dropped to
  // '' these lost the tooltip its text and the legend its entry, since
  // buildColorLegend skips unnamed features.
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 5, sample: 'mom', name: 12 }),
      feat({ start: 5, end: 9, sample: 'mom', name: 0 }),
    ],
    partitionField: 'sample',
    lengthField: '',
    colorConfig: 'red',
    jexl: createJexlInstance(),
  })
  expect(r.featureNames).toEqual(['12', '0'])
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
    // The constant-slot fast path: one answer for the whole region, and a set
    // slot beats the file's own itemRgb (which these features all carry).
    const colors = resolve('red')
    expect(colors.map(c => c.css)).toEqual(['red', 'red', 'red'])
    expect(colors.some(c => c.fromBed)).toBe(false)
  })

  test('a jexl slot is still evaluated per feature', () => {
    // The other side of the fast path above: a callback slot cannot be hoisted,
    // and hoisting it would paint the whole region in whichever color the first
    // feature happened to resolve.
    const colors = resolve(
      "jexl:feature.sample=='mom'?'tomato':'cornflowerblue'",
    )
    expect(colors.map(c => c.css)).toEqual([
      'tomato',
      'cornflowerblue',
      'cornflowerblue',
    ])
    expect(colors.some(c => c.fromBed)).toBe(false)
  })

  test('a jexl slot that yields no color degrades to the default', () => {
    // Whether the expression throws or simply resolves to a non-string, one bad
    // slot costs the color and not the region.
    const colors = resolve('jexl:feature.missing.deeper')
    expect(colors.map(c => c.css)).toEqual([
      FEATURE_DEFAULT_COLOR,
      FEATURE_DEFAULT_COLOR,
      FEATURE_DEFAULT_COLOR,
    ])
  })

  test('resolves the same colors the painting bakes', () => {
    // the invariant clustering depends on: colorKey IS the on-screen color
    const r = packMultiRowFeatures({
      features,
      partitionField: 'sample',
      lengthField: '',
      colorConfig: undefined,
      jexl: createJexlInstance(),
    })
    expect([...r.featureColors]).toEqual(
      resolve(undefined).map(c => cssColorToABGR(c.css)),
    )
  })
})

test('packs no deltas when lengthField is unset', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  // length 0, not n zeros: this is what tells the render side the glyph pass is
  // off, and a zero delta is a legitimate reference-length allele
  expect(r.featureDeltas).toHaveLength(0)
})

test('packs signed deltas from lengthField, coercing strings', () => {
  const r = packMultiRowFeatures({
    // a BED column arrives as a string from some parsers and a number from
    // others, and an absent value must not become a glyph
    features: [
      feat({ start: 0, end: 50, sample: 'a', delta: '113174' }),
      feat({ start: 0, end: 30, sample: 'b', delta: -3217 }),
      feat({ start: 30, end: 50, sample: 'c' }),
      feat({ start: 30, end: 50, sample: 'd', delta: 'ref' }),
    ],
    partitionField: 'sample',
    lengthField: 'delta',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect([...r.featureDeltas]).toEqual([113174, -3217, 0, 0])
})

// UCSC's bigRmskBed keeps the repeat class in the name (`L1HS#LINE/L1`) rather
// than in a column, so the attribute form can only split on the full repeat
// name. This is the same file read as ~20 classes instead of thousands of names.
const RMSK_CLASS = "jexl:split(split(feature.name,'#')[1],'/')[0]"

test('partitions on a jexl expression, not just an attribute', () => {
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 50, name: 'L1HS#LINE/L1' }),
      feat({ start: 0, end: 30, name: 'AluY#SINE/Alu' }),
      feat({ start: 30, end: 50, name: 'L1PA2#LINE/L1' }),
      feat({ start: 50, end: 60, name: '(ACCTA)n#Simple_repeat' }),
    ],
    partitionField: RMSK_CLASS,
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.partitionValues).toEqual(['LINE', 'SINE', 'Simple_repeat'])
  expect([...r.featurePartitionIndex]).toEqual([0, 1, 0, 2])
})

// The empty slot is the auto sentinel. A RepeatMasker table carries `repClass`
// as a column, and `name` there is the repeat instance — tens of thousands of
// one-feature rows — so the pick has to happen off the columns rather than off
// the config, which never saw them.
describe('the empty partitionField picks a column off the data', () => {
  const rmskFeatures = [
    feat({ start: 0, end: 50, name: 'L1HS', repClass: 'LINE' }),
    feat({ start: 0, end: 30, name: 'AluY', repClass: 'SINE' }),
    feat({ start: 30, end: 50, name: 'L1PA2', repClass: 'LINE' }),
  ]

  function packed(features: Feature[], partitionField: string) {
    return packMultiRowFeatures({
      features,
      partitionField,
      lengthField: '',
      colorConfig: undefined,
      jexl: createJexlInstance(),
    })
  }

  it('takes repClass where the features carry it', () => {
    const r = packed(rmskFeatures, '')
    expect(r.resolvedPartitionField).toBe('repClass')
    expect(r.partitionValues).toEqual(['LINE', 'SINE'])
    expect([...r.featurePartitionIndex]).toEqual([0, 1, 0])
  })

  it('falls back to name where nothing preferred is there', () => {
    const r = packed([feat({ start: 0, end: 5, name: 'seg1' })], '')
    expect(r.resolvedPartitionField).toBe('name')
    expect(r.partitionValues).toEqual(['seg1'])
  })

  // A configured field is a decision, and auto does not get to second-guess it —
  // including on the very file the preference exists for.
  it('leaves a configured field alone', () => {
    const r = packed(rmskFeatures, 'name')
    expect(r.resolvedPartitionField).toBe('name')
    expect(r.partitionValues).toEqual(['L1HS', 'AluY', 'L1PA2'])
  })
})

test('a feature the expression throws on costs its own row, not the region', () => {
  const r = packMultiRowFeatures({
    // no '#', so the inner split yields undefined and the outer one throws
    features: [
      feat({ start: 0, end: 50, name: 'L1HS#LINE/L1' }),
      feat({ start: 0, end: 30, name: 'unparseable' }),
    ],
    partitionField: RMSK_CLASS,
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.partitionValues).toEqual(['LINE', ''])
  expect([...r.featurePartitionIndex]).toEqual([0, 1])
})

test('coerces a numeric partition value rather than dropping it', () => {
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 50, state: 15 }),
      feat({ start: 0, end: 30, state: 15 }),
      feat({ start: 30, end: 50 }),
    ],
    partitionField: 'state',
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.partitionValues).toEqual(['15', ''])
})

// The "Partition by..." menu's options. Discovered from the data rather than
// declared, so the one thing the display is built on stops being config-only.
test('collects the attribute names a reader could partition on', () => {
  const r = packMultiRowFeatures({
    features,
    partitionField: 'sample',
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  // sorted, and without the ones naming a feature's PLACE — rows keyed on
  // `start` are one row per feature, which is what the menu exists to get a
  // reader out of
  expect(r.partitionCandidates).toEqual(['itemRgb', 'sample'])
})

test('unions the names over the head of the list, not just the first feature', () => {
  const r = packMultiRowFeatures({
    features: [
      feat({ start: 0, end: 50, sample: 'mom' }),
      feat({ start: 0, end: 30, sample: 'dad', clade: 'B' }),
    ],
    partitionField: 'sample',
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.partitionCandidates).toEqual(['clade', 'sample'])
})

// Bounded, so this cannot become a per-feature cost on a painting carrying half
// a million segments.
test('samples the head rather than every feature', () => {
  const many = Array.from({ length: 500 }, (_, i) =>
    feat({ start: i, end: i + 1, sample: 'a', [`col${i}`]: 1 }),
  )
  const r = packMultiRowFeatures({
    features: many,
    partitionField: 'sample',
    lengthField: '',
    colorConfig: undefined,
    jexl: createJexlInstance(),
  })
  expect(r.partitionCandidates).toContain('col0')
  expect(r.partitionCandidates).not.toContain('col400')
})
