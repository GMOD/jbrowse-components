import {
  buildCoverageTooltipBin,
  computeCoverageTicks,
  computeVisibleCoverageStats,
  countSnpsAtPosition,
  downsampleDenseMax,
  downsampleMinMax,
  downsampleStatsBins,
} from './coverageDownsampling.ts'

import type { CoverageRegion } from './coverageDownsampling.ts'

describe('computeCoverageTicks', () => {
  test('produces nice round tick values', () => {
    const result = computeCoverageTicks(100, 150)
    expect(result.yTop).toBe(5)
    expect(result.yBottom).toBe(145)
    // step = 50 for maxDepth=100; ticks at 0, 50, 100
    expect(result.items.map(t => t.value)).toEqual([0, 50, 100])
  })

  test('short height uses only 0 and max ticks', () => {
    const small = computeCoverageTicks(50, 50)
    expect(small.items.length).toBe(2)
    expect(small.items[0]!.value).toBe(0)
    expect(small.items[1]!.value).toBe(50)
  })

  test('tall height uses nice step (more ticks than short)', () => {
    const small = computeCoverageTicks(50, 50)
    const large = computeCoverageTicks(50, 150)
    expect(large.items.length).toBeGreaterThan(small.items.length)
    // all values are multiples of a nice step
    const step = large.items[1]!.value - large.items[0]!.value
    for (const tick of large.items) {
      expect(tick.value % step).toBe(0)
    }
  })

  test('shallow coverage yields integer depth ticks, not fractions', () => {
    // maxDepth < 3 makes niceStep return 0.5; depth is integer-valued so the
    // step floors to 1 (ticks 0, 1, 2 rather than 0, 0.5, 1, 1.5, 2).
    const result = computeCoverageTicks(2, 150)
    expect(result.items.map(t => t.value)).toEqual([0, 1, 2])
  })

  test('tick y values are within bounds', () => {
    const result = computeCoverageTicks(200, 100)
    for (const tick of result.items) {
      expect(tick.y).toBeGreaterThanOrEqual(result.yTop)
      expect(tick.y).toBeLessThanOrEqual(result.yBottom)
    }
  })

  test('log scale with maxDepth=1 produces finite tick positions', () => {
    // logMax is 0 here; the degenerate scale must not yield NaN.
    const result = computeCoverageTicks(1, 150, 'log')
    expect(result.items.length).toBeGreaterThan(0)
    for (const tick of result.items) {
      expect(Number.isFinite(tick.y)).toBe(true)
    }
  })
})

describe('downsampleDenseMax', () => {
  test('returns input verbatim with binSize 1 when it fits', () => {
    const depths = new Float32Array([0, 5, 10, 0, 3])
    const result = downsampleDenseMax(depths, 100)
    expect(result.binSize).toBe(1)
    expect(result.depths).toBe(depths) // same reference, no copy
  })

  test('downsamples to at most maxBins, keeping the peak per bin', () => {
    // 10 bp → 5 bins, binSize 2: each bin is the max of its two bp
    const depths = new Float32Array([1, 9, 4, 2, 7, 7, 0, 0, 3, 8])
    const result = downsampleDenseMax(depths, 5)
    expect(result.binSize).toBe(2)
    expect(result.depths.length).toBe(5)
    expect([...result.depths]).toEqual([9, 4, 7, 0, 8])
  })

  test('dense (index-addressable) — a zero bin is kept, not skipped', () => {
    const depths = new Float32Array([0, 0, 5, 5, 0, 0])
    const result = downsampleDenseMax(depths, 3)
    expect(result.binSize).toBe(2)
    // bin 0 = max(0,0) = 0 is retained so bin b maps to depths[b]
    expect([...result.depths]).toEqual([0, 5, 0])
  })

  test('the global peak survives downsampling', () => {
    const depths = new Float32Array(1000).fill(4)
    depths[517] = 99
    const result = downsampleDenseMax(depths, 10)
    expect(Math.max(...result.depths)).toBe(99)
  })

  test('last bin clamps to the array end when length is not a multiple', () => {
    const depths = new Float32Array([2, 6, 4, 9, 1]) // 5 bp, maxBins 2
    const result = downsampleDenseMax(depths, 2)
    expect(result.binSize).toBe(3)
    // bin0 = max(2,6,4)=6, bin1 = max(9,1)=9 (only 2 bp left)
    expect([...result.depths]).toEqual([6, 9])
  })
})

