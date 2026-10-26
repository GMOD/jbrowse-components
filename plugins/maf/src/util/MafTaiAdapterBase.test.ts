import { blockOverlaps } from './MafTaiAdapterBase.ts'

const left = { start: 0, end: 10 }
const right = { start: 10, end: 20 }

test('a block touching the seam belongs to the region it overlaps', () => {
  expect(blockOverlaps(5, 10, left)).toBe(true)
  expect(blockOverlaps(5, 10, right)).toBe(false)
  expect(blockOverlaps(10, 15, left)).toBe(false)
  expect(blockOverlaps(10, 15, right)).toBe(true)
})

test('a block spanning no reference base on the seam belongs to one region', () => {
  expect([left, right].map(q => blockOverlaps(10, 10, q))).toEqual([
    false,
    true,
  ])
  expect(blockOverlaps(5, 5, left)).toBe(true)
})
