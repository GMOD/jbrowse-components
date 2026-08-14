import {
  computeInterbaseCoverage,
  readIndicators,
  readInterbaseSegments,
} from '@jbrowse/alignments-core'

function cov(depths: Float32Array, maxDepth: number, startPos = 100) {
  return { depths, maxDepth, startPos }
}

// The compute writes the packed instance buffers directly, so the assertions
// read them back through the same decoder the hit test uses.
function segments(result: ReturnType<typeof computeInterbaseCoverage>) {
  const r = readInterbaseSegments(result.interbasePackedBuffer)
  return Array.from({ length: r.count }, (_, i) => ({
    position: r.position(i),
    stackEnd: r.stackEnd(i),
    colorType: r.colorType(i),
  }))
}

function indicators(result: ReturnType<typeof computeInterbaseCoverage>) {
  const r = readIndicators(result.indicatorPackedBuffer)
  return Array.from({ length: r.count }, (_, i) => ({
    position: r.position(i),
    colorType: r.colorType(i),
  }))
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
    expect(indicators(result)[0]!.colorType).toBe(1)
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
    expect(indicators(result)[0]!.colorType).toBe(2)
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
    // (ins, soft, hard) with heights count/scale, stacked so each segment's
    // stackEnd is the running total.
    expect(result.segmentCount).toBe(3)
    const segs = segments(result)
    expect(segs.map(s => [s.position, s.colorType])).toEqual([
      [105, 1],
      [105, 2],
      [105, 3],
    ])
    // Counts 1/2/1 against a peak depth of 10, so the stack ends at the
    // running total of 0.1, 0.2 and 0.1.
    expect(segs[0]!.stackEnd).toBeCloseTo(0.1)
    expect(segs[1]!.stackEnd).toBeCloseTo(0.3)
    expect(segs[2]!.stackEnd).toBeCloseTo(0.4)
  })

  // Ascending order is a contract, not an accident of the input: the hit test
  // binary-searches these positions, and reads arrive in start order, not in
  // interbase-event order. Softclips are bumped into the map after every
  // insertion, so a softclip left of an insertion is the case that the Map's
  // own iteration order gets wrong.
  it('emits positions in ascending order whatever order events arrive in', () => {
    const result = computeInterbaseCoverage(
      [
        { position: 130, length: 5 },
        { position: 110, length: 5 },
      ],
      [{ position: 105, length: 9 }],
      [{ position: 120, length: 4 }],
      100,
      cov(new Float32Array(40).fill(10), 10),
    )
    expect(segments(result).map(s => s.position)).toEqual([105, 110, 120, 130])
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
