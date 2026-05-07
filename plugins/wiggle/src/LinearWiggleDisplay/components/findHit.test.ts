import { findHit } from './findHit.ts'

import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'

function makeData(
  features: { start: number; end: number; score: number; min?: number; max?: number }[],
): WiggleDataResult {
  const n = features.length
  const positions = new Uint32Array(n * 2)
  const scores = new Float32Array(n)
  const minScores = new Float32Array(n)
  const maxScores = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const f = features[i]!
    positions[i * 2] = f.start
    positions[i * 2 + 1] = f.end
    scores[i] = f.score
    minScores[i] = f.min ?? f.score
    maxScores[i] = f.max ?? f.score
  }
  return {
    featurePositions: positions,
    featureScores: scores,
    featureMinScores: minScores,
    featureMaxScores: maxScores,
    numFeatures: n,
    posFeaturePositions: new Uint32Array(0),
    posFeatureScores: new Float32Array(0),
    posNumFeatures: 0,
    negFeaturePositions: new Uint32Array(0),
    negFeatureScores: new Float32Array(0),
    negNumFeatures: 0,
  }
}

describe('findHit', () => {
  test('returns the feature interval at bp', () => {
    const data = makeData([{ start: 100, end: 500, score: 7 }])
    const result = findHit(data, 250, 'chr1', 'avg')
    expect(result).toEqual({
      refName: 'chr1',
      start: 100,
      end: 500,
      score: 7,
    })
  })

  test('returns undefined when bp falls in a gap before any feature', () => {
    const data = makeData([{ start: 200, end: 300, score: 5 }])
    expect(findHit(data, 50, 'chr1', 'avg')).toBeUndefined()
  })

  test('returns undefined when bp falls in a gap after the last feature', () => {
    const data = makeData([{ start: 0, end: 100, score: 5 }])
    expect(findHit(data, 200, 'chr1', 'avg')).toBeUndefined()
  })

  test('returns undefined when bp falls between two non-adjacent features', () => {
    const data = makeData([
      { start: 0, end: 100, score: 5 },
      { start: 200, end: 300, score: 6 },
    ])
    expect(findHit(data, 150, 'chr1', 'avg')).toBeUndefined()
  })

  test('attaches summary fields in non-avg mode when min/max differ from score', () => {
    const data = makeData([
      { start: 0, end: 100, score: 5, min: 1, max: 9 },
    ])
    const result = findHit(data, 50, 'chr1', 'whiskers')
    expect(result).toEqual({
      refName: 'chr1',
      start: 0,
      end: 100,
      score: 5,
      summary: true,
      minScore: 1,
      maxScore: 9,
    })
  })

  test('omits summary fields in avg mode even when min/max differ', () => {
    const data = makeData([
      { start: 0, end: 100, score: 5, min: 1, max: 9 },
    ])
    const result = findHit(data, 50, 'chr1', 'avg')
    expect(result).toEqual({
      refName: 'chr1',
      start: 0,
      end: 100,
      score: 5,
    })
  })

  test('omits summary fields when min/max equal score', () => {
    const data = makeData([
      { start: 0, end: 100, score: 5, min: 5, max: 5 },
    ])
    const result = findHit(data, 50, 'chr1', 'whiskers')
    expect(result).toEqual({
      refName: 'chr1',
      start: 0,
      end: 100,
      score: 5,
    })
  })

  test('returns undefined for empty data', () => {
    const data = makeData([])
    expect(findHit(data, 50, 'chr1', 'avg')).toBeUndefined()
  })

  test('picks the correct feature when multiple are present', () => {
    const data = makeData([
      { start: 0, end: 100, score: 1 },
      { start: 100, end: 200, score: 2 },
      { start: 200, end: 300, score: 3 },
    ])
    expect(findHit(data, 50, 'chr1', 'avg')?.score).toBe(1)
    expect(findHit(data, 150, 'chr1', 'avg')?.score).toBe(2)
    expect(findHit(data, 250, 'chr1', 'avg')?.score).toBe(3)
  })
})
