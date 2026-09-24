import { buildMarkRowMatrix } from './buildMarkRowMatrix.ts'

import type { RowInstance } from './buildMarkRowMatrix.ts'

function instance(
  row: string,
  start: number,
  end: number,
  value: number,
  regionIndex = 0,
): RowInstance {
  return { regionIndex, row, start, end, value }
}

function matrix(...args: Parameters<typeof buildMarkRowMatrix>) {
  return Object.fromEntries(
    [...buildMarkRowMatrix(...args)].map(([name, row]) => [name, [...row]]),
  )
}

test('a bin is the mean of the values covering its midpoint, 0 where none does', () => {
  expect(
    matrix({
      rows: ['a', 'b', 'c'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 4, // midpoints 1.25, 3.75, 6.25, 8.75
      instances: [
        instance('a', 0, 10, 2),
        instance('a', 0, 5, 4),
        instance('b', 4, 6, 1),
        instance('nobody', 0, 10, 9),
      ],
    }),
  ).toEqual({ a: [3, 3, 2, 2], b: [0, 0, 0, 0], c: [0, 0, 0, 0] })
})

test('the rows keep the order they were asked in, and the regions share the bins by span', () => {
  const rows = buildMarkRowMatrix({
    rows: ['z', 'a'],
    regions: [
      { start: 0, end: 30 },
      { start: 100, end: 110 },
    ],
    maxBins: 4,
    instances: [instance('a', 100, 110, 5, 1)],
  })
  expect([...rows.keys()]).toEqual(['z', 'a'])
  expect([...rows.get('a')!]).toEqual([0, 0, 0, 5])
})
