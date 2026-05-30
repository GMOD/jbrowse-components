import Flatbush from '@jbrowse/core/util/flatbush'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { buildManhattanResult } from './executeGetManhattanData.ts'

import type { Feature } from '@jbrowse/core/util'

function feature(uniqueId: string, start: number, score: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: '1',
    start,
    end: start + 1,
    score,
  })
}

const constColor = (c: number) => () => c

test('flattens features into typed arrays at matching indexes', () => {
  const r = buildManhattanResult(
    [feature('a', 10, 1.5), feature('b', 200, 7.25), feature('c', 3000, 4)],
    constColor(0xff00ffff),
  )
  expect(r.numFeatures).toBe(3)
  expect(Array.from(r.positions)).toEqual([10, 200, 3000])
  expect(Array.from(r.scores)).toEqual([1.5, 7.25, 4])
  expect(Array.from(r.colors)).toEqual([0xff00ffff, 0xff00ffff, 0xff00ffff])
})

test('preserves bp ≥ 2^31 through Uint32Array coercion', () => {
  // Past `| 0` semantics would sign-extend large genomic coordinates (T2T-
  // scale). Uint32Array assignment uses ToUint32, which preserves them.
  const big = 0x9000_0000
  const r = buildManhattanResult([feature('x', big, 1)], constColor(0))
  expect(r.positions[0]).toBe(big)
})

test('rolls scoreMin/scoreMax across features', () => {
  const r = buildManhattanResult(
    [feature('a', 0, 3), feature('b', 1, -2), feature('c', 2, 8.5)],
    constColor(0),
  )
  expect(r.scoreMin).toBe(-2)
  expect(r.scoreMax).toBe(8.5)
})

test('empty input → numFeatures 0, sentinels at Infinity, no flatbush', () => {
  const r = buildManhattanResult([], constColor(0))
  expect(r.numFeatures).toBe(0)
  expect(r.positions).toHaveLength(0)
  expect(r.scoreMin).toBe(Infinity)
  expect(r.scoreMax).toBe(-Infinity)
  expect(r.flatbushData).toBeUndefined()
})

test('emits a deserializable Flatbush index over (bp, score)', () => {
  const r = buildManhattanResult(
    [feature('a', 100, 5), feature('b', 500, 9), feature('c', 900, 2)],
    constColor(0),
  )
  expect(r.flatbushData).toBeDefined()
  const fb = Flatbush.from(r.flatbushData!)
  // Query a tight box around feature b; expect only index 1.
  expect(fb.search(490, 8, 510, 10)).toEqual([1])
  // Query covering the whole input; expect all three.
  expect(fb.search(0, -10, 1000, 100).sort()).toEqual([0, 1, 2])
})

test('per-feature color evaluator decides each instance color', () => {
  const r = buildManhattanResult(
    [feature('a', 0, 1), feature('b', 1, 5), feature('c', 2, 8)],
    f => ((f.get('score') as number) > 4 ? 0xff0000ff : 0xff00ff00),
  )
  expect(Array.from(r.colors)).toEqual([0xff00ff00, 0xff0000ff, 0xff0000ff])
})

test('no r² array when no evaluator is given (normal coloring)', () => {
  const r = buildManhattanResult([feature('a', 0, 1)], constColor(0))
  expect(r.r2s).toBeUndefined()
})

test('per-feature r² evaluator fills the r² array (LD coloring)', () => {
  const r = buildManhattanResult(
    [feature('a', 0, 1), feature('b', 1, 5)],
    constColor(0),
    f => (f.get('start') === 0 ? 1 : 0.4),
  )
  expect(r.r2s).toHaveLength(2)
  expect(r.r2s![0]).toBe(1)
  expect(r.r2s![1]).toBeCloseTo(0.4)
})
