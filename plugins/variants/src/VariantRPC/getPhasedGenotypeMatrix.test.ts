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

// A VcfFeature-alike taking the allocation-free path: `sampleIdx` counts against
// the header list it is constructed with, which is the contract
// `processGenotypes` documents. `sampleNames` is passed by reference so features
// out of one file share the array identity, as one parser's features do.
function makeVcfFeature(
  id: string,
  sampleNames: string[],
  genotypes: Record<string, string>,
): Feature {
  const data: Record<string, unknown> = { genotypes, sampleNames, ALT: ['T'] }
  return {
    id: () => id,
    get: (key: string) => data[key],
    processGenotypes: (
      cb: (str: string, start: number, end: number, sampleIdx: number) => void,
    ) => {
      for (const [i, name] of sampleNames.entries()) {
        const genotype = genotypes[name]
        if (genotype !== undefined) {
          cb(genotype, 0, genotype.length, i)
        }
      }
    },
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
    expect([...rows.keys()]).toEqual([
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
    expect([...rows.get('HG001 HP0')!]).toEqual([0])
    expect([...rows.get('HG001 HP1')!]).toEqual([1])
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
    expect([...rows.get('HG001 HP0')!]).toEqual([1])
    expect([...rows.get('HG001 HP1')!]).toEqual([1])
  })

  test('marks an unphased call missing on both haplotypes', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0/1', HG002: '0|1' })],
      sources: [{ name: 'HG001' }, { name: 'HG002' }],
      sampleInfo: { HG001: diploid, HG002: diploid },
    })
    expect([...rows.get('HG001 HP0')!]).toEqual([NaN])
    expect([...rows.get('HG001 HP1')!]).toEqual([NaN])
  })

  test('keeps the called side of a partially uncalled genotype', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '.|1', HG002: '0|1' })],
      sources: [{ name: 'HG001' }, { name: 'HG002' }],
      sampleInfo: { HG001: diploid, HG002: diploid },
    })
    expect([...rows.get('HG001 HP0')!]).toEqual([NaN])
    expect([...rows.get('HG001 HP1')!]).toEqual([1])
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
    expect([...rows.keys()]).toHaveLength(5)
    expect([...rows.get('HG002 HP2')!]).toEqual([1])
  })

  test('marks a sample absent from the VCF missing', async () => {
    const rows = await build({
      features: [makeFeature('v1', { HG001: '0|1' })],
      sources: [{ name: 'HG001' }, { name: 'MISSING_SAMPLE' }],
      sampleInfo: { HG001: diploid, MISSING_SAMPLE: diploid },
    })
    expect([...rows.get('MISSING_SAMPLE HP0')!]).toEqual([NaN])
    expect([...rows.get('MISSING_SAMPLE HP1')!]).toEqual([NaN])
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
    expect([...rows.keys()]).toEqual(['HG001 HP1', 'HG002 HP0'])
    expect([...rows.get('HG001 HP1')!]).toEqual([1])
    expect([...rows.get('HG002 HP0')!]).toEqual([1])
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
    expect([...rows.keys()]).toEqual(['HG001 HP0', 'HG001 HP1', 'HG001 HP2'])
    expect([...rows.get('HG001 HP2')!]).toEqual([1])
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
    expect([...rows.get('HG001 HP0')!]).toEqual([0, 1, 0])
    expect([...rows.get('HG001 HP1')!]).toEqual([1, 1, 1])
  })
})

