import {
  drawnFeatureContext,
  drawnFeaturesByRow,
  findTopDrawnFeatureInRow,
} from './featurePainting.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

// `featureAt.test.ts` pins the behaviour this backs through the real model. This
// is the bucketing itself: the compressed-row layout is index arithmetic, and
// getting it wrong shows up as a hit on the wrong feature rather than as a
// throw.
function data(
  rowOf: number[],
  colors = rowOf.map(() => 0xff0000ff),
): Pick<
  MultiRowRegionData,
  | 'featureStarts'
  | 'featurePartitionIndex'
  | 'featureColors'
  | 'partitionValues'
> {
  const partitionValues = [...new Set(rowOf)].sort().map(r => `row${r}`)
  return {
    featureStarts: Uint32Array.from(rowOf, (_, i) => i),
    featurePartitionIndex: Uint32Array.from(rowOf, r =>
      partitionValues.indexOf(`row${r}`),
    ),
    featureColors: Uint32Array.from(colors),
    partitionValues,
  }
}

function context(rowCount: number, hiddenColors = new Set<number>()) {
  return {
    rowIndexByValue: new Map(
      Array.from({ length: rowCount }, (_, r) => [`row${r}`, r] as const),
    ),
    rowColorsByIndex: Array.from({ length: rowCount }, () => undefined),
    hiddenColors,
  }
}

function bucket(rowOf: number[], rowCount: number, hidden?: Set<number>) {
  const d = data(rowOf)
  const state = context(rowCount, hidden)
  return drawnFeaturesByRow(d, drawnFeatureContext(d, state), rowCount)
}

function rowsOf({ rowStart, indices }: ReturnType<typeof bucket>) {
  return [...rowStart.slice(0, -1)].map((lo, r) => [
    ...indices.subarray(lo, rowStart[r + 1]),
  ])
}

test('buckets each feature onto its display row, in paint order', () => {
  expect(rowsOf(bucket([2, 0, 1, 0, 2, 2], 3))).toEqual([
    [1, 3],
    [2],
    [0, 4, 5],
  ])
})

test('a row with nothing on it is an empty bucket, not a missing one', () => {
  expect(rowsOf(bucket([0, 0], 3))).toEqual([[0, 1], [], []])
})

// Same rule `forEachDrawnFeature` applies, and it has to be the same rule: a
// feature the painters skip must not be findable under the cursor.
test('leaves out features the paint pass drops', () => {
  const d = data([0, 1, 0], [0xff0000ff, 0xff00ff00, 0xff00ff00])
  const state = context(2, new Set([0xff00ff00]))
  const byRow = drawnFeaturesByRow(d, drawnFeatureContext(d, state), 2)
  expect(rowsOf(byRow)).toEqual([[0], []])
})

describe('findTopDrawnFeatureInRow', () => {
  test('resolves overlaps to the last-painted feature', () => {
    const byRow = bucket([0, 0, 0], 1)
    expect(findTopDrawnFeatureInRow(byRow, 0, () => true)).toBe(2)
    expect(findTopDrawnFeatureInRow(byRow, 0, i => i < 2)).toBe(1)
  })

  test('is -1 for no match, an empty row, and a row off the end', () => {
    const byRow = bucket([0, 0], 2)
    expect(findTopDrawnFeatureInRow(byRow, 0, () => false)).toBe(-1)
    expect(findTopDrawnFeatureInRow(byRow, 1, () => true)).toBe(-1)
    expect(findTopDrawnFeatureInRow(byRow, 9, () => true)).toBe(-1)
  })

  // The point of the bucketing: the search visits the row under the cursor, not
  // the region. Inline over `featureStarts` this was 300 predicate calls for a
  // row holding 100 features, on every rAF-coalesced mouse move.
  test('tests only the features on the row it was asked about', () => {
    const rowOf = Array.from({ length: 300 }, (_, i) => i % 3)
    const byRow = bucket(rowOf, 3)
    let tested = 0
    findTopDrawnFeatureInRow(byRow, 1, () => {
      tested++
      return false
    })
    expect(tested).toBe(100)
  })
})
