import { getPhasedGenotypeMatrix } from './getPhasedGenotypeMatrix.ts'

import type { Feature } from '@jbrowse/core/util'

const mockGetFeatures = jest.fn()

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: () =>
    Promise.resolve({ getFeaturesInMultipleRegionsArray: mockGetFeatures }),
}))

// A feature carrying only the genotypes Record, i.e. the fallback path taken by
// any adapter that isn't @gmod/vcf-backed.
function makeFeature(id: string, genotypes: Record<string, string>): Feature {
  const data: Record<string, unknown> = { genotypes }
  return {
    id: () => id,
    get: (key: string) => data[key],
    parent: () => undefined,
    children: () => undefined,
    tags: () => Object.keys(data),
    toJSON: () => data,
  } as unknown as Feature
}

async function build({
  features,
  sources,
  sampleInfo,
}: {
  features: Feature[]
  sources: { name: string; sampleName?: string; HP?: number }[]
  sampleInfo: Record<string, { isPhased: boolean; maxPloidy: number }>
}) {
  mockGetFeatures.mockResolvedValue(features)
  return getPhasedGenotypeMatrix({
    // the mocked getFeatureAdapterOrThrow ignores it
    pluginManager: undefined as never,
    args: {
      adapterConfig: undefined as never,
      sessionId: 'test',
      regions: [{ refName: 'chr1', start: 0, end: 100, assemblyName: 'test' }],
      sources,
      minorAlleleFrequencyFilter: 0,
      maxMissingnessFilter: 1,
      sampleInfo,
    },
  })
}

const diploid = { isPhased: true, maxPloidy: 2 }

describe('getPhasedGenotypeMatrix', () => {
  test('emits one row per haplotype, in sample then HP order', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0|1', HG002: '1|1' })],
      sources: [{ name: 'HG001' }, { name: 'HG002' }],
      sampleInfo: { HG001: diploid, HG002: diploid },
    })
    expect(Object.keys(rows)).toEqual([
      'HG001 HP0',
      'HG001 HP1',
      'HG002 HP0',
      'HG002 HP1',
    ])
  })

  test('splits a phased genotype across its haplotype rows', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0|1' })],
      sources: [{ name: 'HG001' }],
      sampleInfo: { HG001: diploid },
    })
    expect([...rows['HG001 HP0']!]).toEqual([0])
    expect([...rows['HG001 HP1']!]).toEqual([1])
  })

  test('collapses every alt to one indicator', async () => {
    // '1|2' used to write the raw allele indices 1 and 2, which under a
    // Euclidean metric made allele 2 twice as far from the reference as
    // allele 1 — allele indices are categories, not quantities.
    const rows = await build({
      features: [makeFeature('v1', { HG001: '1|2' })],
      sources: [{ name: 'HG001' }],
      sampleInfo: { HG001: diploid },
    })
    expect([...rows['HG001 HP0']!]).toEqual([1])
    expect([...rows['HG001 HP1']!]).toEqual([1])
  })

  test('marks an unphased call missing on both haplotypes', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0/1', HG002: '0|1' })],
      sources: [{ name: 'HG001' }, { name: 'HG002' }],
      sampleInfo: { HG001: diploid, HG002: diploid },
    })
    expect([...rows['HG001 HP0']!]).toEqual([NaN])
    expect([...rows['HG001 HP1']!]).toEqual([NaN])
  })

  test('keeps the called side of a partially uncalled genotype', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '.|1', HG002: '0|1' })],
      sources: [{ name: 'HG001' }, { name: 'HG002' }],
      sampleInfo: { HG001: diploid, HG002: diploid },
    })
    expect([...rows['HG001 HP0']!]).toEqual([NaN])
    expect([...rows['HG001 HP1']!]).toEqual([1])
  })

  test('honors per-sample ploidy', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0|1', HG002: '0|1|1' })],
      sources: [{ name: 'HG001' }, { name: 'HG002' }],
      sampleInfo: {
        HG001: diploid,
        HG002: { isPhased: true, maxPloidy: 3 },
      },
    })
    expect(Object.keys(rows)).toHaveLength(5)
    expect([...rows['HG002 HP2']!]).toEqual([1])
  })

  test('marks a sample absent from the VCF missing', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0|1' })],
      sources: [{ name: 'HG001' }, { name: 'MISSING_SAMPLE' }],
      sampleInfo: { HG001: diploid, MISSING_SAMPLE: diploid },
    })
    expect([...rows['MISSING_SAMPLE HP0']!]).toEqual([NaN])
    expect([...rows['MISSING_SAMPLE HP1']!]).toEqual([NaN])
  })

  test('a source already naming one haplotype yields just that row', async () => {
    // How a re-cluster over a subtree-filtered set arrives: the visible rows
    // are already haplotype-expanded, and one haplotype of a sample can be
    // visible while the other is not. Expanding again would produce
    // "HG001 HP0 HP0".
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0|1', HG002: '1|0' })],
      sources: [
        { name: 'HG001 HP1', sampleName: 'HG001', HP: 1 },
        { name: 'HG002 HP0', sampleName: 'HG002', HP: 0 },
      ],
      sampleInfo: { HG001: diploid, HG002: diploid },
    })
    expect(Object.keys(rows)).toEqual(['HG001 HP1', 'HG002 HP0'])
    expect([...rows['HG001 HP1']!]).toEqual([1])
    expect([...rows['HG002 HP0']!]).toEqual([1])
  })

  // `sampleInfo` is keyed by the bare VCF sample identity, and so is the
  // "<sampleName> HP<n>" row label the display's own `sources` getter builds.
  // A local copy of the expansion here keyed both off `name` instead, so a
  // source whose render name differs from its sampleName fell back to diploid
  // and produced rows the pasted cluster order could not be lined up against.
  test('keys ploidy and row labels off sampleName, not the render name', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0|1|1' })],
      sources: [{ name: 'renamed', sampleName: 'HG001' }],
      sampleInfo: { HG001: { isPhased: true, maxPloidy: 3 } },
    })
    expect(Object.keys(rows)).toEqual(['HG001 HP0', 'HG001 HP1', 'HG001 HP2'])
    expect([...rows['HG001 HP2']!]).toEqual([1])
  })

  test('keeps rows aligned to the feature order', async () => {
    const rows = await build({
      features: [
        makeFeature('v1', { HG001: '0|1' }),
        makeFeature('v2', { HG001: '1|1' }),
        makeFeature('v3', { HG001: '0|1' }),
      ],
      sources: [{ name: 'HG001' }],
      sampleInfo: { HG001: diploid },
    })
    expect([...rows['HG001 HP0']!]).toEqual([0, 1, 0])
    expect([...rows['HG001 HP1']!]).toEqual([1, 1, 1])
  })
})
