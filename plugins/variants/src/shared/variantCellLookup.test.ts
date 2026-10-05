import { findCellIndex } from './variantCellLookup.ts'

import type { CellLookupData } from './variantCellLookup.ts'

// Cells are declared in their final (post-bucketing) order, so the ordering the
// binary search depends on is visible in the fixture rather than recomputed here.
// computeVariantCells.test.ts is what pins that the worker really produces it.
function cells(
  refBucket: [feature: number, row: number][],
  nonRefBucket: [feature: number, row: number][],
): CellLookupData {
  const all = [...refBucket, ...nonRefBucket]
  return {
    cellFeatureIndices: Uint32Array.from(all.map(c => c[0])),
    cellWorkerRowIndices: Uint32Array.from(all.map(c => c[1])),
    numCells: all.length,
    refCellCount: refBucket.length,
  }
}

describe('findCellIndex', () => {
  // Two sites, three samples. Site 0: S0 ref, S1 alt, S2 alt. Site 1: S0 alt,
  // S2 ref — S1 has no call at site 1, so no cell exists there at all.
  const data = cells(
    [
      [0, 0],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 0],
    ],
  )

  test('finds a cell in the reference bucket', () => {
    expect(findCellIndex(data, 0, 0)).toBe(0)
    expect(findCellIndex(data, 1, 2)).toBe(1)
  })

  test('finds a cell in the non-reference bucket', () => {
    expect(findCellIndex(data, 0, 1)).toBe(2)
    expect(findCellIndex(data, 0, 2)).toBe(3)
    expect(findCellIndex(data, 1, 0)).toBe(4)
  })

  test('reports -1 where the sample has no genotype at that site', () => {
    expect(findCellIndex(data, 1, 1)).toBe(-1)
  })

  test('reports -1 for a row past the last sample', () => {
    expect(findCellIndex(data, 0, 3)).toBe(-1)
  })

  test('reports -1 for a feature index with no cells', () => {
    expect(findCellIndex(data, 2, 0)).toBe(-1)
  })

  test('handles an empty reference bucket (referenceDrawingMode skip)', () => {
    const skipRef = cells(
      [],
      [
        [0, 1],
        [0, 2],
      ],
    )
    expect(findCellIndex(skipRef, 0, 1)).toBe(0)
    // the hom-ref cell was never emitted, so hovering it finds nothing
    expect(findCellIndex(skipRef, 0, 0)).toBe(-1)
  })

  test('handles no cells at all', () => {
    expect(findCellIndex(cells([], []), 0, 0)).toBe(-1)
  })
})
