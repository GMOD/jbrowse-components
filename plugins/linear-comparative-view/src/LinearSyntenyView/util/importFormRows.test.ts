import {
  pairIndexAfterRowRemoval,
  reversedPairIndex,
} from './importFormRows.ts'

test('a removal above the selected pair shifts it down to follow the pair', () => {
  expect(
    pairIndexAfterRowRemoval({ rowCount: 5, removedRow: 0, selectedPair: 2 }),
  ).toBe(1)
})

test('a removal below the selected pair leaves it alone', () => {
  expect(
    pairIndexAfterRowRemoval({ rowCount: 5, removedRow: 3, selectedPair: 0 }),
  ).toBe(0)
})

test('the selected pair clamps to the last surviving pair', () => {
  expect(
    pairIndexAfterRowRemoval({ rowCount: 4, removedRow: 3, selectedPair: 2 }),
  ).toBe(1)
})

test('dropping to a single row clamps to 0 rather than going negative', () => {
  expect(
    pairIndexAfterRowRemoval({ rowCount: 2, removedRow: 1, selectedPair: 0 }),
  ).toBe(0)
})

test('reversing maps a pair to the same two rows counted from the other end', () => {
  // 5 rows, 4 pairs: pair 0 (rows 1-2) becomes pair 3 (rows 4-5)
  expect(reversedPairIndex({ rowCount: 5, selectedPair: 0 })).toBe(3)
  expect(reversedPairIndex({ rowCount: 5, selectedPair: 3 })).toBe(0)
  // the middle pair of an odd count is its own mirror
  expect(reversedPairIndex({ rowCount: 4, selectedPair: 1 })).toBe(1)
})

test('reversing a two-row stack keeps the only pair there is', () => {
  expect(reversedPairIndex({ rowCount: 2, selectedPair: 0 })).toBe(0)
})
