import { collectLegendCandidates } from '../../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import {
  buildColorLegend,
  entryHidden,
  resolveConfiguredLegend,
} from './colorLegend.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

function regionData(
  data: Omit<MultiRowRegionData, 'legendCandidates'>,
): MultiRowRegionData {
  return { ...data, legendCandidates: collectLegendCandidates(data) }
}

// chromHMM-style: two states painted by name on two rows, colored per feature
const region = regionData({
  featureStarts: Uint32Array.from([10, 20, 30, 40]),
  featureEnds: Uint32Array.from([15, 25, 35, 45]),
  featureColors: Uint32Array.from([
    0xff0000ff, 0xff00ff00, 0xff0000ff, 0xff00ff00,
  ]),
  partitionValues: ['E001', 'E002'],
  featurePartitionIndex: Uint32Array.from([0, 0, 1, 1]),
  featureNames: ['TssA', 'Quies', 'TssA', 'Quies'],
  featureIds: ['f1', 'f2', 'f3', 'f4'],
  featureDeltas: new Int32Array(0),
  usedItemRgb: false,
  partitionCandidates: [],
  partitionCandidateValues: [],
  resolvedPartitionField: 'name',
})

const rowIndexByValue = new Map([
  ['E001', 0],
  ['E002', 1],
])

test('distinct (name -> color) pairs, in the names order', () => {
  expect(
    buildColorLegend([region], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'Quies', values: ['Quies'], color: 0xff00ff00 },
    { label: 'TssA', values: ['TssA'], color: 0xff0000ff },
  ])
})

// The key read first-seen order off whichever region loaded first, so a pan
// that brought a new region in ahead of the rest reordered its rows.
test('a pan meeting the names in another order lists them in the same order', () => {
  const panned = regionData({
    ...region,
    featureNames: ['Quies', 'TssA', 'Quies', 'TssA'],
    featureColors: Uint32Array.from([
      0xff00ff00, 0xff0000ff, 0xff00ff00, 0xff0000ff,
    ]),
  })
  const labels = (regions: MultiRowRegionData[], domain?: string[]) =>
    buildColorLegend(
      regions,
      rowIndexByValue,
      [undefined, undefined],
      domain,
    ).map(e => e.label)
  expect(labels([panned, region])).toEqual(labels([region, panned]))
  expect(labels([panned, region], ['TssA'])).toEqual(['TssA', 'Quies'])
})

test('reads the packed candidates rather than the features', () => {
  let readFeatures = false
  const watched: MultiRowRegionData = {
    ...region,
    get featureNames() {
      readFeatures = true
      return region.featureNames
    },
    get featureColors() {
      readFeatures = true
      return region.featureColors
    },
    get featurePartitionIndex() {
      readFeatures = true
      return region.featurePartitionIndex
    },
  }
  expect(
    buildColorLegend([watched], rowIndexByValue, [undefined, undefined]),
  ).toHaveLength(2)
  expect(readFeatures).toBe(false)
})

test('unions the candidates of every loaded region', () => {
  const second = regionData({
    ...region,
    featureColors: Uint32Array.from([0xffabcdef, 0xffabcdef]),
    featurePartitionIndex: Uint32Array.from([0, 1]),
    featureNames: ['Enh', 'Enh'],
    featureIds: ['g1', 'g2'],
    featureStarts: Uint32Array.from([60, 70]),
    featureEnds: Uint32Array.from([65, 75]),
  })
  expect(
    buildColorLegend([region, second], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'Enh', values: ['Enh'], color: 0xffabcdef },
    { label: 'Quies', values: ['Quies'], color: 0xff00ff00 },
    { label: 'TssA', values: ['TssA'], color: 0xff0000ff },
  ])
  expect(
    buildColorLegend([region, region], rowIndexByValue, [undefined, undefined]),
  ).toHaveLength(2)
})

test('rows with a per-row color override contribute nothing', () => {
  expect(
    buildColorLegend([region], rowIndexByValue, [0xff123456, undefined]),
  ).toEqual([
    { label: 'Quies', values: ['Quies'], color: 0xff00ff00 },
    { label: 'TssA', values: ['TssA'], color: 0xff0000ff },
  ])
  expect(
    buildColorLegend([region], rowIndexByValue, [0xff123456, 0xff654321]),
  ).toEqual([])
})

