import { drawnRowHeightPx } from '@jbrowse/render-core/shaders/rowRect'
import { MIN_DRAWN_ROW_PX } from '@jbrowse/render-core/shaders/rowRectConsts'

import { rowBand } from './rowBand.ts'

function retiredRowBand(rowHeight: number, rowProportion: number) {
  const height = Math.max(rowHeight * rowProportion, 1)
  return { height, offset: (rowHeight - height) / 2 }
}

test('the generated band matches the hand-written twin it replaced', () => {
  for (const rowHeight of [0, 0.1, 0.25, 0.5, 0.99, 1, 1.5, 4, 20, 100]) {
    for (const rowProportion of [0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(rowBand(rowHeight, rowProportion)).toStrictEqual(
        retiredRowBand(rowHeight, rowProportion),
      )
    }
  }
})

test('a row taller than a pixel is its own proportion of the row', () => {
  expect(rowBand(20, 1)).toEqual({ height: 20, offset: 0 })
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
  // 2000 rows into 500px keeps the row pitch sub-pixel
  const rowHeight = 500 / 2000
  const { offset } = rowBand(rowHeight, 1)
  expect(offset + rowHeight * 1999 + rowHeight).toBeLessThanOrEqual(500)
})

test('the floor applies after rowProportion, so a gutter cannot erase a row', () => {
  expect(drawnRowHeightPx(0.4, 0.5)).toBe(MIN_DRAWN_ROW_PX)
  expect(drawnRowHeightPx(4, 0.5)).toBe(2)
})
