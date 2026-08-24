import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import { getLDMatrix } from './getLDMatrix.ts'
import { bandCellCount, bandPairIndex } from './ldBand.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

// The band is a layout, not a statistic, so this drives the CPU path where the
// values are computed in plain JS. `getLDMatrixGPU.test`-style coverage of the
// kernel's own banded decode needs a GPU and lives outside jest.
jest.mock('./getLDMatrixGPU.ts', () => ({
  computeLDMatrixGPU: jest.fn(async () => null),
  computeLDMatrixGPUPhased: jest.fn(async () => null),
}))

const regions = [{ refName: 'chr1', start: 0, end: 10_000, assemblyName: 'a' }]
const NSNP = 40
const NSAMP = 24
const samples = Array.from({ length: NSAMP }, (_, i) => `s${i}`)

let seed = 7
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

function feature(idx: number, phased: boolean): Feature {
  const genotypes: Record<string, string> = {}
  const maf = 0.15 + rnd() * 0.5
  const sep = phased ? '|' : '/'
  for (const s of samples) {
    genotypes[s] = `${rnd() < maf ? 1 : 0}${sep}${rnd() < maf ? 1 : 0}`
  }
  const data: Record<string, unknown> = {
    refName: 'chr1',
    start: idx * 10,
    end: idx * 10 + 1,
    name: `snp${idx}`,
    ALT: ['T'],
    genotypes,
  }
  return {
    id: () => `snp${idx}`,
    get: (k: string) => data[k],
  } as unknown as Feature
}

async function matrixAt(maxVariantSeparation: number, phased: boolean) {
  seed = 7
  const features = Array.from({ length: NSNP }, (_, i) => feature(i, phased))
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getSources: async () => samples.map(name => ({ name })),
    getFeaturesInMultipleRegionsArray: async () => features,
  } as unknown as Awaited<ReturnType<typeof getFeatureAdapterOrThrow>>)

  return getLDMatrix({
    pluginManager: {} as PluginManager,
    args: {
      adapterConfig: { type: 'VcfTabixAdapter' },
      sessionId: 'test',
      regions,
      minorAlleleFrequencyFilter: 0,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
      maxVariantSeparation,
    },
  })
}

describe.each([
  ['phased', true],
  ['unphased', false],
])('a banded %s matrix', (_label, phased) => {
  test('holds exactly the values the full matrix holds for in-band pairs', async () => {
    const full = await matrixAt(0, phased)
    const n = full.snps.length
    expect(n).toBe(NSNP)

    for (const k of [1, 2, 5, 13]) {
      const banded = await matrixAt(k, phased)
      expect(banded.band).toBe(k)
      expect(banded.ldValues.length).toBe(bandCellCount(n, k))
      // Strictly smaller than the full triangle, or the band proved nothing.
      expect(banded.ldValues.length).toBeLessThan(full.ldValues.length)

      let compared = 0
      for (let i = 1; i < n; i++) {
        for (let j = 0; j < i; j++) {
          const slot = bandPairIndex(i, j, k)
          if (i - j <= k) {
            expect(slot).toBeGreaterThanOrEqual(0)
            expect(banded.ldValues[slot]).toBe(
              full.ldValues[bandPairIndex(i, j, full.band)],
            )
            compared++
          } else {
            expect(slot).toBe(-1)
          }
        }
      }
      expect(compared).toBe(bandCellCount(n, k))
    }
  })

  test('an unlimited window is the full triangle', async () => {
    const full = await matrixAt(0, phased)
    expect(full.band).toBe(NSNP - 1)
    expect(full.ldValues.length).toBe((NSNP * (NSNP - 1)) / 2)
    // A window wider than the data resolves to the same thing rather than
    // over-allocating.
    const wide = await matrixAt(10_000, phased)
    expect(wide.band).toBe(full.band)
    expect([...wide.ldValues]).toEqual([...full.ldValues])
  })

  test('the values are real LD, not an array of zeroes', async () => {
    const banded = await matrixAt(5, phased)
    const nonZero = [...banded.ldValues].filter(v => v > 0).length
    expect(nonZero).toBeGreaterThan(banded.ldValues.length / 4)
  })
})
