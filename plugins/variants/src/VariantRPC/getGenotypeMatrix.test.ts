import { getGenotypeMatrix } from './getGenotypeMatrix.ts'

import type { Feature } from '@jbrowse/core/util'

const mockGetFeatures = jest.fn()

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: () =>
    Promise.resolve({ getFeaturesInMultipleRegionsArray: mockGetFeatures }),
}))

// A feature carrying only the genotypes Record: the fallback path, taken by any
// adapter that isn't @gmod/vcf-backed.
function makeFeature(
  id: string,
  genotypes: Record<string, string>,
  ALT: string[] = ['T'],
): Feature {
  const data: Record<string, unknown> = { genotypes, ALT }
  return {
    id: () => id,
    get: (key: string) => data[key],
  } as unknown as Feature
}

// A VcfFeature-alike taking the allocation-free path. `skip` names samples whose
// callback is never fired, reproducing what @gmod/vcf does for a sample whose
// colon-separated FORMAT fields stop before the GT column.
function makeVcfFeature(
  id: string,
  sampleNames: string[],
  genotypes: Record<string, string>,
  skip: string[] = [],
  ALT: string[] = ['T'],
): Feature {
  const data: Record<string, unknown> = { genotypes, sampleNames, ALT }
  return {
    id: () => id,
    get: (key: string) => data[key],
    processGenotypes: (
      cb: (str: string, start: number, end: number, sampleIdx: number) => void,
    ) => {
      for (let i = 0; i < sampleNames.length; i++) {
        const name = sampleNames[i]!
        const genotype = genotypes[name]
        if (genotype !== undefined && !skip.includes(name)) {
          cb(genotype, 0, genotype.length, i)
        }
      }
    },
  } as unknown as Feature
}

async function build(features: Feature[], sources: { name: string }[]) {
  mockGetFeatures.mockResolvedValue(features)
  return getGenotypeMatrix({
    // the mocked getFeatureAdapterOrThrow ignores it
    pluginManager: undefined as never,
    args: {
      adapterConfig: undefined as never,
      sessionId: 'test',
      regions: [{ refName: 'chr1', start: 0, end: 100, assemblyName: 'test' }],
      sources,
      minorAlleleFrequencyFilter: 0,
      maxMissingnessFilter: 1,
    },
  })
}

const sources = [{ name: 'HG001' }, { name: 'HG002' }]

describe('getGenotypeMatrix (genotypes-Record path)', () => {
  test('encodes dosage, with a no-call as NaN rather than a value', async () => {
    const rows = await build(
      [
        makeFeature('v1', { HG001: '0/0', HG002: '1/1' }),
        makeFeature('v2', { HG001: '0/1', HG002: './.' }),
      ],
      sources,
    )
    expect([...rows.get('HG001')!]).toEqual([0, 1])
    expect([...rows.get('HG002')!]).toEqual([2, NaN])
  })

  // A multiallelic site spends one column per ALT so that carrying allele 1 and
  // carrying allele 2 are different points — a single "any alt" dosage made two
  // homozygotes for different alleles identical. See readAltDosages.
  test('gives a multiallelic site one column per alt', async () => {
    const rows = await build(
      [makeFeature('v1', { HG001: '1/2', HG002: '0/2' }, ['T', 'G'])],
      sources,
    )
    expect([...rows.get('HG001')!]).toEqual([1, 1])
    expect([...rows.get('HG002')!]).toEqual([0, 1])
  })

  test('homozygotes for different alts are not the same point', async () => {
    const rows = await build(
      [makeFeature('v1', { HG001: '1/1', HG002: '2/2' }, ['T', 'G'])],
      sources,
    )
    expect([...rows.get('HG001')!]).toEqual([2, 0])
    expect([...rows.get('HG002')!]).toEqual([0, 2])
  })

  test('a biallelic site still costs exactly one column', async () => {
    const rows = await build(
      [
        makeFeature('v1', { HG001: '0/1', HG002: '1/1' }),
        makeFeature('v2', { HG001: '1/1', HG002: '0/0' }),
      ],
      sources,
    )
    expect([...rows.get('HG001')!]).toEqual([1, 2])
    expect([...rows.get('HG002')!]).toEqual([2, 0])
  })

  test('marks a sample absent from the VCF missing', async () => {
    const rows = await build(
      [makeFeature('v1', { HG001: '0/1' })],
      [{ name: 'HG001' }, { name: 'GHOST' }],
    )
    expect([...rows.get('GHOST')!]).toEqual([NaN])
  })

  // In `sources` order, which is the contract the cluster order is indices into
  // — see ClusterMatrix.
  test('emits one row per source, keyed by source name in source order', async () => {
    const rows = await build(
      [makeFeature('v1', { HG001: '0/1', HG002: '0/1' })],
      sources,
    )
    expect([...rows.keys()]).toEqual(['HG001', 'HG002'])
  })
})

