import {
  buildCoverageTooltipBin,
  computeCoverageTicks,
  computeDepthScale,
  computeVisibleMaxDepth,
  countSnpsAtPosition,
  downsampleMinMax,
  niceNum,
} from './coverageDownsampling.ts'

describe('niceNum', () => {
  test('returns 1 for zero or negative', () => {
    expect(niceNum(0)).toBe(1)
    expect(niceNum(-5)).toBe(1)
  })

  test('returns nice numbers', () => {
    expect(niceNum(7)).toBe(10)
    expect(niceNum(13)).toBe(20)
    expect(niceNum(45)).toBe(50)
    expect(niceNum(99)).toBe(100)
    expect(niceNum(350)).toBe(500)
    expect(niceNum(1500)).toBe(2000)
  })
})

describe('computeCoverageTicks', () => {
  test('produces ticks with correct structure', () => {
    const result = computeCoverageTicks(100, 150)
    expect(result.maxDepth).toBe(100)
    expect(result.nicedMax).toBe(100)
    expect(result.ticks.length).toBeGreaterThanOrEqual(2)
    expect(result.yTop).toBe(5)
    expect(result.yBottom).toBe(145)
  })

  test('fewer ticks for small height', () => {
    const small = computeCoverageTicks(50, 50)
    const large = computeCoverageTicks(50, 150)
    expect(small.ticks.length).toBeLessThanOrEqual(large.ticks.length)
  })

  test('tick y values are within bounds', () => {
    const result = computeCoverageTicks(200, 100)
    for (const tick of result.ticks) {
      expect(tick.y).toBeGreaterThanOrEqual(result.yTop)
      expect(tick.y).toBeLessThanOrEqual(result.yBottom)
    }
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

  test('startOffset is applied to positions', () => {
    const depths = new Float32Array([5, 10])
    const result = downsampleMinMax(depths, 1000, 100, 10)
    expect(result.positions[0]).toBe(1000)
    expect(result.positions[1]).toBe(1001)
  })
})

describe('computeVisibleMaxDepth', () => {
  function region(
    coverageDepths: Float32Array,
    coverageStartOffset: number,
    regionStart: number,
  ) {
    return { coverageDepths, coverageStartOffset, regionStart }
  }

  test('returns 0 for empty blocks', () => {
    expect(computeVisibleMaxDepth([], () => undefined)).toBe(0)
  })

  test('returns 0 when no data matches blocks', () => {
    const blocks = [{ start: 100, end: 200, key: 'block1' }]
    expect(computeVisibleMaxDepth(blocks, () => undefined)).toBe(0)
  })

  test('finds max depth in visible range', () => {
    const data = region(new Float32Array([5, 10, 20, 8, 3]), 0, 100)
    const dataMap = new Map([['region1', data]])
    const blocks = [{ start: 100, end: 105, key: 'region1' }]
    expect(computeVisibleMaxDepth(blocks, b => dataMap.get(b.key))).toBe(20)
  })

  test('only scans bins within visible block range', () => {
    const data = region(new Float32Array([100, 5, 3, 2, 1]), 0, 0)
    const dataMap = new Map([['region1', data]])
    const blocks = [{ start: 2, end: 5, key: 'region1' }]
    expect(computeVisibleMaxDepth(blocks, b => dataMap.get(b.key))).toBe(3)
  })

  test('handles coverageStartOffset correctly', () => {
    const data = region(new Float32Array([10, 20, 30]), 50, 1000)
    const dataMap = new Map([['region1', data]])
    const blocks = [{ start: 1050, end: 1053, key: 'region1' }]
    expect(computeVisibleMaxDepth(blocks, b => dataMap.get(b.key))).toBe(30)
  })

  test('skips blocks with no matching data', () => {
    const data = region(new Float32Array([5, 10]), 0, 0)
    const dataMap = new Map([['region1', data]])
    const blocks = [
      { start: 0, end: 2, key: 'region1' },
      { start: 100, end: 200, key: 'region2' },
    ]
    expect(computeVisibleMaxDepth(blocks, b => dataMap.get(b.key))).toBe(10)
  })
})

describe('computeDepthScale', () => {
  test('returns 1 for zero depth', () => {
    expect(computeDepthScale(0)).toBe(1)
  })

  test('returns 1 for all depths', () => {
    expect(computeDepthScale(7)).toBe(1)
    expect(computeDepthScale(100)).toBe(1)
    expect(computeDepthScale(45)).toBe(1)
  })
})

describe('countSnpsAtPosition', () => {
  test('returns empty object when no mismatches at position', () => {
    const mismatches = {
      mismatchPositions: new Uint32Array([5, 10]),
      mismatchBases: new Uint8Array([65, 67]),
      numMismatches: 2,
    }
    const snps = countSnpsAtPosition(20, mismatches)
    expect(Object.keys(snps).length).toBe(0)
  })

  test('counts bases at matching position', () => {
    const mismatches = {
      mismatchPositions: new Uint32Array([5, 5, 5, 10]),
      mismatchBases: new Uint8Array([65, 65, 67, 71]),
      numMismatches: 4,
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
      numMismatches: 3,
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
      numMismatches: 1,
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
      numMismatches: 1,
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
      coverageStartOffset: 0,
      regionStart: 100,
      mismatchPositions: new Uint32Array(mm.map(m => m.pos - 100)),
      mismatchBases: new Uint8Array(mm.map(m => m.base)),
      numMismatches: mm.length,
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
})
