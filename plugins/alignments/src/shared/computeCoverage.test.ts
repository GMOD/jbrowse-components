import {
  computeCoverage,
  computeNoncovCoverage,
  computePositionFrequencies,
  applyDepthDependentThreshold,
} from './computeCoverage.ts'
import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'

describe('computeCoverage', () => {
  it('returns empty for no features', () => {
    const result = computeCoverage([], [], 100, 200)
    expect(result.depths.length).toBe(0)
    expect(result.maxDepth).toBe(0)
    expect(result.startOffset).toBe(0)
  })

  it('computes depth for a single feature within region', () => {
    const features = [{ start: 100, end: 110 }]
    const result = computeCoverage(features, [], 100, 200)
    expect(result.startOffset).toBe(0)
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
    // startOffset should be 0 (clamped to regionStart), not -10
    expect(result.startOffset).toBe(0)
    // First bin is at regionStart=100, where the first feature already
    // overlaps (started at 90), so depth should be >= 1
    expect(result.depths[0]).toBeGreaterThanOrEqual(1)
  })

  it('extends coverage past regionEnd for features that overlap', () => {
    const features = [{ start: 100, end: 250 }]
    const result = computeCoverage(features, [], 100, 200)
    expect(result.startOffset).toBe(0)
    // Coverage should extend to feature end (250), 150 bins past regionStart
    expect(result.depths.length).toBe(150)
    expect(result.maxDepth).toBe(1)
  })

  it('handles overlapping features', () => {
    const features = [
      { start: 100, end: 120 },
      { start: 110, end: 130 },
    ]
    const result = computeCoverage(features, [], 100, 200)
    // At position 115 (index 15), both features overlap
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
    // At position 107 (index 7), the gap reduces depth by 1
    expect(result.depths[7]).toBe(0)
    // Outside the gap, depth should be 1
    expect(result.depths[2]).toBe(1)
  })
})

describe('computePositionFrequencies (interbase depth)', () => {
  it('uses max of left and right depth for interbase features', () => {
    // Coverage ramp: [5, 10, 15, 20]
    const coverageDepths = new Float32Array([5, 10, 15, 20])
    // Insertion at position offset 2 sits between depth[1]=10 and depth[2]=15
    const positions = new Uint32Array([2])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    // depth = max(10, 15) = 15, count = 1, freq = 1/15
    expect(freqs[0]).toBe(Math.round((1 / 15) * 255))
  })

  it('handles insertion at left edge (no left neighbor)', () => {
    const coverageDepths = new Float32Array([10, 20, 30])
    // Position offset 0: left is index -1 (out of bounds → 0), right is index 0 = 10
    const positions = new Uint32Array([0])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    // depth = max(0, 10) = 10, count = 1, freq = 1/10
    expect(freqs[0]).toBe(Math.round(0.1 * 255))
  })

  it('handles insertion at right edge (no right neighbor)', () => {
    const coverageDepths = new Float32Array([10, 20, 30])
    // Position offset 3: left is index 2 = 30, right is index 3 (out of bounds → 0)
    const positions = new Uint32Array([3])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    // depth = max(30, 0) = 30, count = 1, freq = 1/30
    expect(freqs[0]).toBe(Math.round((1 / 30) * 255))
  })

  it('counts multiple insertions at same position', () => {
    const coverageDepths = new Float32Array([10, 20])
    // Two insertions at the same position offset 1
    const positions = new Uint32Array([1, 1])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    // depth = max(10, 20) = 20, count = 2, freq = 2/20 = 0.1
    expect(freqs[0]).toBe(Math.round(0.1 * 255))
    expect(freqs[1]).toBe(Math.round(0.1 * 255))
  })

  it('handles coverageStartOffset correctly', () => {
    const coverageDepths = new Float32Array([5, 10, 15])
    // coverageStartOffset=10 means position 12 maps to depthIdx=2
    const positions = new Uint32Array([12])
    const freqs = computePositionFrequencies(positions, coverageDepths, 10)
    // depthIdx = 12 - 10 = 2, left=depth[1]=10, right=depth[2]=15
    // depth = max(10, 15) = 15
    expect(freqs[0]).toBe(Math.round((1 / 15) * 255))
  })

  it('at a coverage cliff, uses the higher side', () => {
    // Simulates a soft clip at read boundary: high coverage drops to zero
    const coverageDepths = new Float32Array([50, 50, 50, 0, 0])
    // Insertion at position 3: left=depth[2]=50, right=depth[3]=0
    const positions = new Uint32Array([3])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    // depth = max(50, 0) = 50, freq = 1/50 = 0.02
    expect(freqs[0]).toBe(Math.round(0.02 * 255))
  })
})

describe('applyDepthDependentThreshold (interbase mode)', () => {
  it('zeroes frequencies below threshold for interbase features', () => {
    const coverageDepths = new Float32Array([10, 20, 30])
    const positions = new Uint32Array([1, 2])
    const frequencies = new Uint8Array([
      Math.round(0.05 * 255), // 5% frequency
      Math.round(0.5 * 255), // 50% frequency
    ])
    // Threshold: anything below 10% should be zeroed
    applyDepthDependentThreshold(
      frequencies,
      positions,
      coverageDepths,
      0,
      () => 0.1,
      true,
    )
    expect(frequencies[0]).toBe(0) // 5% < 10% threshold → zeroed
    expect(frequencies[1]).toBe(Math.round(0.5 * 255)) // 50% > 10% → kept
  })

  it('uses interbase depth (max of neighbors) when interbase=true', () => {
    // Coverage cliff: [100, 0]
    const coverageDepths = new Float32Array([100, 0])
    const positions = new Uint32Array([1])
    // freq = 1/100 = 1% (using interbase depth max(100, 0) = 100)
    const frequencies = new Uint8Array([Math.round(0.01 * 255)])
    applyDepthDependentThreshold(
      frequencies,
      positions,
      coverageDepths,
      0,
      () => 0.005, // 0.5% threshold — 1% > 0.5%, so should be kept
      true,
    )
    expect(frequencies[0]).toBe(Math.round(0.01 * 255))
  })
})

