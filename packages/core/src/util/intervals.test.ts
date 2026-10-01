import { gatherOverlaps } from './intervals.ts'

test('refNames that name Object.prototype members group normally', () => {
  const regions = ['constructor', 'toString', '__proto__'].flatMap(refName => [
    { refName, start: 0, end: 10 },
    { refName, start: 5, end: 20 },
  ])
  const merged = gatherOverlaps(regions, 0)
  expect(merged.map(r => [r.refName, r.start, r.end])).toEqual([
    ['constructor', 0, 20],
    ['toString', 0, 20],
    ['__proto__', 0, 20],
  ])
})
