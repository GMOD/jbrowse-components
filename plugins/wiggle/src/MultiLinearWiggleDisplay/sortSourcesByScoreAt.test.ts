import { sortSourcesByScoreAt } from './sortSourcesByScoreAt.ts'
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

// The rows being ordered: only `name` is read, so this stands in for the
// display's layout-merged sources.
function rows(...names: string[]) {
  return names.map(name => ({ name }))
}

function order(sources: { name: string }[], d: WiggleDataResult, bp: number) {
  return sortSourcesByScoreAt(sources, d, bp).map(s => s.name)
}

test('ranks the rows at the clicked base, highest score first', () => {
  const d = data(
    ['a', [[0, 100, 1]]],
    ['b', [[0, 100, 5]]],
    ['c', [[0, 100, 3]]],
  )

  expect(order(rows('a', 'b', 'c'), d, 50)).toEqual(['b', 'c', 'a'])
})

test('returns the rows it was handed, not just their names', () => {
  // the caller writes the result straight to `layout`, so every field a row
  // carries (a user's color, its group) has to survive the reorder
  const d = data(['a', [[0, 100, 1]]], ['b', [[0, 100, 5]]])
  const a = { name: 'a', color: 'red' }
  const b = { name: 'b', color: 'blue' }

  expect(sortSourcesByScoreAt([a, b], d, 50)).toEqual([b, a])
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

  expect(order(rows('a', 'b'), d, 50)).toEqual(['b', 'a'])
  expect(order(rows('a', 'b'), d, 150)).toEqual(['a', 'b'])
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

  expect(order(rows('a', 'b', 'c', 'd'), d, 50)).toEqual(['c', 'a', 'b', 'd'])
})

test('treats NaN as no score rather than comparing it', () => {
  const d = data(
    ['a', [[0, 100, Number.NaN]]],
    ['b', [[0, 100, 2]]],
    ['c', [[0, 100, 7]]],
  )

  expect(order(rows('a', 'b', 'c'), d, 50)).toEqual(['c', 'b', 'a'])
})

test('leaves tied rows in their incoming order', () => {
  const d = data(
    ['a', [[0, 100, 4]]],
    ['b', [[0, 100, 4]]],
    ['c', [[0, 100, 4]]],
  )

  expect(order(rows('b', 'a', 'c'), d, 50)).toEqual(['b', 'a', 'c'])
})
