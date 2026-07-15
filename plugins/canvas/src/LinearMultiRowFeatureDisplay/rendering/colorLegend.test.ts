import { buildColorLegend, resolveConfiguredLegend } from './colorLegend.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

// chromHMM-style: two states painted by name on two rows, colored per feature.
const region: MultiRowRegionData = {
  featureStarts: Uint32Array.from([10, 20, 30, 40]),
  featureEnds: Uint32Array.from([15, 25, 35, 45]),
  featureColors: Uint32Array.from([
    0xff0000ff, 0xff00ff00, 0xff0000ff, 0xff00ff00,
  ]),
  partitionValues: ['E001', 'E002'],
  featurePartitionIndex: Uint32Array.from([0, 0, 1, 1]),
  featureNames: ['TssA', 'Quies', 'TssA', 'Quies'],
  featureIds: ['f1', 'f2', 'f3', 'f4'],
}

const rowIndexByValue = new Map([
  ['E001', 0],
  ['E002', 1],
])

test('distinct (name -> color) pairs, first-seen order', () => {
  expect(
    buildColorLegend([region], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'TssA', color: 0xff0000ff },
    { label: 'Quies', color: 0xff00ff00 },
  ])
})

test('rows with a per-row color override contribute nothing', () => {
  // row 0 overridden -> only row 1 (E002) features count
  expect(
    buildColorLegend([region], rowIndexByValue, [0xff123456, undefined]),
  ).toEqual([
    { label: 'TssA', color: 0xff0000ff },
    { label: 'Quies', color: 0xff00ff00 },
  ])
  // both rows overridden -> empty (per-row mode, sidebar is the legend)
  expect(
    buildColorLegend([region], rowIndexByValue, [0xff123456, 0xff654321]),
  ).toEqual([])
})

test('two names sharing a color collapse to one first-seen entry', () => {
  // TssA and TssAFlnk both painted red -> a single red row (keyed by color, so
  // one legend swatch and one toggle covers both)
  const shared: MultiRowRegionData = {
    ...region,
    featureNames: ['TssA', 'TssAFlnk', 'TssA', 'Quies'],
    featureColors: Uint32Array.from([
      0xff0000ff, 0xff0000ff, 0xff0000ff, 0xff00ff00,
    ]),
  }
  expect(
    buildColorLegend([shared], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'TssA', color: 0xff0000ff },
    { label: 'Quies', color: 0xff00ff00 },
  ])
})

test('a name reused across two colors keeps its first-seen color', () => {
  const reused: MultiRowRegionData = {
    ...region,
    featureNames: ['TssA', 'Quies', 'TssA', 'Quies'],
    featureColors: Uint32Array.from([
      0xff0000ff, 0xff00ff00, 0xffabcdef, 0xff00ff00,
    ]),
  }
  expect(
    buildColorLegend([reused], rowIndexByValue, [undefined, undefined]),
  ).toEqual([
    { label: 'TssA', color: 0xff0000ff },
    { label: 'Quies', color: 0xff00ff00 },
  ])
})

test('unnamed features produce no legend', () => {
  const unnamed = { ...region, featureNames: ['', '', '', ''] }
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
    { label: 'Maternal', color: 0xff1c1ae3 },
    { label: 'Paternal', color: 0xffb4781f },
  ])
})

test('configured legend dedupes repeated labels first-seen', () => {
  expect(
    resolveConfiguredLegend([
      { label: 'Maternal', color: 'rgb(227,26,28)' },
      { label: 'Maternal', color: 'rgb(31,120,180)' },
    ]),
  ).toEqual([{ label: 'Maternal', color: 0xff1c1ae3 }])
})

test('too many distinct labels is treated as non-categorical', () => {
  const n = 40
  const many: MultiRowRegionData = {
    featureStarts: Uint32Array.from({ length: n }, (_, i) => i * 10),
    featureEnds: Uint32Array.from({ length: n }, (_, i) => i * 10 + 5),
    featureColors: Uint32Array.from({ length: n }, (_, i) => 0xff000000 + i),
    partitionValues: ['E001'],
    featurePartitionIndex: new Uint32Array(n),
    featureNames: Array.from({ length: n }, (_, i) => `gene${i}`),
    featureIds: Array.from({ length: n }, (_, i) => `f${i}`),
  }
  expect(buildColorLegend([many], new Map([['E001', 0]]), [undefined])).toEqual(
    [],
  )
})
