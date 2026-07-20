import { computeAutoscaleDomain, getNiceDomain, getScale } from './util.ts'

test('linear scale', () => {
  const scaleType = 'linear'
  const domain = [0, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range })
  expect(scale.domain()).toEqual(domain)
})

test('log scale', () => {
  const scaleType = 'log'
  const domain = [1, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range })
  expect(scale.domain()).toEqual([1, 128])
})

test('test minScore', () => {
  const scaleType = 'linear'
  const domain = [0, 100] as const
  const bounds = [50, undefined] as const
  const ret = getNiceDomain({ scaleType, domain, bounds })
  expect(ret).toEqual([50, 100])
})

test('test min and max score', () => {
  const scaleType = 'linear'
  const domain = [1, 100] as const
  const bounds = [undefined, 70] as const
  const ret = getNiceDomain({ scaleType, domain, bounds })
  expect(ret).toEqual([0, 70])
})

function makeFeatureArrays(scores: number[]) {
  const n = scores.length
  const positions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    positions[i * 2] = i * 100
    positions[i * 2 + 1] = (i + 1) * 100
  }
  return {
    featurePositions: positions,
    featureScores: new Float32Array(scores),
    featureMinScores: new Float32Array(scores),
    featureMaxScores: new Float32Array(scores),
    numFeatures: n,
    hasSummaryScores: false,
  }
}

