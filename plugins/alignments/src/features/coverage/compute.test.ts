import { computeCoverage } from './compute.ts'

describe('computeCoverage', () => {
  it('returns empty for no features', () => {
    const result = computeCoverage([], [], 100, 200)
    expect(result.depths.length).toBe(0)
    expect(result.maxDepth).toBe(0)
    expect(result.startPos).toBe(0)
  })

  it('computes depth for a single feature within region', () => {
    const features = [{ start: 100, end: 110 }]
    const result = computeCoverage(features, [], 100, 200)
    expect(result.startPos).toBe(100)
    for (let i = 0; i < 10; i++) {
      expect(result.depths[i]).toBe(1)
    }
    expect(result.maxDepth).toBe(1)
  })

  it('clamps coverage start to regionStart even when features extend before it', () => {
    const features = [
      { start: 90, end: 110 },
      { start: 100, end: 120 },
    ]
    const result = computeCoverage(features, [], 100, 200)
    expect(result.startPos).toBe(100)
    expect(result.depths[0]).toBeGreaterThanOrEqual(1)
  })

  it('extends coverage past regionEnd for features that overlap', () => {
    const features = [{ start: 100, end: 250 }]
    const result = computeCoverage(features, [], 100, 200)
    expect(result.startPos).toBe(100)
    expect(result.depths.length).toBe(150)
    expect(result.maxDepth).toBe(1)
  })

  it('handles overlapping features', () => {
    const features = [
      { start: 100, end: 120 },
      { start: 110, end: 130 },
    ]
    const result = computeCoverage(features, [], 100, 200)
    expect(result.depths[15]).toBe(2)
    expect(result.maxDepth).toBe(2)
  })

  it('accounts for gaps (deletions) reducing depth', () => {
    const features = [{ start: 100, end: 120, strand: 1 }]
    const gaps = [
      {
        start: 105,
        end: 110,
        type: 'deletion' as const,
        strand: 1,
        featureStrand: 1,
      },
    ]
    const result = computeCoverage(features, gaps, 100, 200)
    expect(result.depths[7]).toBe(0)
    expect(result.depths[2]).toBe(1)
  })
})
