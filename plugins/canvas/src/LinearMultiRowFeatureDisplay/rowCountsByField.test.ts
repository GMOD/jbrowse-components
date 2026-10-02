import { MAX_COUNTED_ROW_VALUES } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { rowCountHint, rowCountsByField } from './rowsFields.ts'

import type { RowsFieldCandidateValues } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function region(rowsFieldCandidateValues: RowsFieldCandidateValues[]) {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    rowValues: [],
    featureRowValueIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    rowsFieldCandidates: rowsFieldCandidateValues.map(c => c.field),
    rowsFieldCandidateValues,
    legendCandidates: [],
    resolvedRowsField: 'name',
  } satisfies MultiRowRegionData
}

function slice(...regions: MultiRowRegionData[]) {
  return { rpcDataMap: new Map(regions.map((r, i) => [i, r])) }
}

test('unions the values across loaded regions', () => {
  const counts = rowCountsByField(
    slice(
      region([
        { field: 'repClass', values: ['LINE', 'SINE'], overflow: false },
      ]),
      region([{ field: 'repClass', values: ['SINE', 'LTR'], overflow: false }]),
    ),
  )
  expect(counts.get('repClass')).toEqual({ count: 3, overflow: false })
})

test('one overflowing region makes the union an overflow', () => {
  const counts = rowCountsByField(
    slice(
      region([{ field: 'name', values: ['a'], overflow: false }]),
      region([{ field: 'name', values: [], overflow: true }]),
    ),
  )
  expect(counts.get('name')?.overflow).toBe(true)
})

test('a union past the cap is an overflow too', () => {
  const half = Array.from({ length: MAX_COUNTED_ROW_VALUES }, (_, i) =>
    String(i),
  )
  const other = half.map(v => `x${v}`)
  const counts = rowCountsByField(
    slice(
      region([{ field: 'name', values: half, overflow: false }]),
      region([{ field: 'name', values: other, overflow: false }]),
    ),
  )
  expect(counts.get('name')?.overflow).toBe(true)
})

test('the hint spells the three shapes a count takes', () => {
  expect(rowCountHint(undefined)).toBeUndefined()
  expect(rowCountHint({ count: 1, overflow: false })).toBe('1 row')
  expect(rowCountHint({ count: 21, overflow: false })).toBe('21 rows')
  expect(rowCountHint({ count: 200, overflow: true })).toBe(
    `${MAX_COUNTED_ROW_VALUES}+ rows`,
  )
})
