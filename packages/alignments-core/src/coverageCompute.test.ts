import { computeCoverage } from './coverageCompute.ts'

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

  it('omits per-strand depths unless tracking is enabled', () => {
    const features = [{ start: 100, end: 110, strand: 1 }]
    const result = computeCoverage(features, [], 100, 200)
    expect(result.fwdDepths).toBeUndefined()
    expect(result.revDepths).toBeUndefined()
  })

  it('splits depth by strand, fwd + rev == total at every bin', () => {
    const features = [
      { start: 100, end: 120, strand: 1 },
      { start: 110, end: 130, strand: -1 },
    ]
    const result = computeCoverage(features, [], 100, 200, true)
    const { depths, fwdDepths, revDepths } = result
    expect(fwdDepths).toBeDefined()
    expect(revDepths).toBeDefined()
    for (let i = 0; i < depths.length; i++) {
      expect(fwdDepths![i]! + revDepths![i]!).toBe(depths[i])
    }
    // fwd-only region, overlap, rev-only region
    expect(fwdDepths![5]).toBe(1)
    expect(revDepths![5]).toBe(0)
    expect(fwdDepths![15]).toBe(1)
    expect(revDepths![15]).toBe(1)
    expect(fwdDepths![25]).toBe(0)
    expect(revDepths![25]).toBe(1)
  })

  it('subtracts a deletion gap from only its strand', () => {
    const features = [
      { start: 100, end: 120, strand: 1 },
      { start: 100, end: 120, strand: -1 },
    ]
    const gaps = [
      {
        start: 105,
        end: 110,
        type: 'deletion' as const,
        strand: 1,
        featureStrand: 1,
      },
    ]
    const result = computeCoverage(features, gaps, 100, 200, true)
    // bin 7 sits inside the fwd-strand deletion: fwd drops, rev unaffected
    expect(result.fwdDepths![7]).toBe(0)
    expect(result.revDepths![7]).toBe(1)
    expect(result.depths[7]).toBe(1)
  })
})
