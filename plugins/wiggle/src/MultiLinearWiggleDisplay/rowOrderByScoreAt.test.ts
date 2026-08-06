import { rowOrderByScoreAt } from './rowOrderByScoreAt.ts'
import { makeSource } from './testEnv.ts'

import type { WiggleDataResult } from '../util.ts'

// One source with [start, end, score] features, in the shape the RPC ships.
function withFeatures(
  name: string,
  features: [start: number, end: number, score: number][],
) {
  return {
    ...makeSource(name),
    featurePositions: new Uint32Array(features.flatMap(([s, e]) => [s, e])),
    featureScores: new Float32Array(features.map(f => f[2])),
    numFeatures: features.length,
  }
}

function data(
  ...sources: [string, [number, number, number][]][]
): WiggleDataResult {
  return { sources: sources.map(([name, f]) => withFeatures(name, f)) }
}

test('ranks the rows at the clicked base, highest score first', () => {
  const d = data(
    ['a', [[0, 100, 1]]],
    ['b', [[0, 100, 5]]],
    ['c', [[0, 100, 3]]],
  )

  expect(rowOrderByScoreAt(['a', 'b', 'c'], d, 50)).toEqual(['b', 'c', 'a'])
})

test('reads the feature covering the base, not the whole source', () => {
  // b out-scores a on the left half and loses on the right, so the two clicks
  // have to disagree — a sort that averaged the source would rank them once
  const d = data(
    [
      'a',
      [
        [0, 100, 1],
        [100, 200, 9],
      ],
    ],
    [
      'b',
      [
        [0, 100, 5],
        [100, 200, 2],
      ],
    ],
  )

  expect(rowOrderByScoreAt(['a', 'b'], d, 50)).toEqual(['b', 'a'])
  expect(rowOrderByScoreAt(['a', 'b'], d, 150)).toEqual(['a', 'b'])
})

test('sinks rows with no score at the base, keeping their order', () => {
  // a gap in `b` and a source (`d`) with no data at all: neither has a value to
  // rank, and inventing one (0) would rank them above every negative score
  const d = data(
    ['a', [[0, 100, -5]]],
    ['b', [[200, 300, 100]]],
    ['c', [[0, 100, -1]]],
    ['d', []],
  )

  expect(rowOrderByScoreAt(['a', 'b', 'c', 'd'], d, 50)).toEqual([
    'c',
    'a',
    'b',
    'd',
  ])
})

test('treats NaN as no score rather than comparing it', () => {
  const d = data(
    ['a', [[0, 100, Number.NaN]]],
    ['b', [[0, 100, 2]]],
    ['c', [[0, 100, 7]]],
  )

  expect(rowOrderByScoreAt(['a', 'b', 'c'], d, 50)).toEqual(['c', 'b', 'a'])
})

test('leaves tied rows in their incoming order', () => {
  const d = data(
    ['a', [[0, 100, 4]]],
    ['b', [[0, 100, 4]]],
    ['c', [[0, 100, 4]]],
  )

  expect(rowOrderByScoreAt(['b', 'a', 'c'], d, 50)).toEqual(['b', 'a', 'c'])
})
