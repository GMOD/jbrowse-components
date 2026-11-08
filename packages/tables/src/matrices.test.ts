import { createTablesEngine } from './index.ts'
import { COVERAGE_BIGWIG, DOG_VCF, MULTI_BIGWIG } from './volvox.fixture.ts'
import { fromWire, toWire } from './wire.ts'

import type { WiggleTables } from './index.ts'

const engine = createTablesEngine()

const columnFloor = (x: number) =>
  Math.floor(x + 1e-9 * Math.max(1, Math.abs(x)))

/** The wiggle read's bins binned into pixels, as ggjbrowse's as.matrix() binned them. */
function binnedBins(
  t: WiggleTables,
  regions: { start: number; end: number }[],
  bpPerPx: number,
) {
  const widths = regions.map(r =>
    Math.max(0, columnFloor((r.end - r.start) / bpPerPx)),
  )
  const offsets = widths.map((_, i) =>
    widths.slice(0, i).reduce((a, b) => a + b, 0),
  )
  const width = widths.reduce((a, b) => a + b, 0)
  const sums = new Float64Array(t.sources.name.length * width)
  const counts = new Int32Array(sums.length)
  t.bins.start.forEach((start, i) => {
    const region = t.bins.region[i]!
    const { start: regionStart } = regions[region]!
    const row = t.sources.name.indexOf(t.bins.source[i]!)
    const from = Math.max(0, columnFloor((start - regionStart) / bpPerPx))
    const to = Math.min(
      widths[region]!,
      Math.max(columnFloor((t.bins.end[i]! - regionStart) / bpPerPx), from + 1),
    )
    for (let x = from; x < to; x++) {
      const at = row * width + offsets[region]! + x
      sums[at]! += t.bins.score[i]!
      counts[at]! += 1
    }
  })
  return Array.from(sums, (sum, i) =>
    counts[i] ? sum / counts[i] : Number.NaN,
  )
}

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual).toHaveLength(expected.length)
  for (let i = 0; i < expected.length; i++) {
    if (Number.isNaN(expected[i])) {
      expect(actual[i]).toBeNaN()
    } else {
      expect(actual[i]).toBeCloseTo(expected[i]!, 4)
    }
  }
}

describe('scoreMatrix', () => {
  it('gives a row per source in the wiggle read’s order and a column per pixel, each the mean of the bins covering it', async () => {
    const display = {
      rows: {
        field: 'source',
        sort: ['posneg_rw3', 'posneg_rw1', 'posneg_rw2'],
      },
    }
    const t = await engine.wiggle({ ...MULTI_BIGWIG, display })
    const m = await engine.scoreMatrix({ ...MULTI_BIGWIG, display })
    expect(m.rows).toEqual(t.sources.name)
    expect(m.rows).toEqual(display.rows.sort)
    expect(m.columns.name).toHaveLength(1000)
    expect(m.columns.name.slice(0, 3)).toEqual([
      'ctgA:1',
      'ctgA:51',
      'ctgA:101',
    ])
    expect(new Set(m.columns.region)).toEqual(new Set([0]))
    expect(m.values).toHaveLength(3 * 1000)
    expectClose(m.values, binnedBins(t, [MULTI_BIGWIG.region!], 50))
  })

  it('lays several regions end to end, each column named by its region’s contig', async () => {
    const regions = [
      { refName: 'ctgA', start: 1000, end: 3000 },
      { refName: 'ctgA', start: 20_000, end: 21_000 },
    ]
    const args = { ...MULTI_BIGWIG, region: undefined, regions, bpPerPx: 10 }
    const t = await engine.wiggle(args)
    const m = await engine.scoreMatrix(args)
    expect(m.columns.name).toHaveLength(300)
    expect(m.columns.name[200]).toBe('ctgA:20001')
    expect(m.columns.region[199]).toBe(0)
    expect(m.columns.region[200]).toBe(1)
    expectClose(m.values, binnedBins(t, regions, 10))
  })

  it('places each score where a log axis draws it, as the display clusters', async () => {
    const display = { encoding: { y: { scale: { type: 'log' } } } }
    const linear = await engine.scoreMatrix(COVERAGE_BIGWIG)
    const { scoreScale } = await engine.wiggle({ ...COVERAGE_BIGWIG, display })
    const log = await engine.scoreMatrix({ ...COVERAGE_BIGWIG, display })
    const [min, max] = scoreScale.domain
    const floor = min > 0 ? min : 1
    expectClose(
      log.values,
      Array.from(linear.values, v =>
        Number.isNaN(v)
          ? v
          : v <= floor
            ? 0
            : Math.log(v / floor) / Math.log(max / floor),
      ),
    )
    const placed = Array.from(log.values).filter(v => !Number.isNaN(v))
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...placed)).toBeLessThanOrEqual(1)
    expect(Math.max(...placed)).toBeGreaterThan(0.5)
  })

  it('crosses the wire with NA where no bin covers a pixel', async () => {
    const m = await engine.scoreMatrix({
      ...COVERAGE_BIGWIG,
      region: { refName: 'ctgA', start: 49_000, end: 52_000 },
    })
    const empty = Array.from(m.values).filter(v => Number.isNaN(v)).length
    expect(empty).toBeGreaterThan(0)
    const { json, bytes } = toWire(m)
    const values = fromWire(JSON.parse(json).values, bytes)
    expect(
      Array.isArray(values) && values.filter(v => v === null),
    ).toHaveLength(empty)
  })
})

