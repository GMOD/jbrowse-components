import { BigWig } from '@gmod/bbi'

import BigWigAdapter from './BigWigAdapter.ts'
import configSchema from './configSchema.ts'
import {
  binAlignedExtent,
  binRawRegion,
  syntheticBinBp,
  syntheticReductionLevels,
} from './syntheticTiers.ts'
import { tierSpanRange } from './tierSpanRange.ts'

interface Rec {
  start: number
  end: number
  score: number
}

function bin(
  records: Rec[],
  regionStart: number,
  regionEnd: number,
  b: number,
) {
  const out = binRawRegion(
    Int32Array.from(records, r => r.start),
    Int32Array.from(records, r => r.end),
    Float32Array.from(records, r => r.score),
    0,
    records.length,
    regionStart,
    regionEnd,
    b,
  )
  return Array.from({ length: out.count }, (_, i) => ({
    start: out.starts[i]!,
    end: out.ends[i]!,
    score: out.scores[i]!,
    min: out.minScores?.[i],
    max: out.maxScores?.[i],
  }))
}

// Every base as its own sample: the mean over covered bases, the extremes, and
// the covered extent per bin, then identical neighbours merged.
function perBaseOracle(
  records: Rec[],
  regionStart: number,
  regionEnd: number,
  b: number,
) {
  const extent = binAlignedExtent(regionStart, regionEnd, b)
  const rows: {
    start: number
    end: number
    score: number
    min: number
    max: number
  }[] = []
  for (let bs = extent.start; bs < extent.end; bs += b) {
    let sum = 0
    let count = 0
    let min = Infinity
    let max = -Infinity
    let first = -1
    let last = -1
    for (const r of records) {
      if (Number.isNaN(r.score)) {
        continue
      }
      for (let p = Math.max(r.start, bs); p < Math.min(r.end, bs + b); p++) {
        sum += r.score
        count++
        min = Math.min(min, r.score)
        max = Math.max(max, r.score)
        first = first < 0 ? p : first
        last = p
      }
    }
    if (count) {
      const row = {
        start: first,
        end: last + 1,
        score: Math.fround(min === max ? min : sum / count),
        min,
        max,
      }
      const prev = rows.at(-1)
      if (
        prev?.end === row.start &&
        prev.score === row.score &&
        prev.min === row.min &&
        prev.max === row.max
      ) {
        prev.end = row.end
      } else {
        rows.push(row)
      }
    }
  }
  return rows
}

function randomRecords(seed: number, count: number, maxSpan: number) {
  let state = seed
  const rand = () => {
    state = (state * 1103515245 + 12345) % 2 ** 31
    return state / 2 ** 31
  }
  const records: Rec[] = []
  let pos = Math.floor(rand() * 20)
  for (let i = 0; i < count; i++) {
    const start = pos + (rand() < 0.3 ? Math.floor(rand() * 30) : 0)
    const end = start + 1 + Math.floor(rand() * maxSpan)
    records.push({ start, end, score: Math.floor(rand() * 6) - 2 })
    pos = end
  }
  return records
}

describe('syntheticReductionLevels', () => {
  test('two power-of-two tiers under the first level, coarsest at or above a quarter of it', () => {
    expect(syntheticReductionLevels([640, 2560])).toEqual([64, 256])
    expect(syntheticReductionLevels([304, 1216])).toEqual([32, 128])
    expect(syntheticReductionLevels([3478, 13912])).toEqual([256, 1024])
    expect(syntheticReductionLevels([1024])).toEqual([64, 256])
    expect(syntheticReductionLevels([40, 160])).toEqual([4, 16])
  })

  test('no bin under 2bp, and none for a file without zoom levels', () => {
    expect(syntheticReductionLevels([10, 40])).toEqual([4])
    expect(syntheticReductionLevels([8])).toEqual([2])
    expect(syntheticReductionLevels([4])).toEqual([])
    expect(syntheticReductionLevels([])).toEqual([])
  })

  test('the zoom ranges tile from 0 to infinity, every tier holding at most two bins a pixel', () => {
    for (const fileLevels of [
      [640, 2560, 10240],
      [304, 1216],
      [10, 40, 160],
      [3478, 13912, 55648],
      [1584, 6336],
      [8, 32],
      [4, 16],
    ]) {
      const levels = [...syntheticReductionLevels(fileLevels), ...fileLevels]
      const first = fileLevels[0]!
      const ranges = new Map<number, [number, number]>()
      for (let span = 0.01; span < 1e6; span *= 1.01) {
        const [lo, hi] = tierSpanRange(levels, span)
        expect(lo).toBeLessThanOrEqual(span)
        expect(span).toBeLessThan(hi)
        ranges.set(lo, [lo, hi])
        const b = syntheticBinBp(lo, first)
        if (b !== undefined) {
          expect(hi / b).toBeLessThanOrEqual(2)
          expect(b).toBeLessThan(first)
        }
      }
      const sorted = [...ranges.values()].sort((a, c) => a[0] - c[0])
      expect(sorted[0]![0]).toBe(0)
      expect(sorted.at(-1)![1]).toBe(Infinity)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]![0]).toBe(sorted[i - 1]![1])
      }
      expect(sorted).toHaveLength(levels.length + 1)
    }
  })

  test('a file level is never mistaken for a synthetic one', () => {
    expect(syntheticBinBp(0, 640)).toBeUndefined()
    expect(syntheticBinBp(128, 640)).toBe(256)
    expect(syntheticBinBp(320, 640)).toBeUndefined()
    expect(syntheticBinBp(0, Infinity)).toBeUndefined()
  })
})

