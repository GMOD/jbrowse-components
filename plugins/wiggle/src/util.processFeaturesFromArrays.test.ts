import {
  isDefaultBicolor,
  normalizeScore,
  processFeatures,
  processFeaturesFromArrays,
} from './util.ts'

describe('processFeaturesFromArrays', () => {
  test('produces same output as processFeatures for basic features', () => {
    const starts = new Int32Array([100, 200, 300])
    const ends = new Int32Array([200, 300, 400])
    const scores = new Float32Array([5, -3, 8])
    const regionStart = 50
    const bicolorPivot = 0

    const fromArrays = processFeaturesFromArrays(
      starts,
      ends,
      scores,
      undefined,
      undefined,
      3,
      regionStart,
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
    const fromFeatures = processFeatures(features, regionStart, bicolorPivot)

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
    const starts = new Int32Array([0, 100])
    const ends = new Int32Array([100, 200])
    const scores = new Float32Array([5, 10])
    const minScores = new Float32Array([2, 7])
    const maxScores = new Float32Array([8, 15])

    const result = processFeaturesFromArrays(
      starts,
      ends,
      scores,
      minScores,
      maxScores,
      2,
      0,
      0,
    )

    expect(Array.from(result.featureMinScores)).toEqual([2, 7])
    expect(Array.from(result.featureMaxScores)).toEqual([8, 15])
  })

  test('splits positive and negative features by bicolorPivot', () => {
    const starts = new Int32Array([0, 100, 200])
    const ends = new Int32Array([100, 200, 300])
    const scores = new Float32Array([5, -3, 0])

    const result = processFeaturesFromArrays(
      starts,
      ends,
      scores,
      undefined,
      undefined,
      3,
      0,
      0,
    )

    expect(result.posNumFeatures).toBe(2)
    expect(result.negNumFeatures).toBe(1)
    expect(Array.from(result.posFeatureScores)).toEqual([5, 0])
    expect(Array.from(result.negFeatureScores)).toEqual([-3])
  })

  test('clamps offsets to zero when features start before region', () => {
    const starts = new Int32Array([-50])
    const ends = new Int32Array([100])
    const scores = new Float32Array([5])

    const result = processFeaturesFromArrays(
      starts,
      ends,
      scores,
      undefined,
      undefined,
      1,
      0,
      0,
    )

    expect(result.featurePositions[0]).toBe(0)
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

describe('isDefaultBicolor', () => {
  test('short hex format', () => {
    expect(isDefaultBicolor('#f0f')).toBe(true)
  })

  test('full hex format', () => {
    expect(isDefaultBicolor('#ff00ff')).toBe(true)
  })

  test('other colors return false', () => {
    expect(isDefaultBicolor('#0068d1')).toBe(false)
    expect(isDefaultBicolor('red')).toBe(false)
  })
})