describe('computeAutoscaleDomain', () => {
  test('returns min/max for local autoscale', () => {
    const data = makeFeatureArrays([2, 5, 8])
    const entries = [{ data, visStart: 0, visEnd: 300 }]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries)
    expect(result).toEqual([2, 8])
  })

  test('returns undefined for empty entries', () => {
    const result = computeAutoscaleDomain('local', 'avg', 3, [])
    expect(result).toBeUndefined()
  })

  test('localsd uses mean ± stddev', () => {
    const data = makeFeatureArrays([10, 10, 10, 10])
    const entries = [{ data, visStart: 0, visEnd: 400 }]
    const result = computeAutoscaleDomain('localsd', 'avg', 3, entries)
    expect(result).toBeDefined()
    expect(result![0]).toBeLessThanOrEqual(10)
    expect(result![1]).toBeGreaterThanOrEqual(10)
  })

  test('localsd result is always finite (regression: numStdDev=undefined caused NaN)', () => {
    const data = makeFeatureArrays([5, 10, 15])
    const entries = [{ data, visStart: 0, visEnd: 300 }]
    const result = computeAutoscaleDomain('localsd', 'avg', 3, entries)
    expect(result).toBeDefined()
    expect(Number.isFinite(result![0])).toBe(true)
    expect(Number.isFinite(result![1])).toBe(true)
    // non-negative scores: min clamps to 0, max extends beyond the largest score
    expect(result![0]).toBe(0)
    expect(result![1]).toBeGreaterThan(15)
  })

  test('localsd only considers visible features', () => {
    // features: [0,100]=score 1, [100,200]=score 100 (outside visible [0,100])
    const data = makeFeatureArrays([1, 100, 5])
    const visEntries = [{ data, visStart: 0, visEnd: 100 }]
    const result = computeAutoscaleDomain('localsd', 'avg', 3, visEntries)
    expect(result).toBeDefined()
    // only score=1 visible; stddev=0 → max = 1+3*0 = 1
    expect(result![0]).toBe(0)
    expect(result![1]).toBeCloseTo(1)
  })

  test('filters features outside visible range', () => {
    const data = makeFeatureArrays([1, 100, 5])
    const entries = [{ data, visStart: 0, visEnd: 100 }]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries)
    expect(result).toEqual([1, 1])
  })

  test('handles negative scores', () => {
    const data = makeFeatureArrays([-10, -2, 5])
    const entries = [{ data, visStart: 0, visEnd: 300 }]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries)
    expect(result).toEqual([-10, 5])
  })

  test('handles single feature', () => {
    const data = makeFeatureArrays([42])
    const entries = [{ data, visStart: 0, visEnd: 100 }]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries)
    expect(result).toEqual([42, 42])
  })

  test('whiskers mode uses min/max scores', () => {
    const data = {
      featurePositions: new Uint32Array([0, 100, 100, 200]),
      featureScores: new Float32Array([5, 8]),
      featureMinScores: new Float32Array([1, 3]),
      featureMaxScores: new Float32Array([10, 15]),
      numFeatures: 2,
      hasSummaryScores: true,
    }
    const entries = [{ data, visStart: 0, visEnd: 200 }]
    const result = computeAutoscaleDomain('local', 'whiskers', 3, entries)
    expect(result).toEqual([1, 15])
  })

  test('localpercentile clips a high outlier off the top', () => {
    // 99 features at score 1, one spike at 1000. local would scale to 1000;
    // localpercentile (0.99) should clip the spike and stay near 1.
    const scores = Array.from({ length: 99 }, () => 1)
    scores.push(1000)
    const data = makeFeatureArrays(scores)
    const entries = [{ data, visStart: 0, visEnd: 100 * scores.length }]
    const local = computeAutoscaleDomain('local', 'avg', 3, entries)
    const pct = computeAutoscaleDomain(
      'localpercentile',
      'avg',
      3,
      entries,
      0.99,
    )
    expect(local).toEqual([1, 1000])
    expect(pct![0]).toBe(0)
    expect(pct![1]).toBeLessThan(1000)
  })

  test('localpercentile pins low bound at 0 for all-positive data', () => {
    const data = makeFeatureArrays([2, 5, 8])
    const entries = [{ data, visStart: 0, visEnd: 300 }]
    const result = computeAutoscaleDomain(
      'localpercentile',
      'avg',
      3,
      entries,
      0.99,
    )
    expect(result![0]).toBe(0)
  })

  test('localpercentile keeps a sparse negative tail visible (bidirectional)', () => {
    // 95 positive + 5 negative features (like phyloP: mostly conserved with a
    // small accelerated tail). A single combined 1st-percentile min lands >= 0
    // and flattens the negatives; each side must clip independently so the
    // negative extent survives.
    const scores = [...Array.from({ length: 95 }, () => 3), -1, -2, -3, -4, -5]
    const data = makeFeatureArrays(scores)
    const entries = [{ data, visStart: 0, visEnd: 100 * scores.length }]
    const result = computeAutoscaleDomain(
      'localpercentile',
      'avg',
      3,
      entries,
      0.99,
    )
    expect(result![0]).toBeLessThan(0)
    expect(result![0]).toBeLessThanOrEqual(-4)
    expect(result![1]).toBeGreaterThan(0)
  })

  test('localpercentile whiskers uses min/max arrays for each side', () => {
    // Bottom whiskers reach -8, top whiskers +12; the domain must open up to the
    // whisker spread on each side, not just the average scores.
    const data = {
      featurePositions: new Uint32Array([0, 100, 100, 200]),
      featureScores: new Float32Array([1, 2]),
      featureMinScores: new Float32Array([-8, -6]),
      featureMaxScores: new Float32Array([10, 12]),
      numFeatures: 2,
      hasSummaryScores: true,
    }
    const entries = [{ data, visStart: 0, visEnd: 200 }]
    const result = computeAutoscaleDomain(
      'localpercentile',
      'whiskers',
      3,
      entries,
      0.99,
    )
    expect(result![0]).toBeLessThanOrEqual(-8)
    expect(result![1]).toBeGreaterThanOrEqual(12)
  })

  test('multiple regions combined', () => {
    const data1 = makeFeatureArrays([2, 4])
    const data2 = makeFeatureArrays([6, 10])
    const entries = [
      { data: data1, visStart: 0, visEnd: 200 },
      { data: data2, visStart: 0, visEnd: 200 },
    ]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries)
    expect(result).toEqual([2, 10])
  })
})
