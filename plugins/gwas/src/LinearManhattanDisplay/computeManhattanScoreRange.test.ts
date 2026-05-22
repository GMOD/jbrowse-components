import { computeManhattanScoreRange } from './computeManhattanScoreRange.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'

function region(
  numFeatures: number,
  scoreMin: number,
  scoreMax: number,
): ManhattanRpcResult {
  return {
    positions: new Uint32Array(),
    scores: new Float32Array(),
    colors: new Uint32Array(),
    numFeatures,
    scoreMin,
    scoreMax,
    scoreSum: 0,
    scoreSumSq: 0,
    flatbushData: undefined,
  }
}

test('returns undefined when no regions are loaded', () => {
  expect(computeManhattanScoreRange([])).toBeUndefined()
})

test('returns undefined when all regions are empty', () => {
  // A region with 0 features can carry scoreMin=0/scoreMax=0 from the
  // executor's "n === 0" short-circuit — we must not let that pollute the
  // domain.
  expect(
    computeManhattanScoreRange([region(0, 0, 0), region(0, 0, 0)]),
  ).toBeUndefined()
})

test('takes min over all populated regions', () => {
  expect(
    computeManhattanScoreRange([region(10, 1, 8), region(5, -3, 4)]),
  ).toEqual([-3, 8])
})

test('skips empty regions but uses populated ones', () => {
  // Empty region's stats would be [0, 0] — must not drag down the max.
  expect(
    computeManhattanScoreRange([region(0, 0, 0), region(3, 5, 15)]),
  ).toEqual([5, 15])
})

test('handles single-region single-value range', () => {
  expect(computeManhattanScoreRange([region(1, 7, 7)])).toEqual([7, 7])
})
