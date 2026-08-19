import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  makeScoreNormalizer,
} from '@jbrowse/wiggle-core'

import { featuresToRaw, processFeaturesFromArrays } from './util.ts'

const normalizeScore = (
  score: number,
  min: number,
  max: number,
  isLog: boolean,
) =>
  makeScoreNormalizer(
    min,
    max,
    isLog ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
  )(score)

describe('processFeaturesFromArrays', () => {
  test('produces same output as featuresToRaw + processFeaturesFromArrays for basic features', () => {
    const starts = new Int32Array([100, 200, 300])
    const ends = new Int32Array([200, 300, 400])
    const scores = new Float32Array([5, -3, 8])
    const bicolorPivot = 0

    const fromArrays = processFeaturesFromArrays(
      {
        starts,
        ends,
        scores,
        minScores: undefined,
        maxScores: undefined,
        count: 3,
      },
      bicolorPivot,
    )

    const features = [0, 1, 2].map(i => ({
      get: (key: string) => {
        switch (key) {
          case 'start':
            return starts[i]
          case 'end':
            return ends[i]
          case 'score':
            return scores[i]
          case 'summary':
            return false
          default:
            return undefined
        }
      },
    }))
    const fromFeatures = processFeaturesFromArrays(
      featuresToRaw(features),
      bicolorPivot,
    )

    expect(fromArrays.numFeatures).toBe(fromFeatures.numFeatures)
    expect(Array.from(fromArrays.featurePositions)).toEqual(
      Array.from(fromFeatures.featurePositions),
    )
    expect(Array.from(fromArrays.featureScores)).toEqual(
      Array.from(fromFeatures.featureScores),
    )
    expect(fromArrays.posNumFeatures).toBe(fromFeatures.posNumFeatures)
    expect(fromArrays.negNumFeatures).toBe(fromFeatures.negNumFeatures)
    expect(Array.from(fromArrays.posFeatureScores)).toEqual(
      Array.from(fromFeatures.posFeatureScores),
    )
    expect(Array.from(fromArrays.negFeatureScores)).toEqual(
      Array.from(fromFeatures.negFeatureScores),
    )
  })

  test('handles summary features with min/max scores', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100]),
        ends: new Int32Array([100, 200]),
        scores: new Float32Array([5, 10]),
        minScores: new Float32Array([2, 7]),
        maxScores: new Float32Array([8, 15]),
        count: 2,
      },
      0,
    )

    expect(Array.from(result.featureMinScores)).toEqual([2, 7])
    expect(Array.from(result.featureMaxScores)).toEqual([8, 15])
  })

  test('splits positive and negative features by bicolorPivot', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100, 200]),
        ends: new Int32Array([100, 200, 300]),
        scores: new Float32Array([5, -3, 0]),
        minScores: undefined,
        maxScores: undefined,
        count: 3,
      },
      0,
    )

    expect(result.posNumFeatures).toBe(2)
    expect(result.negNumFeatures).toBe(1)
    expect(Array.from(result.posFeatureScores)).toEqual([5, 0])
    expect(Array.from(result.negFeatureScores)).toEqual([-3])
  })

  test('useBicolor=false puts all features in pos arrays regardless of score', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100, 200]),
        ends: new Int32Array([100, 200, 300]),
        scores: new Float32Array([5, -3, 0]),
        minScores: undefined,
        maxScores: undefined,
        count: 3,
      },
      0,
      false,
    )

    expect(result.posNumFeatures).toBe(3)
    expect(result.negNumFeatures).toBe(0)
    expect(Array.from(result.posFeatureScores)).toEqual([5, -3, 0])
  })

  test('a NaN score lands on the negative side, matching the >= pivot split', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100]),
        ends: new Int32Array([100, 200]),
        scores: new Float32Array([5, Number.NaN]),
        minScores: undefined,
        maxScores: undefined,
        count: 2,
      },
      0,
    )

    expect(result.posNumFeatures).toBe(1)
    expect(result.negNumFeatures).toBe(1)
    expect(Array.from(result.posFeatureScores)).toEqual([5])
    expect(result.negFeatureScores.length).toBe(1)
    expect(Number.isNaN(result.negFeatureScores[0])).toBe(true)
  })

  // The aliasing is an allocation/transfer optimization, so assert the identity
  // rather than just the values: a copy here would be a silent regression.
  test('an all-positive window aliases the pos arrays instead of copying', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100]),
        ends: new Int32Array([100, 200]),
        scores: new Float32Array([5, 10]),
        minScores: undefined,
        maxScores: undefined,
        count: 2,
      },
      0,
    )

    expect(result.posFeaturePositions).toBe(result.featurePositions)
    expect(result.posFeatureScores).toBe(result.featureScores)
    expect(result.negNumFeatures).toBe(0)
    expect(result.negFeaturePositions.length).toBe(0)
    // no summary arrays in, so min/max are the scores themselves
    expect(result.featureMinScores).toBe(result.featureScores)
    expect(result.featureMaxScores).toBe(result.featureScores)
    expect(result.hasSummaryScores).toBe(false)
  })

  test('an all-negative window aliases the neg arrays', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100]),
        ends: new Int32Array([100, 200]),
        scores: new Float32Array([-5, -10]),
        minScores: undefined,
        maxScores: undefined,
        count: 2,
      },
      0,
    )

    expect(result.negFeaturePositions).toBe(result.featurePositions)
    expect(result.negFeatureScores).toBe(result.featureScores)
    expect(result.posNumFeatures).toBe(0)
    expect(result.posFeatureScores.length).toBe(0)
  })

  test('summary arrays are materialized separately from the scores', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0]),
        ends: new Int32Array([100]),
        scores: new Float32Array([5]),
        minScores: new Float32Array([2]),
        maxScores: new Float32Array([8]),
        count: 1,
      },
      0,
    )

    expect(result.featureMinScores).not.toBe(result.featureScores)
    expect(Array.from(result.featureMinScores)).toEqual([2])
    expect(Array.from(result.featureMaxScores)).toEqual([8])
    expect(result.hasSummaryScores).toBe(true)
  })

  // Same aliasing rule as the pos/neg split: a copy that would be identical is
  // two more buffers to allocate and to hand postMessage, per source per region.
  test('summary arrays that never diverge alias the scores', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100]),
        ends: new Int32Array([100, 200]),
        scores: new Float32Array([5, 10]),
        minScores: new Float32Array([5, 10]),
        maxScores: new Float32Array([5, 10]),
        count: 2,
      },
      0,
    )

    expect(result.hasSummaryScores).toBe(false)
    expect(result.featureMinScores).toBe(result.featureScores)
    expect(result.featureMaxScores).toBe(result.featureScores)
  })

  // featuresToRaw feeds the fallback (non-typed-array) adapters — bedGraph,
  // bedMethyl in a multi-wiggle. Reporting `undefined` rather than two copies of
  // `scores` is what lets processFeaturesFromArrays take the aliasing path.
  test('featuresToRaw omits min/max when no feature carries a summary', () => {
    const raw = featuresToRaw([
      { get: (k: string) => ({ start: 0, end: 10, score: 5 })[k] },
      { get: (k: string) => ({ start: 10, end: 20, score: 7 })[k] },
    ])

    expect(raw.minScores).toBeUndefined()
    expect(raw.maxScores).toBeUndefined()
    const result = processFeaturesFromArrays(raw, 0)
    expect(result.featureMinScores).toBe(result.featureScores)
  })

  test('featuresToRaw materializes min/max when any feature is a summary', () => {
    const raw = featuresToRaw([
      { get: (k: string) => ({ start: 0, end: 10, score: 5 })[k] },
      {
        get: (k: string) =>
          ({
            start: 10,
            end: 20,
            score: 7,
            summary: true,
            minScore: 3,
            maxScore: 9,
          })[k],
      },
    ])

    // the non-summary feature backfills from its own score, not zero
    expect(Array.from(raw.minScores!)).toEqual([5, 3])
    expect(Array.from(raw.maxScores!)).toEqual([5, 9])
  })

  test('empty input produces empty arrays', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array(0),
        ends: new Int32Array(0),
        scores: new Float32Array(0),
        minScores: undefined,
        maxScores: undefined,
        count: 0,
      },
      0,
    )

    expect(result.numFeatures).toBe(0)
    expect(result.posNumFeatures).toBe(0)
    expect(result.negNumFeatures).toBe(0)
  })

  test('stores absolute positions', () => {
    const result = processFeaturesFromArrays(
      {
        starts: new Int32Array([50]),
        ends: new Int32Array([100]),
        scores: new Float32Array([5]),
        minScores: undefined,
        maxScores: undefined,
        count: 1,
      },
      0,
    )

    expect(result.featurePositions[0]).toBe(50)
    expect(result.featurePositions[1]).toBe(100)
  })
})

describe('normalizeScore', () => {
  test('linear normalization', () => {
    expect(normalizeScore(5, 0, 10, false)).toBeCloseTo(0.5)
    expect(normalizeScore(0, 0, 10, false)).toBeCloseTo(0)
    expect(normalizeScore(10, 0, 10, false)).toBeCloseTo(1)
  })

  test('clamps to 0-1 range', () => {
    expect(normalizeScore(-5, 0, 10, false)).toBe(0)
    expect(normalizeScore(15, 0, 10, false)).toBe(1)
  })

  test('returns 0 for zero range', () => {
    expect(normalizeScore(5, 5, 5, false)).toBe(0)
    expect(normalizeScore(5, 5, 5, true)).toBe(0)
  })

  test('log normalization', () => {
    const result = normalizeScore(4, 1, 16, true)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(1)
  })
})
