import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { TOP_HIT_BINS, TOP_HIT_FACT, readTopHits, topHitsOf } from './topHit.ts'

function feat(start: number, score?: number) {
  return new SimpleFeature({
    uniqueId: String(start),
    refName: '1',
    start,
    end: start + 1,
    ...(score === undefined ? {} : { score }),
  })
}

const region = { refName: '1', start: 0, end: TOP_HIT_BINS * 100 }

test("a bin's top hit is the highest score, the lowest start among equals", () => {
  expect(topHitsOf([feat(30, 9), feat(10, 9), feat(20, 3)], region)).toEqual([
    { start: 10, score: 9 },
  ])
})

test('each bin reports its own top hit, in ascending start', () => {
  expect(
    topHitsOf([feat(250, 2), feat(5, 1), feat(220, 7), feat(10, 4)], region),
  ).toEqual([
    { start: 10, score: 4 },
    { start: 220, score: 7 },
  ])
})

test('a feature starting outside the region lands in an edge bin', () => {
  expect(topHitsOf([feat(-5, 1), feat(region.end + 5, 2)], region)).toEqual([
    { start: -5, score: 1 },
    { start: region.end + 5, score: 2 },
  ])
})

test('a feature with no finite score is never a top hit', () => {
  expect(topHitsOf([feat(1), feat(2, NaN), feat(3, Infinity)], region)).toEqual(
    [],
  )
  expect(topHitsOf([feat(1, NaN), feat(2, -4)], region)).toEqual([
    { start: 2, score: -4 },
  ])
})

test('top hits read back off the facts they were reported in, and nothing else does', () => {
  expect(readTopHits({ [TOP_HIT_FACT]: [{ start: 5, score: 2 }] })).toEqual([
    { start: 5, score: 2 },
  ])
  expect(readTopHits(undefined)).toEqual([])
  expect(readTopHits({ [TOP_HIT_FACT]: [{ start: '5' }] })).toEqual([])
})
