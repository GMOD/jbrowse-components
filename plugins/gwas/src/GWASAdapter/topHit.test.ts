import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { TOP_HIT_FACT, readTopHit, topHitOf } from './topHit.ts'

function feat(start: number, score?: number) {
  return new SimpleFeature({
    uniqueId: String(start),
    refName: '1',
    start,
    end: start + 1,
    ...(score === undefined ? {} : { score }),
  })
}

test('the top hit is the highest score, the lowest start among equals', () => {
  expect(topHitOf([feat(300, 9), feat(100, 9), feat(200, 3)])).toEqual({
    start: 100,
    score: 9,
  })
})

test('a feature with no finite score is never the top hit', () => {
  expect(topHitOf([feat(1), feat(2, NaN), feat(3, Infinity)])).toBeUndefined()
  expect(topHitOf([feat(1, NaN), feat(2, -4)])).toEqual({ start: 2, score: -4 })
})

test('a top hit reads back off the facts it was reported in, and nothing else does', () => {
  expect(readTopHit({ [TOP_HIT_FACT]: { start: 5, score: 2 } })).toEqual({
    start: 5,
    score: 2,
  })
  expect(readTopHit(undefined)).toBeUndefined()
  expect(readTopHit({ [TOP_HIT_FACT]: { start: '5' } })).toBeUndefined()
})
