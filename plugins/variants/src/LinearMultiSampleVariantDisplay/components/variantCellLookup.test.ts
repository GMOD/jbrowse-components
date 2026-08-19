import {
  contentSampleY,
  findCellIndex,
  rowsUnderCursor,
} from './variantCellLookup.ts'

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

// the argument is a pixel CENTRE, so these read `Y + 0.5` throughout
describe('rowsUnderCursor', () => {
  test('a normal row height resolves to exactly one row', () => {
    expect(rowsUnderCursor(25.5, 10)).toEqual({ nearest: 2, lowest: 2 })
    expect(rowsUnderCursor(0.5, 10)).toEqual({ nearest: 0, lowest: 0 })
    // Y 30 is the first pixel of row 3, not the last of row 2.
    expect(rowsUnderCursor(30.5, 10)).toEqual({ nearest: 3, lowest: 3 })
  })

  test('a row exactly 2px tall still resolves to one row', () => {
    expect(rowsUnderCursor(5.5, 2)).toEqual({ nearest: 2, lowest: 2 })
  })

  test('sub-pixel rows stack a band under one drawn pixel', () => {
    // rowHeight 0.5 draws at the 2px floor, so a row r covers [0.5r, 0.5r + 2).
    // Pixel 25 was filled from its centre, 25.5, which rows 48..51 cover —
    // answering at 25.0 named 47..50 and picked the row below the drawn one.
    expect(rowsUnderCursor(25.5, 0.5)).toEqual({ nearest: 51, lowest: 48 })
  })

  test('the band never runs off the top of the content', () => {
    expect(rowsUnderCursor(1.5, 0.5)).toEqual({ nearest: 3, lowest: 0 })
    expect(rowsUnderCursor(0.5, 0.5)).toEqual({ nearest: 1, lowest: 0 })
  })
})

describe('contentSampleY', () => {
  test('is the centre of the pixel the cursor is in', () => {
    expect(contentSampleY(25, 0)).toBe(25.5)
    expect(contentSampleY(25.9, 0)).toBe(25.5)
  })

  // the canvas draws at `row*rowHeight - scrollTop` with scrollTop unrounded —
  // applyRowResizeWheel sets it to `rowUnderMouse * newRowHeight - mouseY` — so
  // flooring the SUM snaps to a pixel grid the content is not on
  test('adds a fractional scrollTop after the floor, not before', () => {
    expect(contentSampleY(25, 3.4)).toBe(28.9)
    expect(Math.floor(25 + 3.4) + 0.5).toBe(28.5)
  })
})
