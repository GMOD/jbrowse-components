import { rowSpanIndex, spansInRow } from './rowSpanIndex.ts'

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function brute(
  x: Uint32Array,
  x2: Uint32Array,
  row: Uint32Array | undefined,
  key: number,
  bpMin: number,
  bpMax: number,
) {
  const out: number[] = []
  for (let i = 0; i < x.length; i++) {
    const lo = Math.min(x[i]!, x2[i]!)
    const hi = Math.max(x[i]!, x2[i]!)
    if ((row?.[i] ?? 0) === key && lo <= bpMax && hi >= bpMin) {
      out.push(i)
    }
  }
  return out
}

function query(
  x: Uint32Array,
  x2: Uint32Array,
  row: Uint32Array | undefined,
  key: number,
  bpMin: number,
  bpMax: number,
) {
  const out: number[] = []
  spansInRow(rowSpanIndex(x, x2, row), x, x2, key, bpMin, bpMax, out)
  return out.sort((a, b) => a - b)
}

test('a row answers the spans of that row meeting the window, as a search over every span does', () => {
  const rand = lcg(7)
  const n = 3000
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const row = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const start = Math.floor(rand() * 10_000)
    const length =
      rand() < 0.02 ? Math.floor(rand() * 5000) : Math.floor(rand() * 40)
    // a few spans written end first, as a reversed feature can arrive
    if (rand() < 0.05) {
      x[i] = start + length
      x2[i] = start
    } else {
      x[i] = start
      x2[i] = start + length
    }
    row[i] = Math.floor(rand() * 12)
  }
  const index = rowSpanIndex(x, x2, row)
  for (let q = 0; q < 2000; q++) {
    const key = Math.floor(rand() * 13)
    const bpMin = Math.floor(rand() * 10_000)
    const bpMax = bpMin + Math.floor(rand() * 60)
    const got: number[] = []
    spansInRow(index, x, x2, key, bpMin, bpMax, got)
    expect(got.sort((a, b) => a - b)).toEqual(
      brute(x, x2, row, key, bpMin, bpMax),
    )
  }
})

test('spans with no row lane stand in row 0, and a run of touching spans answers both at the seam', () => {
  const x = Uint32Array.of(0, 10, 20)
  const x2 = Uint32Array.of(10, 20, 30)
  expect(query(x, x2, undefined, 0, 10, 10)).toEqual([0, 1])
  expect(query(x, x2, undefined, 0, 25, 40)).toEqual([2])
  expect(query(x, x2, undefined, 1, 0, 40)).toEqual([])
})

test('a zero-width span, an insertion at its anchor, is met at that base', () => {
  const x = Uint32Array.of(0, 5, 5)
  const x2 = Uint32Array.of(5, 5, 9)
  const row = Uint32Array.of(3, 3, 3)
  expect(query(x, x2, row, 3, 5, 5)).toEqual([0, 1, 2])
  expect(query(x, x2, row, 3, 6, 8)).toEqual([2])
})

// `cells` writes an insertion just ahead of the run it interrupts, so a row
// arrives one piece out of start order at each insertion.
test('a row with each insertion just ahead of the run it interrupts answers as a sorted one', () => {
  const x = Uint32Array.of(5, 0, 5, 12, 10, 12)
  const x2 = Uint32Array.of(5, 5, 12, 12, 12, 20)
  expect(query(x, x2, undefined, 0, 4, 4)).toEqual([1])
  expect(query(x, x2, undefined, 0, 5, 5)).toEqual([0, 1, 2])
  expect(query(x, x2, undefined, 0, 11, 12)).toEqual([2, 3, 4, 5])
  expect(query(x, x2, undefined, 0, 13, 30)).toEqual([5])
})
