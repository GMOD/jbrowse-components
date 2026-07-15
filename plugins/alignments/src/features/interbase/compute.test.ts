import { computeInterbaseCoverage } from '@jbrowse/alignments-core'

function cov(depths: Float32Array, maxDepth: number, startPos = 100) {
  return { depths, maxDepth, startPos }
}

describe('computeInterbaseCoverage (indicator triangles)', () => {
  it('returns empty when no insertions/clips', () => {
    const result = computeInterbaseCoverage(
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
    const result = computeInterbaseCoverage(
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
    const result = computeInterbaseCoverage(
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
    const result = computeInterbaseCoverage(
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
    const result = computeInterbaseCoverage(
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
    const result = computeInterbaseCoverage(
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
    const result = computeInterbaseCoverage(
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
    const result = computeInterbaseCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(8), 8),
    )
    expect(result.indicatorCount).toBe(1)
  })

  it('stacks one segment per non-empty type, accumulating yOffset', () => {
    const result = computeInterbaseCoverage(
      [{ position: 105, length: 5 }],
      [
        { position: 105, length: 10 },
        { position: 105, length: 10 },
      ],
      [{ position: 105, length: 3 }],
      100,
      cov(new Float32Array(20).fill(10), 10),
    )
    // 1 insertion + 2 softclips + 1 hardclip at one position => 3 segments
    // (ins, soft, hard) with heights count/scale and stacked yOffsets.
    expect(result.segmentCount).toBe(3)
    expect([...result.colorTypes]).toEqual([1, 2, 3])
    expect([...result.heights]).toEqual([...new Float32Array([0.1, 0.2, 0.1])])
    expect([...result.yOffsets]).toEqual([...new Float32Array([0, 0.1, 0.3])])
    expect([...result.positions]).toEqual([105, 105, 105])
  })

  it('drops events left of regionStart from segments and indicators', () => {
    const insertions = Array.from({ length: 10 }, () => ({
      position: 99,
      length: 5,
    }))
    const result = computeInterbaseCoverage(
      insertions,
      [],
      [],
      100,
      cov(new Float32Array(20).fill(20), 20),
    )
    expect(result.segmentCount).toBe(0)
    expect(result.indicatorCount).toBe(0)
  })
})
