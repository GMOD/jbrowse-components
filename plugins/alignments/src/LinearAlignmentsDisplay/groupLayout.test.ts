import { MIN_FIT_ROWS, fitGroupMaxRows } from './groupLayout.ts'

test('fitGroupMaxRows: splits the post-overhead height evenly across groups', () => {
  // 1000px height, 2 groups, 50px overhead each => (1000 - 100)/2 = 450px per
  // group / 10px rows = 45 rows.
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 2,
      rowHeight: 10,
      overhead: 50,
      maxRows: 1000,
    }),
  ).toBe(45)
})

test('fitGroupMaxRows: never exceeds the display-wide cap', () => {
  expect(
    fitGroupMaxRows({
      height: 100000,
      groupCount: 2,
      rowHeight: 10,
      overhead: 0,
      maxRows: 30,
    }),
  ).toBe(30)
})

test('fitGroupMaxRows: floors to MIN_FIT_ROWS when the slice is tiny', () => {
  // Many groups / small viewport => slice goes negative; floor keeps a few rows
  // (the stack then overflows and scrolls).
  expect(
    fitGroupMaxRows({
      height: 200,
      groupCount: 8,
      rowHeight: 10,
      overhead: 45,
      maxRows: 1000,
    }),
  ).toBe(MIN_FIT_ROWS)
})
