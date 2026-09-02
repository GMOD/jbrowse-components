import { MAX_COUNTED_PARTITION_VALUES } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { partitionRowCountHint, partitionRowCounts } from './partitionFields.ts'

import type { PartitionCandidateValues } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function region(partitionCandidateValues: PartitionCandidateValues[]) {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: [],
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    partitionCandidates: partitionCandidateValues.map(c => c.field),
    partitionCandidateValues,
    legendCandidates: [],
    resolvedPartitionField: 'name',
  } satisfies MultiRowRegionData
}

function slice(...regions: MultiRowRegionData[]) {
  return { rpcDataMap: new Map(regions.map((r, i) => [i, r])) }
}

// Two regions of one file each hold their own subset of the same classes, so
// the row count of the union is what a pick would actually draw.
// Two regions of one file each hold their own subset of the same classes, so
// the row count of the union is what a pick would actually draw.
test('unions the values across loaded regions', () => {
  const counts = partitionRowCounts(
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
  const counts = partitionRowCounts(
    slice(
      region([{ field: 'name', values: ['a'], overflow: false }]),
      region([{ field: 'name', values: [], overflow: true }]),
    ),
  )
  expect(counts.get('name')?.overflow).toBe(true)
})

test('a union past the cap is an overflow too', () => {
  const half = Array.from({ length: MAX_COUNTED_PARTITION_VALUES }, (_, i) =>
    String(i),
  )
  const other = half.map(v => `x${v}`)
  const counts = partitionRowCounts(
    slice(
      region([{ field: 'name', values: half, overflow: false }]),
      region([{ field: 'name', values: other, overflow: false }]),
    ),
  )
  expect(counts.get('name')?.overflow).toBe(true)
})

test('the hint spells the three shapes a count takes', () => {
  expect(partitionRowCountHint(undefined)).toBeUndefined()
  expect(partitionRowCountHint({ count: 1, overflow: false })).toBe('1 row')
  expect(partitionRowCountHint({ count: 21, overflow: false })).toBe('21 rows')
  expect(partitionRowCountHint({ count: 200, overflow: true })).toBe(
    `${MAX_COUNTED_PARTITION_VALUES}+ rows`,
  )
})