describe('downsampleStatsBins', () => {
  test('returns empty (binSize 1) when the array fits the cap', () => {
    const depths = new Float32Array([0, 5, 10, 0, 3])
    const result = downsampleStatsBins(depths, 100)
    expect(result.binSize).toBe(1)
    expect(result.mins.length).toBe(0)
    expect(result.maxs.length).toBe(0)
    expect(result.sums.length).toBe(0)
    expect(result.sumSqs.length).toBe(0)
  })

  test('computes per-bin min/max/sum/sumSq', () => {
    // 10 bp → 5 bins, binSize 2
    const depths = new Float32Array([1, 9, 4, 2, 7, 7, 0, 0, 3, 8])
    const result = downsampleStatsBins(depths, 5)
    expect(result.binSize).toBe(2)
    expect([...result.mins]).toEqual([1, 2, 7, 0, 3])
    expect([...result.maxs]).toEqual([9, 4, 7, 0, 8])
    expect([...result.sums]).toEqual([10, 6, 14, 0, 11])
    expect([...result.sumSqs]).toEqual([82, 20, 98, 0, 73])
  })

  test('last (ragged) bin only aggregates the bp it covers', () => {
    const depths = new Float32Array([2, 6, 4, 9, 1]) // 5 bp, cap 2 → binSize 3
    const result = downsampleStatsBins(depths, 2)
    expect(result.binSize).toBe(3)
    expect([...result.maxs]).toEqual([6, 9]) // bin1 only sees [9,1]
    expect([...result.sums]).toEqual([12, 10])
  })
})

describe('computeVisibleCoverageStats', () => {
  function perBpRegion(depths: number[], startPos: number): CoverageRegion {
    return {
      coverageDepths: new Float32Array(depths),
      coverageStartPos: startPos,
    }
  }

  test('per-bp path: min/max/mean over the visible clip', () => {
    const cov = perBpRegion([2, 8, 4, 10, 6], 100)
    const stats = computeVisibleCoverageStats(
      [{ start: 100, end: 105 }],
      () => cov,
    )
    expect(stats!.scoreMin).toBe(2)
    expect(stats!.scoreMax).toBe(10)
    expect(stats!.scoreMean).toBeCloseTo(6)
  })

  test('per-bp path clips to the visible block range', () => {
    // depth 100 sits at genomic 102, outside the [103,105) visible window
    const cov = perBpRegion([1, 1, 100, 2, 3], 100)
    const stats = computeVisibleCoverageStats(
      [{ start: 103, end: 105 }],
      () => cov,
    )
    expect(stats!.scoreMax).toBe(3) // the spike is clipped out
  })

  test('returns undefined when nothing is covered', () => {
    const cov = perBpRegion([], 100)
    expect(
      computeVisibleCoverageStats([{ start: 100, end: 105 }], () => cov),
    ).toBeUndefined()
  })

  test('binned path matches the per-bp scan over a full block', () => {
    const depths: number[] = []
    for (let i = 0; i < 1000; i++) {
      depths[i] = (i * 7) % 50
    }
    const perBp = perBpRegion(depths, 1000)
    const bins = downsampleStatsBins(new Float32Array(depths), 64)
    const binned: CoverageRegion = {
      ...perBp,
      coverageStatsBinSize: bins.binSize,
      coverageStatsMins: bins.mins,
      coverageStatsMaxs: bins.maxs,
      coverageStatsSums: bins.sums,
      coverageStatsSumSqs: bins.sumSqs,
    }
    const block = { start: 1000, end: 2000 }
    const viaScan = computeVisibleCoverageStats([block], () => perBp)!
    const viaBins = computeVisibleCoverageStats([block], () => binned)!
    // Whole block covered → bin-granular clipping introduces no edge error, so
    // the aggregate is exact.
    expect(viaBins.scoreMin).toBe(viaScan.scoreMin)
    expect(viaBins.scoreMax).toBe(viaScan.scoreMax)
    expect(viaBins.scoreMean).toBeCloseTo(viaScan.scoreMean)
    expect(viaBins.scoreStdDev).toBeCloseTo(viaScan.scoreStdDev)
  })

  test('combines stats across multiple blocks/groups', () => {
    const covA = perBpRegion([5, 5, 5], 100)
    const covB = perBpRegion([1, 9], 200)
    const stats = computeVisibleCoverageStats(
      [
        { start: 100, end: 103, cov: covA },
        { start: 200, end: 202, cov: covB },
      ],
      b => b.cov,
    )
    expect(stats!.scoreMin).toBe(1)
    expect(stats!.scoreMax).toBe(9)
    expect(stats!.scoreMean).toBeCloseTo((5 + 5 + 5 + 1 + 9) / 5)
  })
})