describe('binRawRegion', () => {
  test('a record crossing a boundary counts in each bin by its overlapping bases', () => {
    const records = [
      { start: 5, end: 15, score: 1 },
      { start: 15, end: 20, score: 3 },
      { start: 20, end: 21, score: 0 },
      { start: 21, end: 22, score: 0 },
      { start: 22, end: 23, score: 0 },
      { start: 23, end: 24, score: 0 },
    ]
    expect(bin(records, 0, 30, 10)).toEqual([
      { start: 5, end: 10, score: 1, min: 1, max: 1 },
      { start: 10, end: 20, score: 2, min: 1, max: 3 },
      { start: 20, end: 24, score: 0, min: 0, max: 0 },
    ])
  })

  test('the mean is over covered bases, so a sparse bin is not diluted', () => {
    const records = [
      { start: 0, end: 1, score: 4 },
      { start: 8, end: 9, score: 2 },
      { start: 29, end: 30, score: 7 },
      { start: 30, end: 31, score: 7 },
    ]
    expect(bin(records, 0, 40, 16)).toEqual([
      { start: 0, end: 9, score: 3, min: 2, max: 4 },
      { start: 29, end: 31, score: 7, min: 7, max: 7 },
    ])
  })

  test('a bin holding one record reproduces it, and empty bins emit nothing', () => {
    const records = [
      { start: 3, end: 5, score: 0.1 },
      { start: 5, end: 6, score: 0.2 },
      { start: 6, end: 7, score: 0.2 },
      { start: 7, end: 8, score: 0.2 },
      { start: 70, end: 71, score: 0.3 },
      { start: 200, end: 207, score: -0.7 },
    ]
    const rows = bin(records, 0, 256, 16)
    expect(rows).toEqual([
      {
        start: 3,
        end: 8,
        score: expect.any(Number),
        min: Math.fround(0.1),
        max: Math.fround(0.2),
      },
      {
        start: 70,
        end: 71,
        score: Math.fround(0.3),
        min: Math.fround(0.3),
        max: Math.fround(0.3),
      },
      {
        start: 200,
        end: 207,
        score: Math.fround(-0.7),
        min: Math.fround(-0.7),
        max: Math.fround(-0.7),
      },
    ])
    expect(rows[0]!.score).toBeCloseTo((0.1 * 2 + 0.2 * 3) / 5, 6)
  })

  test('NaN records cover nothing', () => {
    const records = [
      { start: 0, end: 4, score: Number.NaN },
      { start: 4, end: 8, score: 2 },
      { start: 16, end: 32, score: Number.NaN },
      { start: 40, end: 41, score: 1 },
      { start: 41, end: 42, score: 1 },
    ]
    expect(bin(records, 0, 64, 16)).toEqual([
      { start: 4, end: 8, score: 2, min: 2, max: 2 },
      { start: 40, end: 42, score: 1, min: 1, max: 1 },
    ])
  })

  test('a long record stays one row across the bins it fills', () => {
    const records = [
      { start: 0, end: 1, score: 1 },
      { start: 1, end: 2, score: 2 },
      { start: 2, end: 3, score: 1 },
      { start: 3, end: 4, score: 2 },
      { start: 150, end: 350, score: 5 },
      { start: 400, end: 401, score: 1 },
      { start: 401, end: 402, score: 3 },
      { start: 402, end: 403, score: 1 },
      { start: 403, end: 404, score: 3 },
    ]
    expect(bin(records, 0, 500, 100)).toEqual([
      { start: 0, end: 4, score: 1.5, min: 1, max: 2 },
      { start: 150, end: 350, score: 5, min: 5, max: 5 },
      { start: 400, end: 404, score: 2, min: 1, max: 3 },
    ])
  })

  test('data as coarse as the bin comes back raw, untouched', () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      start: i * 50,
      end: i * 50 + 50,
      score: i % 3,
    }))
    const out = bin(records, 0, 1000, 16)
    expect(out).toEqual(
      records.map(r => ({ ...r, min: undefined, max: undefined })),
    )
  })

  test('bins that would not at least halve the rows come back raw', () => {
    const starts = [0, 1, 4, 5, 8, 9, 12, 13, 16, 20]
    const records = starts.map((start, i) => ({
      start,
      end: start + 1,
      score: i,
    }))
    expect(bin(records, 0, 24, 4).every(r => r.min === undefined)).toBe(true)
    expect(bin(records.slice(0, 8), 0, 16, 4)).toHaveLength(4)
  })

  test('records overlapping or out of order come back raw', () => {
    const overlapping = [
      { start: 0, end: 10, score: 1 },
      { start: 5, end: 6, score: 2 },
      { start: 6, end: 7, score: 2 },
      { start: 7, end: 8, score: 2 },
    ]
    expect(bin(overlapping, 0, 64, 32).every(r => r.min === undefined)).toBe(
      true,
    )
  })

  test('the fallback keeps only the records overlapping the region, not the bin-aligned margin', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      start: i * 10,
      end: i * 10 + 10,
      score: i,
    }))
    expect(bin(records, 25, 75, 4).map(r => r.start)).toEqual([
      20, 30, 40, 50, 60, 70,
    ])
  })

  test('matches a per-base oracle on random records of mixed spans', () => {
    let binned = 0
    for (let seed = 1; seed < 60; seed++) {
      const records = randomRecords(seed, 300, seed % 3 === 0 ? 40 : 4)
      const end = records.at(-1)!.end
      for (const b of [2, 8, 32, 128]) {
        for (const [rs, re] of [
          [0, end],
          [37, end - 53],
        ] as const) {
          const extent = binAlignedExtent(rs, re, b)
          const fetched = records.filter(
            r => r.end > extent.start && r.start < extent.end,
          )
          const rows = bin(fetched, rs, re, b)
          if (rows[0]?.min === undefined) {
            continue
          }
          binned++
          expect(rows).toEqual(perBaseOracle(records, rs, re, b))
        }
      }
    }
    expect(binned).toBeGreaterThan(100)
  })

  test("an edge bin's row doesn't depend on where the region starts", () => {
    const records = randomRecords(7, 400, 3)
    const end = records.at(-1)!.end
    const whole = bin(records, 0, end, 32)
    const inner = bin(records, 101, end - 99, 32)
    expect(inner.length).toBeGreaterThan(10)
    const key = (r: (typeof whole)[number]) => JSON.stringify(r)
    const wholeKeys = new Set(whole.map(key))
    for (const row of inner.slice(1, -1)) {
      expect(wholeKeys.has(key(row))).toBe(true)
    }
    expect(key(inner[0]!)).toBe(key(whole.find(r => r.start >= 96)!))
  })

  test('1bp records binned at 2bp keep the base mean at the finest synthetic tier', () => {
    const records = Array.from({ length: 64 }, (_, i) => ({
      start: i,
      end: i + 1,
      score: Math.fround(Math.sin(i)),
    }))
    const rows = bin(records, 0, 64, 2)
    expect(rows).toHaveLength(32)
    rows.forEach((row, k) => {
      expect(row.start).toBe(k * 2)
      expect(row.score).toBeCloseTo(
        (records[k * 2]!.score + records[k * 2 + 1]!.score) / 2,
        6,
      )
    })
  })
})