/** A genotype's dosage of each of `alts` ALT alleles, as ggjbrowse's as.matrix() read it. */
function altDosages(genotype: string, alts: number) {
  const called = genotype
    .split(/[/|]/)
    .filter(a => a !== '.' && a !== '')
    .map(Number)
  return Array.from({ length: alts }, (_, j) =>
    called.length
      ? (2 * called.filter(a => a === j + 1).length) / called.length
      : Number.NaN,
  )
}

describe('genotypeMatrix', () => {
  it('gives the variants read’s rows, a column per ALT of each record, and each allele’s dosage', async () => {
    const t = await engine.variants(DOG_VCF)
    const m = await engine.genotypeMatrix(DOG_VCF)
    expect(m.rows).toEqual(t.rows.name)
    const keys = [...new Set(t.variants.key)]
    expect(new Set(m.columns.variant)).toEqual(new Set(keys))
    const alts = keys.map(
      key => t.variants.alt[t.variants.key.indexOf(key)]!.split(',').length,
    )
    expect(alts.some(n => n > 1)).toBe(true)
    const names = keys.flatMap((key, k) =>
      alts[k] === 1
        ? [String(key + 1)]
        : Array.from({ length: alts[k]! }, (_, j) => `${key + 1}.${j + 1}`),
    )
    expect(m.columns.name).toEqual(names)
    const width = names.length
    const expected = new Array<number>(m.rows.length * width).fill(0)
    t.cells.genotype.forEach((genotype, i) => {
      const key = t.variants.key[t.cells.variant[i]!]!
      const row = m.rows.indexOf(t.cells.row[i]!)
      const first = names.indexOf(
        alts[key] === 1 ? String(key + 1) : `${key + 1}.1`,
      )
      altDosages(genotype, alts[key]!).forEach((d, j) => {
        expected[row * width + first + j] = d
      })
    })
    expectClose(m.values, expected)
    expect(Array.from(m.values).some(v => Number.isNaN(v))).toBe(true)
  })

  it('keeps only the records and rows the display’s filters and rows keep', async () => {
    const plain = await engine.variants(DOG_VCF)
    const [a, b, c] = plain.rows.name.slice(-3) as [string, string, string]
    const display = {
      filter: [{ field: 'minorAlleleFrequency', gte: 0.3 }],
      rows: { sort: [c, a, b], kept: [a, b, c] },
    }
    const t = await engine.variants({ ...DOG_VCF, display })
    const m = await engine.genotypeMatrix({ ...DOG_VCF, display })
    expect(m.rows).toEqual([c, a, b])
    expect(m.rows).toEqual(t.rows.name)
    expect(new Set(t.variants.key).size).toBeLessThan(
      new Set(plain.variants.key).size,
    )
    expect(new Set(m.columns.variant)).toEqual(new Set(t.variants.key))
    expect(m.values).toHaveLength(m.rows.length * m.columns.name.length)
  })

  it('gives a haplotype row a column per record, 1 where it carries an ALT', async () => {
    const display = { rows: 'haplotype' }
    const t = await engine.variants({ ...DOG_VCF, display })
    const m = await engine.genotypeMatrix({ ...DOG_VCF, display })
    expect(m.rows).toEqual(t.rows.name)
    expect(m.rows).toHaveLength(78)
    const keys = [...new Set(t.variants.key)]
    expect(m.columns.name).toEqual(keys.map(key => String(key + 1)))
    expect(new Set(m.columns.allele)).toEqual(new Set([0]))
    const width = keys.length
    const expected = new Array<number>(m.rows.length * width).fill(0)
    t.cells.dosage.forEach((dosage, i) => {
      const row = m.rows.indexOf(t.cells.row[i]!)
      expected[row * width + t.variants.key[t.cells.variant[i]!]!] =
        dosage ?? Number.NaN
    })
    expectClose(m.values, expected)
  })
})
