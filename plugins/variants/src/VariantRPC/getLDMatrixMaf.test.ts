import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import { getLDMatrix } from './getLDMatrix.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

// The GPU path isn't available under jest; stub it to an empty result so the
// CPU fallback runs without a console.warn. These tests only read snps[].maf.
jest.mock('./getLDMatrixGPU.ts', () => ({
  computeLDMatrixGPU: jest.fn(async () => null),
  computeLDMatrixGPUPhased: jest.fn(async () => null),
}))

const regions = [{ refName: 'chr1', start: 0, end: 1000, assemblyName: 'a' }]

function feature(start: number, genotypes: Record<string, string>): Feature {
  const data: Record<string, unknown> = {
    refName: 'chr1',
    start,
    end: start + 1,
    name: `snp${start}`,
    ALT: ['T'],
    genotypes,
  }
  return {
    id: () => `snp${start}`,
    get: (key: string) => data[key],
  } as unknown as Feature
}

async function mafsFor(genotypesPerSnp: Record<string, string>[]) {
  const samples = Object.keys(genotypesPerSnp[0]!)
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getSources: async () => samples.map(name => ({ name })),
    getFeaturesInMultipleRegionsArray: async () =>
      genotypesPerSnp.map((g, i) => feature(100 * (i + 1), g)),
  } as unknown as Awaited<ReturnType<typeof getFeatureAdapterOrThrow>>)

  const { snps } = await getLDMatrix({
    pluginManager: {} as PluginManager,
    args: {
      adapterConfig: {
        type: 'VcfTabixAdapter',
      } as unknown as AnyConfigurationModel,
      sessionId: 'test',
      regions,
      bpPerPx: 1,
      minorAlleleFrequencyFilter: 0,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
    },
  })
  return snps.map(s => s.maf)
}

describe('LD minor allele frequency', () => {
  it('counts alt alleles over called alleles for fully-called diploid sites', () => {
    // 1 alt allele of 6 called
    return expect(
      mafsFor([{ s1: '0/0', s2: '0/0', s3: '0/1' }]),
    ).resolves.toEqual([1 / 6])
  })

  it('counts only the called side of a half-call', async () => {
    // s3 reports one alt allele; treating "./1" as a het genotype would put it
    // at 1 of 6 instead of 1 of 5
    expect(await mafsFor([{ s1: '0/0', s2: '0/0', s3: './1' }])).toEqual([0.2])
  })

  it('weights a haploid call as one allele on a mixed-ploidy site', async () => {
    // Two diploid hom-ref females and one hemizygous alt male: 1 alt of 5
    // called alleles. Reading the pseudo-diploid dosage instead would count the
    // male's single allele twice, giving 2/6.
    expect(await mafsFor([{ s1: '0/0', s2: '0/0', s3: '1' }])).toEqual([0.2])
  })

  it('reports the minor side when alt is the major allele', async () => {
    const [maf] = await mafsFor([{ s1: '1/1', s2: '1/1', s3: '0/1' }])
    expect(maf).toBeCloseTo(1 / 6, 10)
  })

  it('reports 0 for a site with no called genotype', async () => {
    expect(await mafsFor([{ s1: './.', s2: './.', s3: './.' }])).toEqual([0])
  })

  it('counts each phased haplotype allele, including a half-call', async () => {
    // dataIsPhased: 1 alt of 5 called haplotype alleles
    expect(await mafsFor([{ s1: '0|0', s2: '0|0', s3: '.|1' }])).toEqual([0.2])
  })
})
