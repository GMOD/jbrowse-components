import { axisTicks, copiesOf, formatBp, readout } from './layout.ts'

const units = [{ length: 5548, copies: 7 }]

test('RUB places each copy; without it a whole count splits its run evenly', () => {
  expect(
    copiesOf(
      {
        label: 'a',
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
      { label: 'a', bp: 30, runs: [{ unit: 0, count: 2, bp: 30 }] },
      units,
    ),
  ).toEqual([
    { start: 0, bp: 15, unit: 0 },
    { start: 15, bp: 15, unit: 0 },
  ])
})

test('a fractional count takes whole units and the remainder last', () => {
  const copies = copiesOf(
    { label: 'a', bp: 8322, runs: [{ unit: 0, count: 1.5, bp: 8322 }] },
    units,
  )
  expect(copies.map(c => c.bp)).toEqual([5548, 2774])
})

test('the readout counts copies, or units for the reference allele', () => {
  const runs = [{ unit: 0, count: 27, bp: 147189 }]
  expect(readout({ label: 'a', bp: 147189, runs }, 30751, 5548)).toBe(
    '147 kb · 27 copies (+116 kb)',
  )
  expect(readout({ label: 'GRCh38', bp: 387 }, 400, 10)).toBe(
    '387 bp ≈ 39 units (−13 bp)',
  )
  expect(formatBp(5547)).toBe('5.5 kb')
})

test('ruler ticks step by 1, 2 or 5 times a power of ten', () => {
  expect(axisTicks(147189)).toEqual([0, 50000, 100000])
  expect(axisTicks(3161)).toEqual([0, 1000, 2000, 3000])
  expect(axisTicks(0)).toEqual([0])
})
