import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { buildScoreResult } from './buildScoreResult.ts'

import type { Feature } from '@jbrowse/core/util'

function feature(uniqueId: string, start: number, score?: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: '1',
    start,
    end: start + 10,
    score,
  })
}

test('flattens features into parallel typed arrays at matching indexes', () => {
  const r = buildScoreResult(
    [feature('a', 10, 2), feature('b', 200, 4), feature('c', 3000, 1)],
    'score',
  )
  expect(r.numFeatures).toBe(3)
  expect(Array.from(r.starts)).toEqual([10, 200, 3000])
  expect(Array.from(r.ends)).toEqual([20, 210, 3010])
})

test('normalizes score to 0..1 against the region max', () => {
  const r = buildScoreResult(
    [feature('a', 0, 5), feature('b', 100, 10)],
    'score',
  )
  expect(Array.from(r.scores)).toEqual([0.5, 1])
})

test('drops features with a non-finite score, keeping arrays dense', () => {
  const r = buildScoreResult(
    [feature('a', 10, 3), feature('scoreless', 50), feature('c', 3000, 6)],
    'score',
  )
  expect(r.numFeatures).toBe(2)
  expect(Array.from(r.starts)).toEqual([10, 3000])
})

test('preserves uint32 positions above the float32-safe range', () => {
  // chr1 ~ 250 Mbp; bigger than 2^24, so a float32 start would lose precision.
  const bigPos = 250_000_001
  const r = buildScoreResult([feature('big', bigPos, 1)], 'score')
  expect(r.starts[0]).toBe(bigPos)
})
