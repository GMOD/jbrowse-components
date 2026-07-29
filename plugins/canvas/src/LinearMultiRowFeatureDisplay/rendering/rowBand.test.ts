import { MIN_DRAWN_ROW_PX, drawnRowHeight, rowBand } from './rowBand.ts'

// These pin the geometry rowRect.slang's `rowBandPx` mirrors. The shader can't
// import this module, so the two agree by review; a change here that isn't made
// there shows up as blocks painted somewhere other than where they hit-test.

test('a row taller than a pixel is its own proportion of the row', () => {
  expect(rowBand(20, 1)).toEqual({ height: 20, offset: 0 })
  // proportion below 1 leaves an even gutter above and below
  expect(rowBand(20, 0.5)).toEqual({ height: 10, offset: 5 })
})

test('a sub-pixel row is painted at the floor, centered on its row', () => {
  const rowHeight = 0.25
  const { height, offset } = rowBand(rowHeight, 1)
  expect(height).toBe(MIN_DRAWN_ROW_PX)
  // negative: the band overhangs evenly rather than pushing rows down
  expect(offset).toBe((rowHeight - MIN_DRAWN_ROW_PX) / 2)
  expect(offset + height / 2).toBeCloseTo(rowHeight / 2)
})

test('flooring the band does not change where rows start', () => {
  // 2000 rows into 500px: the row pitch stays sub-pixel, so the last row still
  // lands inside the display even though each is painted a pixel tall
  const rowHeight = 500 / 2000
  const { offset } = rowBand(rowHeight, 1)
  expect(offset + rowHeight * 1999 + rowHeight).toBeLessThanOrEqual(500)
})

test('the floor applies after rowProportion, so a gutter cannot erase a row', () => {
  expect(drawnRowHeight(0.4, 0.5)).toBe(MIN_DRAWN_ROW_PX)
  expect(drawnRowHeight(4, 0.5)).toBe(2)
})
