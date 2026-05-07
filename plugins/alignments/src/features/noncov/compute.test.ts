import { computeNoncovCoverage } from './compute.ts'

function cov(depths: Float32Array, maxDepth: number, startPos = 100) {
  return { depths, maxDepth, startPos }
}

describe('computeNoncovCoverage (indicator triangles)', () => {
  it('returns empty when no insertions/clips', () => {
    const result = computeNoncovCoverage(
      [],
      [],
      [],
      100,
      cov(new Float32Array(0), 10),
    )
    expect(result.indicatorCount).toBe(0)
    expect(result.segmentCount).toBe(0)
  })

  it('creates indicator when insertion frequency exceeds threshold', () => {
    const insertions = Array.from({ length: 10 }, () => ({
      position: 105,
      length: 5,
    }))
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(20), 20),
    )
    expect(result.indicatorCount).toBe(1)
    expect(result.indicatorColorTypes[0]).toBe(1)
  })

  it('does not create indicator when frequency is below threshold', () => {
    const insertions = [
      { position: 105, length: 5 },
      { position: 105, length: 3 },
    ]
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(20), 20),
    )
    expect(result.indicatorCount).toBe(0)
  })

  it('does not create indicator when local depth is below minimum', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(5), 5),
    )
    expect(result.indicatorCount).toBe(0)
  })

  it('uses local depth not global maxDepth for threshold', () => {
    const insertions = Array.from({ length: 20 }, () => ({
      position: 105,
      length: 5,
    }))
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(50), 50),
    )
    expect(result.indicatorCount).toBe(1)
  })

  it('selects dominant type for indicator color', () => {
    const insertions = Array.from({ length: 4 }, () => ({
      position: 105,
      length: 5,
    }))
    const softclips = Array.from({ length: 6 }, () => ({
      position: 105,
      length: 10,
    }))
    const result = computeNoncovCoverage(
      insertions,
      softclips,
      [],
      100,
      cov(new Float32Array(20).fill(20), 20),
    )
    expect(result.indicatorCount).toBe(1)
    expect(result.indicatorColorTypes[0]).toBe(2)
  })

  it('does not create indicator at depth 7 (below minimum 8)', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(7), 7),
    )
    expect(result.indicatorCount).toBe(0)
  })

  it('creates indicator at depth 8 (minimum threshold)', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(8), 8),
    )
    expect(result.indicatorCount).toBe(1)
  })
})