describe('computeNoncovCoverage (indicator triangles)', () => {
  it('returns empty when no insertions/clips', () => {
    const result = computeNoncovCoverage([], [], [], 10, 100)
    expect(result.indicatorCount).toBe(0)
    expect(result.segmentCount).toBe(0)
  })

  it('creates indicator when insertion frequency exceeds threshold', () => {
    // 10 insertions at position 105, local depth = 20
    const insertions = Array.from({ length: 10 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(20)
    const result = computeNoncovCoverage(insertions, [], [], 20, 100, depths, 0)
    // 10 insertions > 20 * 0.3 = 6, localDepth=20 >= 7
    expect(result.indicatorCount).toBe(1)
    expect(result.indicatorColorTypes[0]).toBe(1) // insertion type
  })

  it('does not create indicator when frequency is below threshold', () => {
    // 2 insertions at position 105, local depth = 20
    const insertions = [
      { position: 105, length: 5 },
      { position: 105, length: 3 },
    ]
    const depths = new Float32Array(20).fill(20)
    const result = computeNoncovCoverage(insertions, [], [], 20, 100, depths, 0)
    // 2 insertions <= 20 * 0.3 = 6, below threshold
    expect(result.indicatorCount).toBe(0)
  })

  it('does not create indicator when local depth is below minimum', () => {
    // 5 insertions at position 105, but local depth = 5
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(5)
    const result = computeNoncovCoverage(insertions, [], [], 5, 100, depths, 0)
    // localDepth=5 < MINIMUM_INDICATOR_READ_DEPTH=8
    expect(result.indicatorCount).toBe(0)
  })

  it('uses local depth not global maxDepth for threshold', () => {
    // Position 105 has local depth 50, but global max might be higher
    // 20 insertions → 20 > 50 * 0.3 = 15, should show indicator
    const insertions = Array.from({ length: 20 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(50)
    const result = computeNoncovCoverage(insertions, [], [], 50, 100, depths, 0)
    expect(result.indicatorCount).toBe(1)
  })

  it('selects dominant type for indicator color', () => {
    // 4 insertions + 6 softclips at same position
    const insertions = Array.from({ length: 4 }, () => ({
      position: 105,
      length: 5,
    }))
    const softclips = Array.from({ length: 6 }, () => ({
      position: 105,
      length: 10,
    }))
    const depths = new Float32Array(20).fill(20)
    const result = computeNoncovCoverage(
      insertions,
      softclips,
      [],
      20,
      100,
      depths,
      0,
    )
    // Total = 10 > 20 * 0.3 = 6; softclip (6) > insertion (4), so type = 2
    expect(result.indicatorCount).toBe(1)
    expect(result.indicatorColorTypes[0]).toBe(2) // softclip dominant
  })

  it('does not create indicator at depth 7 (below minimum 8)', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(7)
    const result = computeNoncovCoverage(insertions, [], [], 7, 100, depths, 0)
    expect(result.indicatorCount).toBe(0)
  })

  it('creates indicator at depth 8 (minimum threshold)', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(8)
    const result = computeNoncovCoverage(insertions, [], [], 8, 100, depths, 0)
    // 5 > 8 * 0.3 = 2.4, localDepth=8 >= 8
    expect(result.indicatorCount).toBe(1)
  })
})

describe('featureFrequencyThreshold', () => {
  it('returns 0.6 for shallow coverage (depth < 10)', () => {
    expect(featureFrequencyThreshold(0)).toBe(0.6)
    expect(featureFrequencyThreshold(5)).toBe(0.6)
    expect(featureFrequencyThreshold(9)).toBe(0.6)
  })

  it('returns 0.1 for deep coverage (depth >= 40)', () => {
    expect(featureFrequencyThreshold(40)).toBe(0.1)
    expect(featureFrequencyThreshold(100)).toBe(0.1)
    expect(featureFrequencyThreshold(1000)).toBe(0.1)
  })

  it('interpolates between 0.6 and 0.2 for depth 10-30', () => {
    // At depth 20 (midpoint of 10-30): 0.6 + (10/20) * (0.2-0.6) = 0.6 - 0.2 = 0.4
    expect(featureFrequencyThreshold(20)).toBeCloseTo(0.4, 5)
    expect(featureFrequencyThreshold(10)).toBeCloseTo(0.6, 5)
    expect(featureFrequencyThreshold(30)).toBeCloseTo(0.2, 5)
  })

  it('interpolates between 0.2 and 0.1 for depth 30-40', () => {
    // At depth 35 (midpoint of 30-40): 0.2 + (5/10) * (0.1-0.2) = 0.2 - 0.05 = 0.15
    expect(featureFrequencyThreshold(35)).toBeCloseTo(0.15, 5)
  })

  it('is monotonically decreasing', () => {
    let prev = featureFrequencyThreshold(0)
    for (let d = 1; d <= 50; d++) {
      const curr = featureFrequencyThreshold(d)
      expect(curr).toBeLessThanOrEqual(prev)
      prev = curr
    }
  })
})