describe('getGenotypeMatrix (processGenotypes fast path)', () => {
  const sampleNames = ['HG001', 'HG002']

  test('agrees with the genotypes-Record path', async () => {
    const genotypes = [
      { HG001: '0/0', HG002: '1/1' },
      { HG001: '0/1', HG002: './.' },
    ]
    const viaRecord = await build(
      genotypes.map((g, i) => makeFeature(`v${i}`, g)),
      sources,
    )
    const viaCallback = await build(
      genotypes.map((g, i) => makeVcfFeature(`v${i}`, sampleNames, g)),
      sources,
    )
    expect([...viaCallback.get('HG001')!]).toEqual([...viaRecord.get('HG001')!])
    expect([...viaCallback.get('HG002')!]).toEqual([...viaRecord.get('HG002')!])
  })

  test('a skipped sample does not shift the samples after it', async () => {
    // HG001's FORMAT stops before GT, so only HG002 fires. Keying off a running
    // counter instead of the callback's sampleIdx would land HG002's genotype
    // in HG001's row.
    const rows = await build(
      [
        makeVcfFeature('v1', sampleNames, { HG001: '0/0', HG002: '1/1' }, [
          'HG001',
        ]),
      ],
      sources,
    )
    expect([...rows.get('HG001')!]).toEqual([NaN])
    expect([...rows.get('HG002')!]).toEqual([2])
  })

  test('a skipped sample does not inherit the previous feature call', async () => {
    // The dosage buffer is reused across features, so without a reset HG001
    // would keep the 1/1 it had at v1.
    const rows = await build(
      [
        makeVcfFeature('v1', sampleNames, { HG001: '1/1', HG002: '0/1' }),
        makeVcfFeature('v2', sampleNames, { HG001: '1/1', HG002: '0/1' }, [
          'HG001',
        ]),
      ],
      sources,
    )
    expect([...rows.get('HG001')!]).toEqual([2, NaN])
    expect([...rows.get('HG002')!]).toEqual([1, 1])
  })

  test('keeps rows aligned to the feature order', async () => {
    const rows = await build(
      [
        makeVcfFeature('v1', sampleNames, { HG001: '0/1', HG002: '0/0' }),
        makeVcfFeature('v2', sampleNames, { HG001: '1/1', HG002: '0/1' }),
        makeVcfFeature('v3', sampleNames, { HG001: '0/0', HG002: '1/1' }),
      ],
      sources,
    )
    expect([...rows.get('HG001')!]).toEqual([1, 2, 0])
    expect([...rows.get('HG002')!]).toEqual([0, 1, 2])
  })
})

// A SplitVcfTabixAdapter opens one file — and so one header — per refName, and
// `getFeaturesInMultipleRegions` merges the per-region streams, so a view
// spanning chr1 and chrY arrives here as features from two different headers.
// The chrY file was called on the male subset, so its header omits the females:
// header position and canonical position part company at the first omission,
// and indexing the canonical order by `sampleIdx` files each chrY genotype
// against a neighbouring sample. Every write stays in bounds, so nothing errors
// — the dendrogram simply groups samples by someone else's calls, and the row
// order it writes outlives the run.
describe('getGenotypeMatrix across two VCF headers', () => {
  // identity-stable per file, as one parser's features are
  const chr1Header = ['FEMALE', 'MALE1', 'MALE2']
  const chrYHeader = ['MALE1', 'MALE2']
  const cohort = [{ name: 'FEMALE' }, { name: 'MALE1' }, { name: 'MALE2' }]

  test('files a chrY genotype against the sample whose header slot it is', async () => {
    const rows = await build(
      [
        makeVcfFeature('chr1:1', chr1Header, {
          FEMALE: '0/1',
          MALE1: '0/0',
          MALE2: '1/1',
        }),
        makeVcfFeature('chrY:1', chrYHeader, { MALE1: '1/1', MALE2: '0/0' }),
      ],
      cohort,
    )
    // the female is simply absent from the chrY file, not the carrier of the
    // first male's call
    expect([...rows.get('FEMALE')!]).toEqual([1, NaN])
    expect([...rows.get('MALE1')!]).toEqual([0, 2])
    expect([...rows.get('MALE2')!]).toEqual([2, 0])
  })

  // The other interleaving: the subset header is seen first, so the canonical
  // union is [MALE1, MALE2, FEMALE] and it is the *full* header that disagrees
  // with it position for position.
  test('remaps the full header too when the subset file is seen first', async () => {
    const rows = await build(
      [
        makeVcfFeature('chrY:1', chrYHeader, { MALE1: '1/1', MALE2: '0/0' }),
        makeVcfFeature('chr1:1', chr1Header, {
          FEMALE: '0/1',
          MALE1: '0/0',
          MALE2: '1/1',
        }),
      ],
      cohort,
    )
    expect([...rows.get('FEMALE')!]).toEqual([NaN, 1])
    expect([...rows.get('MALE1')!]).toEqual([2, 0])
    expect([...rows.get('MALE2')!]).toEqual([0, 2])
  })
})
