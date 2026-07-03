import { MIN_FIT_ROWS, fitGroupMaxRows } from './groupLayout.ts'

test('fitGroupMaxRows: splits the post-overhead height evenly across groups', () => {
  // 1000px height, 2 groups, 50px overhead each => (1000 - 100)/2 = 450px per
  // group / 10px rows = 45 rows.
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 2,
      visibleGroupCount: 2,
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
      visibleGroupCount: 2,
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
      visibleGroupCount: 8,
      rowHeight: 10,
      overhead: 45,
      maxRows: 1000,
    }),
  ).toBe(MIN_FIT_ROWS)
})

test('fitGroupMaxRows: a collapsed group hands its pileup slice to the rest', () => {
  // 3 groups all reserve 50px overhead (collapsed ones still show coverage), so
  // 1000 - 150 = 850px of pileup budget. With one group collapsed it divides
  // across the 2 still drawing => 425px / 10px = 42 rows (vs 283 -> 28 when all
  // three share it).
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 3,
      visibleGroupCount: 3,
      rowHeight: 10,
      overhead: 50,
      maxRows: 1000,
    }),
  ).toBe(28)
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 3,
      visibleGroupCount: 2,
      rowHeight: 10,
      overhead: 50,
      maxRows: 1000,
    }),
  ).toBe(42)
})

test('fitGroupMaxRows: all groups collapsed never divides by zero', () => {
  // No pileup is drawn, so the cap is irrelevant, but the math must stay finite.
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 3,
      visibleGroupCount: 0,
      rowHeight: 10,
      overhead: 50,
      maxRows: 60,
    }),
  ).toBe(60)
})