test('a category only an overridden row carries is left out', () => {
  const withRowOnly = regionData({
    ...region,
    featureNames: ['TssA', 'TssA', 'Quies', 'Enh'],
    featureColors: Uint32Array.from([
      0xff0000ff, 0xff0000ff, 0xff00ff00, 0xffabcdef,
    ]),
  })
  expect(
    buildColorLegend([withRowOnly], rowIndexByValue, [0xff123456, undefined]),
  ).toEqual([
    { label: 'Enh', values: ['Enh'], color: 0xffabcdef },
    { label: 'Quies', values: ['Quies'], color: 0xff00ff00 },
  ])
})

test('a painting in one color has no key', () => {
  const oneColor = regionData({
    ...region,
    featureColors: new Uint32Array(4).fill(0xff0000ff),
    featureNames: ['seg1', 'seg2', 'seg3', 'seg4'],
  })
  expect(
    buildColorLegend([oneColor], rowIndexByValue, [undefined, undefined]),
  ).toEqual([])
})

test('all rows overridden reads no regions at all', () => {
  // a generator body does not run until its first `next()`, so an unconsumed
  // one is the assertion that the region walk was skipped
  let consumed = false
  function* regions() {
    consumed = true
    yield region
  }
  expect(
    buildColorLegend(regions(), rowIndexByValue, [0xff123456, 0xff654321]),
  ).toEqual([])
  expect(consumed).toBe(false)
})

test('two names sharing a color are one row naming both', () => {
  const shared = regionData({
    ...region,
    featureNames: ['TssA', 'TssAFlnk', 'TssA', 'Quies'],
    featureColors: Uint32Array.from([
      0xff0000ff, 0xff0000ff, 0xff0000ff, 0xff00ff00,
    ]),
  })
  expect(
    buildColorLegend([shared], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'Quies', values: ['Quies'], color: 0xff00ff00 },
    {
      label: 'TssA, TssAFlnk',
      values: ['TssA', 'TssAFlnk'],
      color: 0xff0000ff,
    },
  ])
})

// Hiding is by name: a scroll that brings TssAFlnk into TssA's color, in
// either order, renames the row but must not unhide TssA.
test('a hidden name stays hidden when another joins its color', () => {
  const later = regionData({
    ...region,
    featureNames: ['TssAFlnk', 'Quies', 'TssA', 'Quies'],
  })
  const [, row] = buildColorLegend([later], rowIndexByValue, [
    undefined,
    undefined,
  ])
  expect(row).toEqual({
    label: 'TssA, TssAFlnk',
    values: ['TssA', 'TssAFlnk'],
    color: 0xff0000ff,
  })
  expect(entryHidden(row!, new Set(['TssA']))).toBe(true)
})

test('a name reused across two colors keeps its first-seen color', () => {
  const reused = regionData({
    ...region,
    featureNames: ['TssA', 'Quies', 'TssA', 'Quies'],
    featureColors: Uint32Array.from([
      0xff0000ff, 0xff00ff00, 0xffabcdef, 0xff00ff00,
    ]),
  })
  expect(
    buildColorLegend([reused], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'Quies', values: ['Quies'], color: 0xff00ff00 },
    { label: 'TssA', values: ['TssA'], color: 0xff0000ff },
  ])
})

test('a second name on a color still carries it when the first is taken', () => {
  const masked = regionData({
    ...region,
    featureNames: ['TssA', 'TssA', 'TssA', 'Quies'],
    featurePartitionIndex: Uint32Array.from([0, 1, 1, 1]),
    featureColors: Uint32Array.from([
      0xff0000ff, 0xff00ff00, 0xff00ff00, 0xff00ff00,
    ]),
  })
  expect(
    buildColorLegend([masked], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'Quies', values: ['Quies'], color: 0xff00ff00 },
    { label: 'TssA', values: ['TssA'], color: 0xff0000ff },
  ])
})