describe('downsampleMinMax', () => {
  test('empty input returns empty', () => {
    const result = downsampleMinMax(new Float32Array(0), 0, 100, 10)
    expect(result.count).toBe(0)
    expect(result.positions.length).toBe(0)
  })

  test('no downsampling when depths fit in target bins', () => {
    const depths = new Float32Array([0, 5, 10, 0, 3])
    const result = downsampleMinMax(depths, 100, 100, 10)

    // only non-zero bins are emitted
    expect(result.count).toBe(3)
    expect(result.positions[0]).toBe(101) // index 1, offset 100
    expect(result.positions[1]).toBe(102) // index 2
    expect(result.positions[2]).toBe(104) // index 4

    // min should be 0, max should be normalized
    expect(result.mins[0]).toBe(0)
    expect(result.maxs[0]).toBeCloseTo(0.5) // 5/10
    expect(result.maxs[1]).toBeCloseTo(1) // 10/10
    expect(result.maxs[2]).toBeCloseTo(0.3) // 3/10
  })

  test('downsampling preserves peak', () => {
    // 100 positions, one spike at position 50
    const depths = new Float32Array(100)
    depths.fill(1)
    depths[50] = 100

    const result = downsampleMinMax(depths, 0, 10, 100)

    // should have ~10 bins
    expect(result.count).toBeGreaterThan(0)
    expect(result.count).toBeLessThanOrEqual(10)

    // the max across all bins should preserve the spike
    let maxVal = 0
    for (let i = 0; i < result.count; i++) {
      if (result.maxs[i]! > maxVal) {
        maxVal = result.maxs[i]!
      }
    }
    expect(maxVal).toBeCloseTo(1) // 100/100 = 1.0
  })

  test('downsampling preserves valley', () => {
    // 100 positions, all at depth 50 except position 25 which drops to 1
    const depths = new Float32Array(100)
    depths.fill(50)
    depths[25] = 1

    const result = downsampleMinMax(depths, 0, 10, 50)

    // the min across all bins should preserve the valley
    let minVal = Infinity
    for (let i = 0; i < result.count; i++) {
      if (result.mins[i]! < minVal) {
        minVal = result.mins[i]!
      }
    }
    expect(minVal).toBeCloseTo(1 / 50) // 1/50 = 0.02
  })

  test('all-zero depths returns empty', () => {
    const depths = new Float32Array(100)
    const result = downsampleMinMax(depths, 0, 10, 10)
    expect(result.count).toBe(0)
  })

  test('startPos is applied to positions', () => {
    const depths = new Float32Array([5, 10])
    const result = downsampleMinMax(depths, 1000, 100, 10)
    expect(result.positions[0]).toBe(1000)
    expect(result.positions[1]).toBe(1001)
  })
})

describe('countSnpsAtPosition', () => {
  test('returns empty object when no mismatches at position', () => {
    const mismatches = {
      mismatchPositions: new Uint32Array([5, 10]),
      mismatchBases: new Uint8Array([65, 67]),
    }
    const snps = countSnpsAtPosition(20, mismatches)
    expect(Object.keys(snps).length).toBe(0)
  })

  test('counts bases at matching position', () => {
    const mismatches = {
      mismatchPositions: new Uint32Array([5, 5, 5, 10]),
      mismatchBases: new Uint8Array([65, 65, 67, 71]),
    }
    const snps = countSnpsAtPosition(5, mismatches)
    expect(snps.A!.count).toBe(2)
    expect(snps.C!.count).toBe(1)
    expect(snps.G).toBeUndefined()
  })

  test('tracks strand info when available', () => {
    const mismatches = {
      mismatchPositions: new Uint32Array([5, 5, 5]),
      mismatchBases: new Uint8Array([65, 65, 65]),
      mismatchStrands: new Int8Array([1, 1, -1]),
    }
    const snps = countSnpsAtPosition(5, mismatches)
    expect(snps.A!.count).toBe(3)
    expect(snps.A!.fwd).toBe(2)
    expect(snps.A!.rev).toBe(1)
  })

  test('leaves strand counts at zero when no strand data', () => {
    const mismatches = {
      mismatchPositions: new Uint32Array([5]),
      mismatchBases: new Uint8Array([84]),
    }
    const snps = countSnpsAtPosition(5, mismatches)
    expect(snps.T!.count).toBe(1)
    expect(snps.T!.fwd).toBe(0)
    expect(snps.T!.rev).toBe(0)
  })

  test('handles non-standard bases like N', () => {
    const mismatches = {
      mismatchPositions: new Uint32Array([5]),
      mismatchBases: new Uint8Array([78]),
    }
    const snps = countSnpsAtPosition(5, mismatches)
    expect(snps.N!.count).toBe(1)
  })
})

