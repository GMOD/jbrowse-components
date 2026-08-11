import {
  ROW_SNAPSHOT_BUDGET,
  rowsExceedSnapshotBudget,
} from './snapshotBudget.ts'

const exact = (rowSet: unknown) =>
  JSON.stringify(rowSet).length > ROW_SNAPSHOT_BUDGET

function sheet(n: number, pad = '') {
  return {
    rows: Array.from({ length: n }, (_v, i) => ({
      feature: { uniqueId: `f${i}`, refName: 'chr1', start: i, end: i + 100 },
      cellData: { name: `value_${i}${pad}` },
    })),
  }
}

// The whole point of the bound is that it never disagrees with the exact
// measurement it replaces — being wrong high drops rows the user cannot get
// back, and wrong low overruns the localStorage quota
test('agrees with the exact measurement, over and under the budget', () => {
  const big = sheet(100_000)
  expect(exact(big)).toBe(true)
  expect(rowsExceedSnapshotBudget(big)).toBe(true)

  const small = sheet(200)
  expect(exact(small)).toBe(false)
  expect(rowsExceedSnapshotBudget(small)).toBe(false)
})

// near the threshold the short-circuit cannot fire, so this is the exact path
test('agrees near the threshold, where the bound cannot decide', () => {
  for (const n of [4000, 6000, 8000, 10_000, 12_000]) {
    const s = sheet(n)
    expect([n, rowsExceedSnapshotBudget(s)]).toEqual([n, exact(s)])
  }
})

// a sheet of few but enormous rows exceeds the budget on size, not row count
test('a short sheet of very wide rows still exceeds', () => {
  const wide = sheet(50, 'x'.repeat(40_000))
  expect(exact(wide)).toBe(true)
  expect(rowsExceedSnapshotBudget(wide)).toBe(true)
})

test('an empty or absent rowSet never exceeds', () => {
  expect(rowsExceedSnapshotBudget(undefined)).toBe(false)
  expect(rowsExceedSnapshotBudget({})).toBe(false)
  expect(rowsExceedSnapshotBudget({ rows: [] })).toBe(false)
})
