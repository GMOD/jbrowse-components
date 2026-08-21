import {
  contentYAt,
  rowIndexAt,
  rowSpanAt,
  rowsUnderPointer,
} from './rowStackGeometry.ts'

describe('contentYAt', () => {
  it('samples the centre of the pixel the cursor is in', () => {
    expect(contentYAt(25, { rowHeight: 10 })).toBe(25.5)
    expect(contentYAt(25.9, { rowHeight: 10 })).toBe(25.5)
  })

  // applyRowResizeWheel sets scrollTop to `rowUnderMouse * newRowHeight -
  // mouseY`, so it is routinely fractional. Flooring the sum instead snaps to a
  // grid the content is not drawn on: floor(25 + 3.4) + 0.5 would be 28.5.
  it('floors mouseY before adding a fractional scrollTop', () => {
    expect(contentYAt(25, { rowHeight: 10, scrollTop: 3.4 })).toBe(28.9)
  })

  it('subtracts the chrome above the rows area', () => {
    expect(contentYAt(57, { rowHeight: 12, topOffset: 45 })).toBe(12.5)
  })
})

describe('rowIndexAt', () => {
  it('resolves a row at an ordinary height', () => {
    expect(rowIndexAt(25, { rowHeight: 10 })).toBe(2)
  })

  // 1000 Genomes: 2,504 samples over the 230px left under the line zone. The
  // half pixel alone is 5.4 rows, so the top-edge answer names another sample.
  it('is 5 rows off the top-edge answer on a 2,504-sample fit', () => {
    const stack = { rowHeight: 230 / 2504 }
    expect(rowIndexAt(100, stack)).toBe(1094)
    expect(Math.floor(100 / stack.rowHeight)).toBe(1088)
  })
})

describe('rowSpanAt', () => {
  it('covers the row a horizontal drag sits on', () => {
    const stack = { rowHeight: 12, topOffset: 45 }
    // y=57 is exactly the row 1 boundary: ceil(rowCoord) would collapse it
    expect(rowSpanAt(57, 57, stack)).toEqual({ startRow: 1, endRow: 2 })
    expect(rowSpanAt(69, 69, stack)).toEqual({ startRow: 2, endRow: 3 })
  })

  it('covers both ends of a multi-row drag', () => {
    const stack = { rowHeight: 12, topOffset: 45 }
    expect(rowSpanAt(57, 80, stack)).toEqual({ startRow: 1, endRow: 3 })
  })

  it('is direction-agnostic', () => {
    const stack = { rowHeight: 12, topOffset: 45 }
    expect(rowSpanAt(80, 57, stack)).toEqual(rowSpanAt(57, 80, stack))
  })

  it('clamps a drag that starts above the rows area', () => {
    const stack = { rowHeight: 12, topOffset: 45 }
    expect(rowSpanAt(10, 57, stack)).toEqual({ startRow: 0, endRow: 2 })
  })
})

describe('rowsUnderPointer', () => {
  // the caller passes the height its painter resolved, so above the floor this
  // is rowHeight itself and the band is one row
  it('collapses to one row once the row clears the drawn floor', () => {
    expect(rowsUnderPointer(25, { rowHeight: 10 }, 10)).toEqual({
      nearest: 2,
      lowest: 2,
    })
  })

  it('walks the rows sharing one drawn pixel when rows go sub-pixel', () => {
    expect(rowsUnderPointer(25, { rowHeight: 0.5 }, 2)).toEqual({
      nearest: 51,
      lowest: 48,
    })
  })

  it('does not walk below row 0', () => {
    expect(rowsUnderPointer(1, { rowHeight: 0.5 }, 2)).toEqual({
      nearest: 3,
      lowest: 0,
    })
  })

  // The matrix floors at 1px (variantMatrix.slang) where the sibling floors at
  // 2px (variant.slang), so the walk is each painter's own rule, not a constant.
  it('takes the floor from the caller', () => {
    const stack = { rowHeight: 0.25 }
    expect(rowsUnderPointer(10, stack, 1).lowest).toBe(39)
    expect(rowsUnderPointer(10, stack, 2).lowest).toBe(35)
  })

  it('applies scroll and offset like the point query', () => {
    const stack = { rowHeight: 10, scrollTop: 3.4, topOffset: 5 }
    expect(rowsUnderPointer(25, stack, 2).nearest).toBe(rowIndexAt(25, stack))
  })
})
