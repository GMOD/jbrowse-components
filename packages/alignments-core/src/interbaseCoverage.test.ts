import { alleleFilterProblems } from './coverageAllelesConfigSchema.ts'
import {
  interbaseFilterProblems,
  interbaseIndicatorRuleOf,
} from './coverageInterbaseConfigSchema.ts'
import { computeInterbaseCoverage } from './interbaseCoverage.ts'
import { readInterbaseSegments } from './interbaseSegments.ts'

function cov(depths: Float32Array, maxDepth: number, startPos = 100) {
  return { depths, maxDepth, startPos }
}

// The compute writes the histogram's packed instance buffer directly, so the
// assertions read it back through the same decoder the hit test uses.
function segments(result: ReturnType<typeof computeInterbaseCoverage>) {
  const r = readInterbaseSegments(result.interbasePackedBuffer)
  return Array.from({ length: r.count }, (_, i) => ({
    position: r.position(i),
    stackEnd: r.stackEnd(i),
    colorType: r.colorType(i),
  }))
}

function indicators(result: ReturnType<typeof computeInterbaseCoverage>) {
  return Array.from(result.indicatorPositions, (position, i) => ({
    position,
    colorType: result.indicatorTypes[i],
  }))
}

describe('computeInterbaseCoverage (indicator triangles)', () => {
  it('returns empty when no insertions/clips', () => {
    const result = computeInterbaseCoverage(
      [],
      [],
      [],
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
      cov(new Float32Array(20).fill(8), 8),
    )
    expect(result.indicatorCount).toBe(1)
  })

  it('takes its depth and share from the interbase filter', () => {
    const insertions = Array.from({ length: 5 }, () => ({
      position: 105,
      length: 5,
    }))
    const shallow = cov(new Float32Array(20).fill(7), 7)
    const rule = interbaseIndicatorRuleOf([{ field: 'depth', gte: 4 }])
    expect(rule).toEqual({
      depth: { min: 4, strict: false },
      fraction: { min: 0.3, strict: true },
    })
    expect(
      computeInterbaseCoverage(insertions, [], [], shallow, rule)
        .indicatorCount,
    ).toBe(1)
    const strict = interbaseIndicatorRuleOf([
      { field: 'depth', gte: 4 },
      { field: 'fraction', gt: 0.9 },
    ])
    expect(
      computeInterbaseCoverage(insertions, [], [], shallow, strict)
        .indicatorCount,
    ).toBe(0)
    expect(interbaseIndicatorRuleOf([{ field: 'depth' }])).toEqual({
      depth: { min: 0, strict: false },
      fraction: { min: 0.3, strict: true },
    })
  })

  it('honors gt and gte as written, the default at depth 8 and above 0.3', () => {
    const insertions = (n: number) =>
      Array.from({ length: n }, () => ({ position: 105, length: 5 }))
    const count = (n: number, depth: number, filter?: unknown) =>
      computeInterbaseCoverage(
        insertions(n),
        [],
        [],
        cov(new Float32Array(20).fill(depth), depth),
        filter === undefined ? undefined : interbaseIndicatorRuleOf(filter),
      ).indicatorCount
    expect(count(5, 8)).toBe(1)
    expect(count(5, 8, [{ field: 'depth', gt: 8 }])).toBe(0)
    expect(count(5, 9, [{ field: 'depth', gt: 8 }])).toBe(1)
    expect(count(3, 10)).toBe(0)
    expect(count(3, 10, [{ field: 'fraction', gte: 0.3 }])).toBe(1)
    expect(count(3, 10, [{ field: 'fraction', gt: 0.3 }])).toBe(0)
    expect(
      interbaseIndicatorRuleOf([
        { field: 'fraction', gte: 0.3 },
        { field: 'fraction', gt: 0.3 },
      ]).fraction,
    ).toEqual({ min: 0.3, strict: true })
  })

  it('names a test the triangle rule cannot apply', () => {
    expect(
      interbaseFilterProblems([
        { field: 'depth', gt: 8 },
        { field: 'fraction', gte: 0.2 },
      ]),
    ).toEqual([])
    expect(interbaseFilterProblems([{ field: 'depth', lte: 4 }])).toEqual([
      'coverage.interbase.filter: depth takes gte or gt, not {"field":"depth","lte":4}',
    ])
    expect(interbaseFilterProblems([{ field: 'fraction', gt: 30 }])).toEqual([
      'coverage.interbase.filter: fraction runs from 0 to 1, not {"field":"fraction","gt":30}',
    ])
    expect(alleleFilterProblems([{ field: 'fraction', gt: 0.2 }])).toEqual([
      'coverage.alleles.filter: fraction takes gte, not {"field":"fraction","gt":0.2}',
    ])
  })

  it('stacks one segment per non-empty type, accumulating yOffset', () => {
    const result = computeInterbaseCoverage(
      [{ position: 105, length: 5 }],
      [
        { position: 105, length: 10 },
        { position: 105, length: 10 },
      ],
      [{ position: 105, length: 3 }],
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
      cov(new Float32Array(40).fill(10), 10),
    )
    expect(segments(result).map(s => s.position)).toEqual([105, 110, 120, 130])
  })
})
