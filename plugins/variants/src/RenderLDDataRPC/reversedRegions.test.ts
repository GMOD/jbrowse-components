import { getLDMatrix, ldPairIndex } from '../VariantRPC/getLDMatrix.ts'
import { executeRenderLDData } from './executeRenderLDData.ts'

import type { LDMatrixResult, LDSnp } from '../VariantRPC/getLDMatrix.ts'
import type { LDDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'

jest.mock('../VariantRPC/getLDMatrix.ts', () => ({
  ...jest.requireActual('../VariantRPC/getLDMatrix.ts'),
  getLDMatrix: jest.fn(),
}))

const BP_PER_PX = 1
const SPAN = 1000

function region(refName: string, reversed: boolean, offset = 0): Region {
  return {
    refName,
    start: offset,
    end: offset + SPAN,
    assemblyName: 'a',
    reversed,
  }
}

function snp(refName: string, start: number): LDSnp {
  return { id: `${refName}:${start}`, refName, start, end: start + 1 }
}

// Distinct value per pair, so a mis-indexed remap can't accidentally match.
function pairValue(a: LDSnp, b: LDSnp) {
  return (Math.min(a.start, b.start) * 1000 + Math.max(a.start, b.start)) / 1e7
}

function matrix(snps: LDSnp[]): LDMatrixResult {
  const n = snps.length
  const ldValues = new Float32Array((n * (n - 1)) / 2)
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      ldValues[ldPairIndex(i, j)] = pairValue(snps[i]!, snps[j]!)
    }
  }
  const values = new Float32Array(Math.max(0, n - 1))
  const positions: number[] = []
  for (let i = 0; i < n - 1; i++) {
    values[i] = 1 - pairValue(snps[i]!, snps[i + 1]!)
    positions.push((snps[i]!.start + snps[i + 1]!.start) / 2)
  }
  return {
    snps,
    ldValues,
    metric: 'r2',
    hasDprime: true,
    method: 'composite',
    filterStats: {
      totalVariants: n,
      passedVariants: n,
      filteredByMaf: 0,
      filteredByLength: 0,
      filteredByMultiallelic: 0,
      filteredByHwe: 0,
      filteredByCallRate: 0,
      filteredByJexl: 0,
    },
    recombination: { values, positions },
  }
}

function run(regions: Region[], snps: LDSnp[], useGenomicPositions: boolean) {
  jest.mocked(getLDMatrix).mockResolvedValue(matrix(snps))
  return executeRenderLDData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {
        type: 'VcfTabixAdapter',
      } as unknown as AnyConfigurationModel,
      regions,
      bpPerPx: BP_PER_PX,
      ldMetric: 'r2',
      minorAlleleFrequencyFilter: 0,
      lengthCutoffFilter: 0,
      hweFilterThreshold: 0,
      callRateFilter: 0,
      jexlFilters: [],
      signedLD: false,
      useGenomicPositions,
    },
  })
}

// LD value for a pair of SNPs, found by position rather than by index, so the
// lookup doesn't assume either orientation's ordering.
function valueFor(d: LDDataResult, a: number, b: number) {
  const i = d.snps.findIndex(s => s.start === a)
  const j = d.snps.findIndex(s => s.start === b)
  return d.ldValues[ldPairIndex(i, j)]
}

const POSITIONS = [100, 250, 400, 900]
const SNPS = POSITIONS.map(p => snp('a', p))

describe('reversed LD regions', () => {
  test.each([true, false])(
    'the index axis reverses with the region (genomic mode %s)',
    async genomic => {
      const rev = await run([region('a', true)], SNPS, genomic)
      expect(rev.snps.map(s => s.start)).toEqual([...POSITIONS].reverse())
    },
  )

  test('every pair keeps its LD value through the remap', async () => {
    const fwd = await run([region('a', false)], SNPS, true)
    const rev = await run([region('a', true)], SNPS, true)

    for (const a of POSITIONS) {
      for (const b of POSITIONS.filter(p => p !== a)) {
        expect(valueFor(rev, a, b)).toBe(valueFor(fwd, a, b))
      }
    }
    // the fixture is asymmetric, so a no-op remap would fail the axis test
    expect(valueFor(fwd, 100, 250)).not.toBe(valueFor(fwd, 400, 900))
  })

  test('genomic-mode columns mirror: same widths, reversed order', async () => {
    const fwd = await run([region('a', false)], SNPS, true)
    const rev = await run([region('a', true)], SNPS, true)

    const widths = (d: LDDataResult) =>
      [...d.snps.keys()].map(i => d.boundaries[i + 1]! - d.boundaries[i]!)
    // Interior column widths are (pos[i+1] - pos[i-1]) / 2 either way round, so
    // reversing the axis reverses the list without resizing any column.
    const f = [...widths(fwd).slice(1, -1)].reverse()
    const r = widths(rev).slice(1, -1)
    for (const [i, width] of r.entries()) {
      expect(width).toBeCloseTo(f[i]!, 3)
    }
    // uneven spacing, so this isn't trivially satisfied
    expect(f[0]).not.toBeCloseTo(f[1]!, 3)

    // and the axis still runs left to right
    for (let i = 1; i < rev.boundaries.length; i++) {
      expect(rev.boundaries[i]!).toBeGreaterThan(rev.boundaries[i - 1]!)
    }
  })

  test('uniform mode keeps its even columns when reversed', async () => {
    const fwd = await run([region('a', false)], SNPS, false)
    const rev = await run([region('a', true)], SNPS, false)
    expect([...rev.boundaries]).toEqual([...fwd.boundaries])
  })

  test('recombination follows the axis, and drops the pair that straddles', async () => {
    const fwd = await run([region('a', false)], SNPS, true)
    const rev = await run([region('a', true)], SNPS, true)

    expect([...rev.recombination!.values]).toEqual(
      [...fwd.recombination!.values].reverse(),
    )
    expect(rev.recombination!.positions).toEqual(
      [...fwd.recombination!.positions].reverse(),
    )
  })

  test('reversing one region of two leaves the other alone', async () => {
    const snps = [
      ...POSITIONS.map(p => snp('a', p)),
      ...POSITIONS.map(p => snp('b', p + 2000)),
    ]
    const regions = [region('a', false), region('b', false, 2000)]
    const fwd = await run(regions, snps, false)
    const rev = await run([regions[0]!, region('b', true, 2000)], snps, false)

    expect(rev.snps.slice(0, 4)).toEqual(fwd.snps.slice(0, 4))
    expect(rev.snps.slice(4).map(s => s.start)).toEqual(
      fwd.snps
        .slice(4)
        .map(s => s.start)
        .reverse(),
    )
    // the boundary pair now joins two SNPs that aren't genomic neighbors
    expect(rev.recombination!.values[3]).toBeNaN()
    expect(fwd.recombination!.values[3]).not.toBeNaN()
  })
})
