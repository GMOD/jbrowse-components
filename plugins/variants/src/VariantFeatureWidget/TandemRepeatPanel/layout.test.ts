import {
  axisTicks,
  copiesOf,
  formatBp,
  mergeNarrowCopies,
  readout,
} from './layout.ts'

const units = [{ length: 5548, copies: 7 }]

test('RUB places each copy; without it a whole count splits its run evenly', () => {
  expect(
    copiesOf(
      {
        label: 'a',
        altIndex: 1,
        bp: 30,
        runs: [{ unit: 0, count: 3, bp: 30, copyBp: [9, 11, 10] }],
      },
      units,
    ),
  ).toEqual([
    { start: 0, bp: 9, unit: 0 },
    { start: 9, bp: 11, unit: 0 },
    { start: 20, bp: 10, unit: 0 },
  ])
  expect(
    copiesOf(
      {
        label: 'a',
        altIndex: 1,
        bp: 30,
        runs: [{ unit: 0, count: 2, bp: 30 }],
      },
      units,
    ),
  ).toEqual([
    { start: 0, bp: 15, unit: 0 },
    { start: 15, bp: 15, unit: 0 },
  ])
})

test('a fractional count takes whole units and the remainder last', () => {
  const copies = copiesOf(
    {
      label: 'a',
      altIndex: 1,
      bp: 8322,
      runs: [{ unit: 0, count: 1.5, bp: 8322 }],
    },
    units,
  )
  expect(copies.map(c => c.bp)).toEqual([5548, 2774])
})

test('the readout counts copies, or units for the reference allele', () => {
  const runs = [{ unit: 0, count: 27, bp: 147189 }]
  expect(
    readout({ label: 'a', altIndex: 1, bp: 147189, runs }, 30751, 5548),
  ).toBe('147 kb · 27 copies (+116 kb)')
  expect(readout({ label: 'GRCh38', altIndex: 1, bp: 387 }, 400, 10)).toBe(
    '387 bp ≈ 39 units (−13 bp)',
  )
  expect(formatBp(5547)).toBe('5.5 kb')
})

test('ruler ticks step by 1, 2 or 5 times a power of ten', () => {
  expect(axisTicks(147189)).toEqual([0, 50000, 100000])
  expect(axisTicks(3161)).toEqual([0, 1000, 2000, 3000])
  expect(axisTicks(0)).toEqual([0])
})

test('narrow copies of one unit merge into a single run', () => {
  const copies = Array.from({ length: 15_000 }, (_, i) => ({
    start: i * 2,
    bp: 2,
    unit: 0,
  }))
  const runs = mergeNarrowCopies(copies, 0.001, 3)
  expect(runs).toHaveLength(1)
  expect(runs[0]).toMatchObject({
    start: 0,
    bp: 30_000,
    first: 0,
    count: 15_000,
  })
})

test('wide copies and a change of unit each start a new run', () => {
  const copies = [
    { start: 0, bp: 100, unit: 0 },
    { start: 100, bp: 100, unit: 0 },
    { start: 200, bp: 1, unit: 1 },
    { start: 201, bp: 1, unit: 1 },
    { start: 202, bp: 1, unit: 0 },
  ]
  expect(mergeNarrowCopies(copies, 1, 3).map(r => r.count)).toEqual([
    1, 1, 2, 1,
  ])
})

test('a copy count that disagrees with its bases never draws a negative copy', () => {
  const boxes = copiesOf(
    {
      label: 'a',
      altIndex: 1,
      bp: 15,
      runs: [{ unit: 0, count: 2.5, bp: 15 }],
    },
    [{ length: 10, copies: 2.5 }],
  )
  expect(boxes.every(b => b.bp >= 0)).toBe(true)
})

test('a span of a few bp gets whole-bp ticks', () => {
  expect(axisTicks(3)).toEqual([0, 1, 2, 3])
})

test('a corrupt copy count draws as one box instead of allocating a box per copy', () => {
  const boxes = copiesOf(
    {
      label: 'a',
      altIndex: 1,
      bp: 1e13,
      runs: [{ unit: 0, count: 1e9, bp: 1e13 }],
    },
    [{ length: 10_000, copies: 1e9 }],
  )
  expect(boxes).toEqual([{ start: 0, bp: 1e13, unit: 0 }])
})

test('bp reads in bp, kb or Mb', () => {
  expect(formatBp(387)).toBe('387 bp')
  expect(formatBp(30751)).toBe('31 kb')
  expect(formatBp(1_500_000)).toBe('1.5 Mb')
  expect(formatBp(147_000_000)).toBe('147 Mb')
})