describe('buildCoverageTooltipBin', () => {
  function makeData(
    depths: number[],
    mismatches?: { pos: number; base: number }[],
  ) {
    const mm = mismatches ?? []
    return {
      coverageDepths: new Float32Array(depths),
      coverageStartPos: 100,
      mismatchPositions: new Uint32Array(mm.map(m => m.pos)),
      mismatchBases: new Uint8Array(mm.map(m => m.base)),
    }
  }

  test('returns undefined when depth is zero', () => {
    const data = makeData([0, 0, 0])
    expect(buildCoverageTooltipBin(101, data, data)).toBeUndefined()
  })

  test('returns bin with depth and position', () => {
    const data = makeData([0, 5, 10, 3])
    const bin = buildCoverageTooltipBin(102, data, data)
    expect(bin).toBeDefined()
    expect(bin!.position).toBe(102)
    expect(bin!.depth).toBe(10)
    expect(bin!.interbaseDepth).toBe(0)
    expect(Object.keys(bin!.interbase).length).toBe(0)
  })

  test('includes SNP counts from mismatch arrays', () => {
    const data = makeData(
      [0, 5, 5],
      [
        { pos: 102, base: 65 },
        { pos: 102, base: 65 },
        { pos: 102, base: 67 },
      ],
    )
    const bin = buildCoverageTooltipBin(102, data, data)
    expect(bin).toBeDefined()
    expect(bin!.snps.A!.count).toBe(2)
    expect(bin!.snps.C!.count).toBe(1)
  })

  test('position outside coverage array returns undefined', () => {
    const data = makeData([5, 10])
    expect(buildCoverageTooltipBin(200, data, data)).toBeUndefined()
  })

  test('summarizes insertion-type interbase events at the interbase position', () => {
    const data = makeData([0, 5, 5])
    const interbase = {
      interbasePositions: new Uint32Array([102, 102, 103]),
      interbaseLengths: new Uint32Array([3, 7, 1]),
    }
    // depth keyed on the cell (102=floor), insertions on the boundary (round)
    const bin = buildCoverageTooltipBin(102, data, data, interbase, 102)
    expect(bin!.interbase.insertion).toEqual({
      count: 2,
      minLen: 3,
      maxLen: 7,
      avgLen: 5,
    })
    expect(bin!.interbaseDepth).toBe(5)
  })

  test('interbasePosition is distinct from the depth/SNP position', () => {
    // cursor in cell 101 (depth 5) but nearest boundary is 102 → insertion shows
    const data = makeData([0, 5, 5])
    const interbase = {
      interbasePositions: new Uint32Array([102]),
      interbaseLengths: new Uint32Array([4]),
    }
    const bin = buildCoverageTooltipBin(101, data, data, interbase, 102)
    expect(bin!.depth).toBe(5)
    expect(bin!.interbase.insertion!.count).toBe(1)
  })

  test('returns a bin for an insertion-only position with zero depth', () => {
    const data = makeData([0, 0, 0])
    const interbase = {
      interbasePositions: new Uint32Array([101]),
      interbaseLengths: new Uint32Array([2]),
    }
    const bin = buildCoverageTooltipBin(101, data, data, interbase, 101)
    expect(bin).toBeDefined()
    expect(bin!.depth).toBe(0)
    expect(bin!.interbase.insertion!.count).toBe(1)
  })
})