const COVERAGE =
  require.resolve('../../../../test_data/volvox/volvox-sorted.bam.coverage.bw')

describe('against a real file', () => {
  // Contiguous 1bp coverage summarised at 40bp: shift the records so bbi's
  // data-anchored summary bins land on 40bp boundaries, and each full summary
  // record is the bin binRawRegion computes.
  test("binning reproduces bbi's first zoom level wherever their bins coincide", async () => {
    const bw = new BigWig({ path: COVERAGE })
    const raw = await bw.getFeaturesAsArrays('ctgA', 0, 50001, {
      basesPerSpan: 1,
    })
    const zoom = await bw.getFeaturesAsArrays('ctgA', 0, 50001, {
      basesPerSpan: 20,
    })
    if (raw.isSummary || !zoom.isSummary) {
      throw new Error('expected the raw section and the 40bp level')
    }
    const offset = raw.starts[0]!
    const shifted = binRawRegion(
      raw.starts.map(s => s - offset),
      raw.ends.map(e => e - offset),
      raw.scores,
      0,
      raw.starts.length,
      0,
      raw.ends.at(-1)! - offset,
      40,
    )
    const byStart = new Map<number, number>()
    for (let i = 0; i < shifted.count; i++) {
      byStart.set(shifted.starts[i]! + offset, i)
    }
    let compared = 0
    for (let i = 0; i < zoom.starts.length; i++) {
      const j = byStart.get(zoom.starts[i]!)
      if (j === undefined || shifted.ends[j]! + offset !== zoom.ends[i]) {
        continue
      }
      expect(shifted.minScores![j]).toBe(zoom.minScores[i])
      expect(shifted.maxScores![j]).toBe(zoom.maxScores[i])
      expect(shifted.scores[j]).toBeCloseTo(zoom.scores[i]!, 4)
      compared++
    }
    expect(compared).toBeGreaterThan(1000)
  })

  test('the tiers either side of the first level carry the same signal and extremes', async () => {
    const adapter = new BigWigAdapter(
      configSchema.create({
        bigWigLocation: {
          localPath: COVERAGE,
          locationType: 'LocalPathLocation',
        },
      }),
    )
    const region = {
      refName: 'ctgA',
      start: 4000,
      end: 36000,
      assemblyName: 'v',
    }
    const [raw] = await adapter.getFeatureArraysMulti([region], { bpPerPx: 1 })
    const [synthetic] = await adapter.getFeatureArraysMulti([region], {
      bpPerPx: 19,
    })
    const [file] = await adapter.getFeatureArraysMulti([region], {
      bpPerPx: 20,
    })
    expect(raw!.minScores).toBeUndefined()
    expect(synthetic!.minScores).toBeDefined()
    expect(synthetic!.count).toBeLessThan(raw!.count / 10)

    const integral = (a: typeof raw, lo: number, hi: number) => {
      let total = 0
      for (let i = 0; i < a!.count; i++) {
        const s = Math.max(a!.starts[i]!, lo)
        const e = Math.min(a!.ends[i]!, hi)
        total += e > s ? a!.scores[i]! * (e - s) : 0
      }
      return total
    }
    const extremes = (a: typeof raw, lo: number, hi: number) => {
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < a!.count; i++) {
        if (a!.ends[i]! > lo && a!.starts[i]! < hi) {
          min = Math.min(min, a!.minScores?.[i] ?? a!.scores[i]!)
          max = Math.max(max, a!.maxScores?.[i] ?? a!.scores[i]!)
        }
      }
      return [min, max]
    }
    // Whole 16bp bins and whole 40bp summary records, so each side counts
    // exactly the bases the raw section does
    const lo = 8002
    const hi = 32002
    const exact = integral(raw, lo, hi)
    expect(
      integral(synthetic, 8000, 32000) / integral(raw, 8000, 32000),
    ).toBeCloseTo(1, 5)
    expect(integral(file, lo, hi) / exact).toBeCloseTo(1, 5)
    expect(extremes(synthetic, 8000, 32000)).toEqual(extremes(raw, 8000, 32000))
    expect(extremes(file, lo, hi)).toEqual(extremes(raw, lo, hi))
  })

  test('a synthetic fetch declares the range its bins serve', async () => {
    const adapter = new BigWigAdapter(
      configSchema.create({
        bigWigLocation: {
          localPath: COVERAGE,
          locationType: 'LocalPathLocation',
        },
      }),
    )
    expect(await adapter.getZoomRange({ bpPerPx: 1 })).toEqual({
      minBpPerPx: 0,
      maxBpPerPx: 2,
    })
    expect(await adapter.getZoomRange({ bpPerPx: 5 })).toEqual({
      minBpPerPx: 2,
      maxBpPerPx: 8,
    })
    expect(await adapter.getZoomRange({ bpPerPx: 19 })).toEqual({
      minBpPerPx: 8,
      maxBpPerPx: 20,
    })
    expect(await adapter.getZoomRange({ bpPerPx: 10, resolution: 2 })).toEqual({
      minBpPerPx: 4,
      maxBpPerPx: 16,
    })
  })
})