test('unnamed features produce no legend', () => {
  const unnamed = regionData({ ...region, featureNames: ['', '', '', ''] })
  expect(unnamed.legendCandidates).toEqual([])
  expect(
    buildColorLegend([unnamed], rowIndexByValue, [undefined, undefined]),
  ).toEqual([])
})

test('configured legend converts CSS colors to ABGR, drops malformed', () => {
  expect(
    resolveConfiguredLegend([
      { label: 'Maternal', color: 'rgb(227,26,28)' },
      { label: 'Paternal', color: 'rgb(31,120,180)' },
    ]),
  ).toEqual([
    { label: 'Maternal', values: ['Maternal'], color: 0xff1c1ae3 },
    { label: 'Paternal', values: ['Paternal'], color: 0xffb4781f },
  ])
})

test('configured legend dedupes repeated labels first-seen', () => {
  expect(
    resolveConfiguredLegend([
      { label: 'Maternal', color: 'rgb(227,26,28)' },
      { label: 'Maternal', color: 'rgb(31,120,180)' },
    ]),
  ).toEqual([{ label: 'Maternal', values: ['Maternal'], color: 0xff1c1ae3 }])
})

test('configured legend dedupes repeated colors first-seen', () => {
  expect(
    resolveConfiguredLegend([
      { label: 'Maternal', color: 'rgb(227,26,28)' },
      { label: 'Untransmitted', color: 'rgb(227,26,28)' },
    ]),
  ).toEqual([{ label: 'Maternal', values: ['Maternal'], color: 0xff1c1ae3 }])
})

function statesRegion(n: number) {
  return regionData({
    featureStarts: Uint32Array.from({ length: n }, (_, i) => i * 10),
    featureEnds: Uint32Array.from({ length: n }, (_, i) => i * 10 + 5),
    featureColors: Uint32Array.from({ length: n }, (_, i) => 0xff000000 + i),
    partitionValues: ['E001'],
    featurePartitionIndex: new Uint32Array(n),
    featureNames: Array.from({ length: n }, (_, i) => `state${i}`),
    featureIds: Array.from({ length: n }, (_, i) => `f${i}`),
    featureDeltas: new Int32Array(0),
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    resolvedPartitionField: 'name',
  })
}

test("a 25-state chromHMM model's key lists every state", () => {
  expect(
    buildColorLegend([statesRegion(25)], new Map([['E001', 0]]), [undefined]),
  ).toHaveLength(25)
})

test('too many distinct labels is treated as non-categorical', () => {
  const n = 40
  const many = regionData({
    featureStarts: Uint32Array.from({ length: n }, (_, i) => i * 10),
    featureEnds: Uint32Array.from({ length: n }, (_, i) => i * 10 + 5),
    featureColors: Uint32Array.from({ length: n }, (_, i) => 0xff000000 + i),
    partitionValues: ['E001'],
    featurePartitionIndex: new Uint32Array(n),
    featureNames: Array.from({ length: n }, (_, i) => `gene${i}`),
    featureIds: Array.from({ length: n }, (_, i) => `f${i}`),
    featureDeltas: new Int32Array(0),
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    resolvedPartitionField: 'name',
  })
  expect(buildColorLegend([many], new Map([['E001', 0]]), [undefined])).toEqual(
    [],
  )
})

test('a candidate list truncated at the cap still reads non-categorical', () => {
  const n = 5000
  const capped = regionData({
    featureStarts: Uint32Array.from({ length: n }, (_, i) => i * 10),
    featureEnds: Uint32Array.from({ length: n }, (_, i) => i * 10 + 5),
    featureColors: Uint32Array.from({ length: n }, (_, i) => 0xff000000 + i),
    partitionValues: ['E001'],
    featurePartitionIndex: new Uint32Array(n),
    featureNames: Array.from({ length: n }, (_, i) => `gene${i}`),
    featureIds: Array.from({ length: n }, (_, i) => `f${i}`),
    featureDeltas: new Int32Array(0),
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    resolvedPartitionField: 'name',
  })
  expect(capped.legendCandidates.length).toBeLessThan(n)
  expect(
    buildColorLegend([capped], new Map([['E001', 0]]), [undefined]),
  ).toEqual([])
})
