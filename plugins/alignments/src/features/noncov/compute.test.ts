import { computeNoncovCoverage } from './compute.ts'

describe('computeNoncovCoverage (indicator triangles)', () => {
  it('returns empty when no insertions/clips', () => {
    const result = computeNoncovCoverage([], [], [], 10, 100)
    expect(result.indicatorCount).toBe(0)
    expect(result.segmentCount).toBe(0)
  })

  it('creates indicator when insertion frequency exceeds threshold', () => {
    const insertions = Array.from({ length: 10 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(20)
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      20,
      100,
      depths,
      100,
    )
    expect(result.indicatorCount).toBe(1)
    expect(result.indicatorColorTypes[0]).toBe(1)
  })

  it('does not create indicator when frequency is below threshold', () => {
    const insertions = [
      { position: 105, length: 5 },
      { position: 105, length: 3 },
    ]
    const depths = new Float32Array(20).fill(20)
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      20,
      100,
      depths,
      100,
    )
    expect(result.indicatorCount).toBe(0)
  })

  it('does not create indicator when local depth is below minimum', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(5)
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      5,
      100,
      depths,
      100,
    )
    expect(result.indicatorCount).toBe(0)
  })

  it('uses local depth not global maxDepth for threshold', () => {
    const insertions = Array.from({ length: 20 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(50)
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      50,
      100,
      depths,
      100,
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
    const depths = new Float32Array(20).fill(20)
    const result = computeNoncovCoverage(
      insertions,
      softclips,
      [],
      20,
      100,
      depths,
      100,
    )
    expect(result.indicatorCount).toBe(1)
    expect(result.indicatorColorTypes[0]).toBe(2)
  })

  it('does not create indicator at depth 7 (below minimum 8)', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(7)
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      7,
      100,
      depths,
      100,
    )
    expect(result.indicatorCount).toBe(0)
  })

  it('creates indicator at depth 8 (minimum threshold)', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const depths = new Float32Array(20).fill(8)
    const result = computeNoncovCoverage(
      insertions,
      [],
      [],
      8,
      100,
      depths,
      100,
    )
    expect(result.indicatorCount).toBe(1)
  })
})
