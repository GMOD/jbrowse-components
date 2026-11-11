import {
  SPARSE_MIN_GAP_PX,
  leavesRoom,
  quartileGap,
  spanGaps,
} from './sparseSpans.ts'

test('the gaps between spans once overlapping and abutting ones merge, ascending', () => {
  expect(
    spanGaps([
      [300, 400],
      [0, 100],
      [100, 150],
      [120, 130],
      [200, 210],
    ]),
  ).toEqual([50, 90])
  expect(spanGaps([[0, 10]])).toEqual([])
  expect(spanGaps([])).toEqual([])
})

test('a row leaves room where its lower-quartile gap is at least the threshold on screen', () => {
  const gaps = [10, 20, 400, 400, 400]
  expect(quartileGap(gaps)).toBe(20)
  expect(leavesRoom(quartileGap(gaps), 20 / SPARSE_MIN_GAP_PX)).toBe(true)
  expect(leavesRoom(quartileGap(gaps), 20 / (SPARSE_MIN_GAP_PX - 1))).toBe(
    false,
  )
  expect(leavesRoom(undefined, 1)).toBe(false)
})
