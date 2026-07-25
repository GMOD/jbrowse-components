import { planRowRemoval } from './importFormRows.ts'

test('removing a middle row drops the pair below it', () => {
  expect(
    planRowRemoval({ rowCount: 4, removedRow: 1, selectedPair: 0 }),
  ).toEqual({ removedPair: 1, nextSelectedPair: 0 })
})

test('removing the last row drops the pair above it', () => {
  expect(
    planRowRemoval({ rowCount: 4, removedRow: 3, selectedPair: 0 }),
  ).toEqual({ removedPair: 2, nextSelectedPair: 0 })
})

test('a removal above the selected pair shifts it down to follow the pair', () => {
  expect(
    planRowRemoval({ rowCount: 5, removedRow: 0, selectedPair: 2 }),
  ).toEqual({ removedPair: 0, nextSelectedPair: 1 })
})

test('a removal below the selected pair leaves it alone', () => {
  expect(
    planRowRemoval({ rowCount: 5, removedRow: 3, selectedPair: 0 }),
  ).toEqual({ removedPair: 3, nextSelectedPair: 0 })
})

test('the selected pair clamps to the last surviving pair', () => {
  expect(
    planRowRemoval({ rowCount: 4, removedRow: 3, selectedPair: 2 }),
  ).toEqual({ removedPair: 2, nextSelectedPair: 1 })
})

test('dropping to a single row clamps both to 0 rather than going negative', () => {
  expect(
    planRowRemoval({ rowCount: 2, removedRow: 1, selectedPair: 0 }),
  ).toEqual({ removedPair: 0, nextSelectedPair: 0 })
})
