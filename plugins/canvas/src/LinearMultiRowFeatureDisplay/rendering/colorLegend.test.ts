import { buildColorLegend } from './colorLegend.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

// chromHMM-style: two states painted by name on two rows, colored per feature.
const region: MultiRowRegionData = {
  featureStarts: Uint32Array.from([10, 20, 30, 40]),
  featureEnds: Uint32Array.from([15, 25, 35, 45]),
  featureColors: Uint32Array.from([0xff0000ff, 0xff00ff00, 0xff0000ff, 0xff00ff00]),
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
  expect(buildColorLegend([region], rowIndexByValue, [undefined, undefined])).toEqual([
    { label: 'TssA', color: 0xff0000ff },
    { label: 'Quies', color: 0xff00ff00 },
  ])
})

test('rows with a per-row color override contribute nothing', () => {
  // row 0 overridden -> only row 1 (E002) features count
  expect(buildColorLegend([region], rowIndexByValue, [0xff123456, undefined])).toEqual([
    { label: 'TssA', color: 0xff0000ff },
    { label: 'Quies', color: 0xff00ff00 },
  ])
  // both rows overridden -> empty (per-row mode, sidebar is the legend)
  expect(buildColorLegend([region], rowIndexByValue, [0xff123456, 0xff654321])).toEqual([])
})

test('unnamed features produce no legend', () => {
  const unnamed = { ...region, featureNames: ['', '', '', ''] }
  expect(buildColorLegend([unnamed], rowIndexByValue, [undefined, undefined])).toEqual([])
})

test('too many distinct labels is treated as non-categorical', () => {
  const n = 40
  const many: MultiRowRegionData = {
    featureStarts: Uint32Array.from({ length: n }, (_, i) => i * 10),
    featureEnds: Uint32Array.from({ length: n }, (_, i) => i * 10 + 5),
    featureColors: Uint32Array.from({ length: n }, () => 0xff0000ff),
    partitionValues: ['E001'],
    featurePartitionIndex: new Uint32Array(n),
    featureNames: Array.from({ length: n }, (_, i) => `gene${i}`),
    featureIds: Array.from({ length: n }, (_, i) => `f${i}`),
  }
  expect(buildColorLegend([many], new Map([['E001', 0]]), [undefined])).toEqual([])
})