// Mixed ploidy is the shape that broke the render loops (they painted a haploid
// call as the black "Unphased" fill and invented an alt on the HP1 row a haploid
// sample doesn't have). This path was already correct — but nothing pinned it,
// which is exactly how the three consumers of a haploid genotype were free to
// disagree. 1000G chrX non-PAR is the canonical instance: haploid males beside
// phased diploid females.
describe('getPhasedGenotypeMatrix mixed ploidy', () => {
  const haploid = { isPhased: true, maxPloidy: 1 }

  test('a haploid call fills its one haplotype row and no other', async () => {
    const rows = await build({
      features: [makeFeature('v1', { FEMALE: '0|1', MALE: '1' })],
      sources: [
        { name: 'FEMALE HP0', sampleName: 'FEMALE', HP: 0 },
        { name: 'FEMALE HP1', sampleName: 'FEMALE', HP: 1 },
        { name: 'MALE HP0', sampleName: 'MALE', HP: 0 },
        { name: 'MALE HP1', sampleName: 'MALE', HP: 1 },
      ],
      sampleInfo: { FEMALE: diploid, MALE: haploid },
    })
    expect(rows.get('FEMALE HP0')![0]).toBe(0)
    expect(rows.get('FEMALE HP1')![0]).toBe(1)
    // the haploid call is real data on HP0 — not missing, and not unphased
    expect(rows.get('MALE HP0')![0]).toBe(1)
    // and says nothing about a haplotype the sample does not have
    expect(rows.get('MALE HP1')![0]).toBeNaN()
  })

  test('a haploid reference call is 0, distinct from missing', async () => {
    const rows = await build({
      features: [makeFeature('v1', { MALE: '0', OTHER: '.' })],
      sources: [
        { name: 'MALE HP0', sampleName: 'MALE', HP: 0 },
        { name: 'OTHER HP0', sampleName: 'OTHER', HP: 0 },
      ],
      sampleInfo: { MALE: haploid, OTHER: haploid },
    })
    expect(rows.get('MALE HP0')![0]).toBe(0)
    expect(rows.get('OTHER HP0')![0]).toBeNaN()
  })
})

// A SplitVcfTabixAdapter opens one file — and so one header — per refName, and
// `getFeaturesInMultipleRegions` merges the per-region streams, so a view
// spanning chr1 and chrY arrives here as features from two different headers.
// The chrY file was called on the male subset, so its header omits the females:
// header position and canonical position part company at the first omission, and
// indexing the canonical order by `sampleIdx` files each chrY haplotype against a
// neighbouring sample. Every write stays in bounds, so nothing errors — the
// dendrogram simply groups haplotypes by someone else's calls.
//
// Mixed ploidy on purpose: chrY males are haploid while everyone is diploid on
// chr1, so `sampleInfo` carries the max and the haploid call has to land on HP0
// and leave HP1 with nothing to say.
describe('getPhasedGenotypeMatrix across two VCF headers', () => {
  // identity-stable per file, as one parser's features are
  const chr1Header = ['FEMALE', 'MALE1', 'MALE2']
  const chrYHeader = ['MALE1', 'MALE2']
  const cohort = [{ name: 'FEMALE' }, { name: 'MALE1' }, { name: 'MALE2' }]
  const info = { FEMALE: diploid, MALE1: diploid, MALE2: diploid }

  test('files a chrY haplotype against the sample whose header slot it is', async () => {
    const rows = await build({
      features: [
        makeVcfFeature('chr1:1', chr1Header, {
          FEMALE: '0|1',
          MALE1: '0|0',
          MALE2: '1|1',
        }),
        makeVcfFeature('chrY:1', chrYHeader, { MALE1: '1', MALE2: '0' }),
      ],
      sources: cohort,
      sampleInfo: info,
    })
    // absent from the chrY file, not the carrier of the first male's call
    expect([...rows.get('FEMALE HP0')!]).toEqual([0, NaN])
    expect([...rows.get('FEMALE HP1')!]).toEqual([1, NaN])
    expect([...rows.get('MALE1 HP0')!]).toEqual([0, 1])
    expect([...rows.get('MALE2 HP0')!]).toEqual([1, 0])
    // and a haploid call says nothing about a haplotype the sample doesn't have
    expect([...rows.get('MALE1 HP1')!]).toEqual([0, NaN])
    expect([...rows.get('MALE2 HP1')!]).toEqual([1, NaN])
  })

  // The other interleaving: the subset header is seen first, so the canonical
  // union is [MALE1, MALE2, FEMALE] and it is the *full* header that disagrees
  // with it position for position.
  test('remaps the full header too when the subset file is seen first', async () => {
    const rows = await build({
      features: [
        makeVcfFeature('chrY:1', chrYHeader, { MALE1: '1', MALE2: '0' }),
        makeVcfFeature('chr1:1', chr1Header, {
          FEMALE: '0|1',
          MALE1: '0|0',
          MALE2: '1|1',
        }),
      ],
      sources: cohort,
      sampleInfo: info,
    })
    expect([...rows.get('FEMALE HP0')!]).toEqual([NaN, 0])
    expect([...rows.get('FEMALE HP1')!]).toEqual([NaN, 1])
    expect([...rows.get('MALE1 HP0')!]).toEqual([1, 0])
    expect([...rows.get('MALE2 HP0')!]).toEqual([0, 1])
  })
})
