import { findHit } from './findHit.ts'

import type { WiggleSourceData } from '../../util.ts'

function makeSource(
  features: {
    start: number
    end: number
    score: number
    min?: number
    max?: number
  }[],
): WiggleSourceData {
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
    name: 'default',
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
    const source = makeSource([{ start: 100, end: 500, score: 7 }])
    const result = findHit(source, 250, 'chr1', 'avg')
    expect(result).toEqual({
      refName: 'chr1',
      start: 100,
      end: 500,
      score: 7,
    })
  })

  test('returns undefined when bp falls in a gap before any feature', () => {
    const source = makeSource([{ start: 200, end: 300, score: 5 }])
    expect(findHit(source, 50, 'chr1', 'avg')).toBeUndefined()
  })

  test('returns undefined when bp falls in a gap after the last feature', () => {
    const source = makeSource([{ start: 0, end: 100, score: 5 }])
    expect(findHit(source, 200, 'chr1', 'avg')).toBeUndefined()
  })

  test('returns undefined when bp falls between two non-adjacent features', () => {
    const source = makeSource([
      { start: 0, end: 100, score: 5 },
      { start: 200, end: 300, score: 6 },
    ])
    expect(findHit(source, 150, 'chr1', 'avg')).toBeUndefined()
  })

  test('attaches summary fields in non-avg mode when min/max differ from score', () => {
    const source = makeSource([
      { start: 0, end: 100, score: 5, min: 1, max: 9 },
    ])
    const result = findHit(source, 50, 'chr1', 'whiskers')
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
    const source = makeSource([
      { start: 0, end: 100, score: 5, min: 1, max: 9 },
    ])
    const result = findHit(source, 50, 'chr1', 'avg')
    expect(result).toEqual({
      refName: 'chr1',
      start: 0,
      end: 100,
      score: 5,
    })
  })

  test('omits summary fields when min/max equal score', () => {
    const source = makeSource([
      { start: 0, end: 100, score: 5, min: 5, max: 5 },
    ])
    const result = findHit(source, 50, 'chr1', 'whiskers')
    expect(result).toEqual({
      refName: 'chr1',
      start: 0,
      end: 100,
      score: 5,
    })
  })

  test('returns undefined for empty data', () => {
    const source = makeSource([])
    expect(findHit(source, 50, 'chr1', 'avg')).toBeUndefined()
  })

  test('picks the correct feature when multiple are present', () => {
    const source = makeSource([
      { start: 0, end: 100, score: 1 },
      { start: 100, end: 200, score: 2 },
      { start: 200, end: 300, score: 3 },
    ])
    expect(findHit(source, 50, 'chr1', 'avg')?.score).toBe(1)
    expect(findHit(source, 150, 'chr1', 'avg')?.score).toBe(2)
    expect(findHit(source, 250, 'chr1', 'avg')?.score).toBe(3)
  })
})
