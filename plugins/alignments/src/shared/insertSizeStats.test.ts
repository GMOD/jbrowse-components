import { getInsertSizeStats } from './insertSizeStats.ts'

test('basic mean/sd', () => {
  const { avg, sd } = getInsertSizeStats([2, 4, 4, 4, 5, 5, 7, 9])
  expect(avg).toBe(5)
  expect(sd).toBeCloseTo(2, 10)
})

test('identical values give zero sd (no NaN from float cancellation)', () => {
  const { avg, sd, upper, lower } = getInsertSizeStats(Array(1000).fill(500))
  expect(avg).toBe(500)
  expect(sd).toBe(0)
  expect(upper).toBe(500)
  expect(lower).toBe(500)
})

test('single element', () => {
  const { avg, sd } = getInsertSizeStats([350])
  expect(avg).toBe(350)
  expect(sd).toBe(0)
})

test('lower bound clamps at 0', () => {
  const { lower } = getInsertSizeStats([10, 10, 1000])
  expect(lower).toBe(0)
})

// The old single-pass form (len*Σx² − (Σx)²)/len² overflows 2^53 and loses
// precision at high coverage with large inserts, yielding NaN sd. The
// two-pass form stays finite and accurate.
test('high coverage with large inserts stays finite and accurate', () => {
  const n = 200_000
  const values = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    // alternate around a large mean so true sd is a clean 1000
    values[i] = i % 2 === 0 ? 1_000_000 - 1000 : 1_000_000 + 1000
  }
  const { avg, sd, upper, lower } = getInsertSizeStats(values)
  expect(Number.isFinite(sd)).toBe(true)
  expect(Number.isNaN(sd)).toBe(false)
  expect(avg).toBeCloseTo(1_000_000, 3)
  expect(sd).toBeCloseTo(1000, 6)
  expect(upper).toBeCloseTo(1_003_000, 3)
  expect(lower).toBeCloseTo(997_000, 3)
})
