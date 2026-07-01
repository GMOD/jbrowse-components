import { getInsertSizeStats } from './insertSizeStats.ts'

test('basic mean/sd', () => {
  const { avg, sd } = getInsertSizeStats([2, 4, 4, 4, 5, 5, 7, 9])
  expect(avg).toBe(5)
  expect(sd).toBeCloseTo(2, 10)
})

test('identical values give zero sd (no NaN from float cancellation)', () => {
  const { avg, sd, upper, lower } = getInsertSizeStats(
    new Array(1000).fill(500),
  )
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

// MAD = 0 (over half the values identical) is degenerate, so the spread falls
// back to mean ± 3·sd, whose lower bound clamps at 0.
test('lower bound clamps at 0 when spread degenerates to mean/sd', () => {
  const { lower } = getInsertSizeStats([10, 10, 1000])
  expect(lower).toBe(0)
})

// Real insert-size distributions are a tight bulk plus a long right tail of
// large inserts (deletions/SVs). That tail inflates sd, so the old
// mean − 3·sd lower bound clamps to 0 and hides every short insert. The robust
// median − 3·1.4826·MAD bound measures the bulk and stays positive.
test('skewed distribution keeps a positive short-insert threshold', () => {
  const bulk = Array.from({ length: 1000 }, (_, i) => 400 + (i % 201)) // ~500±100
  const tail = Array.from({ length: 40 }, () => 50_000) // large-insert outliers
  const { lower, upper } = getInsertSizeStats([...bulk, ...tail])
  expect(lower).toBeGreaterThan(0)
  expect(150).toBeLessThan(lower) // a clearly-short insert is flagged (pink)
  expect(500).toBeGreaterThan(lower) // a bulk-normal insert is not
  expect(500).toBeLessThan(upper)
  expect(50_000).toBeGreaterThan(upper) // the large outliers are flagged long
})

// The old single-pass form (len*Σx² − (Σx)²)/len² overflows 2^53 and loses
// precision at high coverage with large inserts, yielding NaN sd. The
// two-pass form stays finite and accurate. Thresholds use the robust
// median ± 3·1.4826·MAD spread (MAD = 1000 here).
test('high coverage with large inserts stays finite and accurate', () => {
  const n = 200_000
  const values = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    // alternate around a large mean so true sd (and MAD) is a clean 1000
    values[i] = i % 2 === 0 ? 1_000_000 - 1000 : 1_000_000 + 1000
  }
  const { avg, sd, upper, lower } = getInsertSizeStats(values)
  expect(Number.isFinite(sd)).toBe(true)
  expect(Number.isNaN(sd)).toBe(false)
  expect(avg).toBeCloseTo(1_000_000, 3)
  expect(sd).toBeCloseTo(1000, 6)
  expect(upper).toBeCloseTo(1_004_447.8, 1)
  expect(lower).toBeCloseTo(995_552.2, 1)
})
