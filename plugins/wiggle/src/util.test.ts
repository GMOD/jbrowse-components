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

test('test inverted', () => {
  const scaleType = 'log'
  const inverted = true
  const domain = [1, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range, inverted })
  expect(scale.domain()).toEqual([1, 128])
  expect(scale.range()).toEqual(range.reverse())
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
  }
}

describe('computeAutoscaleDomain', () => {
  test('returns min/max for local autoscale', () => {
    const data = makeFeatureArrays([2, 5, 8])
    const entries = [{ data, visStart: 0, visEnd: 300 }]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries, entries)
    expect(result).toEqual([2, 8])
  })

  test('returns undefined for empty entries', () => {
    const result = computeAutoscaleDomain('local', 'avg', 3, [], [])
    expect(result).toBeUndefined()
  })

  test('uses global entries when autoscaleType is global', () => {
    const visible = makeFeatureArrays([3, 5])
    const all = makeFeatureArrays([1, 3, 5, 10])
    const visEntries = [{ data: visible, visStart: 0, visEnd: 200 }]
    const allEntries = [{ data: all }]
    const result = computeAutoscaleDomain(
      'global',
      'avg',
      3,
      visEntries,
      allEntries,
    )
    expect(result).toEqual([1, 10])
  })

  test('localsd uses mean ± stddev', () => {
    const data = makeFeatureArrays([10, 10, 10, 10])
    const entries = [{ data, visStart: 0, visEnd: 400 }]
    const result = computeAutoscaleDomain('localsd', 'avg', 3, entries, entries)
    expect(result).toBeDefined()
    expect(result![0]).toBeLessThanOrEqual(10)
    expect(result![1]).toBeGreaterThanOrEqual(10)
  })

  test('filters features outside visible range', () => {
    const data = makeFeatureArrays([1, 100, 5])
    const entries = [{ data, visStart: 0, visEnd: 100 }]
    const allEntries = [{ data }]
    const result = computeAutoscaleDomain(
      'local',
      'avg',
      3,
      entries,
      allEntries,
    )
    expect(result).toEqual([1, 1])
  })

  test('handles negative scores', () => {
    const data = makeFeatureArrays([-10, -2, 5])
    const entries = [{ data, visStart: 0, visEnd: 300 }]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries, entries)
    expect(result).toEqual([-10, 5])
  })

  test('handles single feature', () => {
    const data = makeFeatureArrays([42])
    const entries = [{ data, visStart: 0, visEnd: 100 }]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries, entries)
    expect(result).toEqual([42, 42])
  })

  test('whiskers mode uses min/max scores', () => {
    const data = {
      featurePositions: new Uint32Array([0, 100, 100, 200]),
      featureScores: new Float32Array([5, 8]),
      featureMinScores: new Float32Array([1, 3]),
      featureMaxScores: new Float32Array([10, 15]),
      numFeatures: 2,
    }
    const entries = [{ data, visStart: 0, visEnd: 200 }]
    const result = computeAutoscaleDomain(
      'local',
      'whiskers',
      3,
      entries,
      entries,
    )
    expect(result).toEqual([1, 15])
  })

  test('multiple regions combined', () => {
    const data1 = makeFeatureArrays([2, 4])
    const data2 = makeFeatureArrays([6, 10])
    const entries = [
      { data: data1, visStart: 0, visEnd: 200 },
      { data: data2, visStart: 0, visEnd: 200 },
    ]
    const result = computeAutoscaleDomain('local', 'avg', 3, entries, entries)
    expect(result).toEqual([2, 10])
  })
})
