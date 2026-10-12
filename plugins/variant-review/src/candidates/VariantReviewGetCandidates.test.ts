import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'

// Real adapters over the repo's volvox call set, reached by path: this plugin
// takes no dependency on the variants plugin, and the RPC duck-types the VCF
// feature, which is the contract under test.
import VcfAdapter from '../../../variants/src/VcfAdapter/VcfAdapter.ts'
import vcfConfigSchema from '../../../variants/src/VcfAdapter/configSchema.ts'
import VcfTabixAdapter from '../../../variants/src/VcfTabixAdapter/VcfTabixAdapter.ts'
import tabixConfigSchema from '../../../variants/src/VcfTabixAdapter/configSchema.ts'
import { VariantReviewGetCandidates } from './VariantReviewGetCandidates.ts'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache')

const volvox = (name: string) =>
  require.resolve(`../../../../test_data/volvox/${name}`)

function tabixAdapter() {
  return new VcfTabixAdapter(
    tabixConfigSchema.create({
      vcfGzLocation: {
        localPath: volvox('volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'TBI',
        location: {
          localPath: volvox('volvox.filtered.vcf.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
}

function plainAdapter(file = 'volvox.filtered.vcf') {
  return new VcfAdapter(
    vcfConfigSchema.create({
      vcfLocation: {
        localPath: volvox(file),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

const pluginManager = new PluginManager()

function run(
  adapter: unknown,
  extra?: Partial<Parameters<VariantReviewGetCandidates['execute']>[0]>,
) {
  jest.mocked(getAdapter).mockResolvedValue({ dataAdapter: adapter } as never)
  return new VariantReviewGetCandidates(pluginManager).execute({
    sessionId: 'test',
    adapterConfig: {},
    assemblyName: 'volvox',
    regions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50001 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 6079 },
    ],
    canonicalRefNames: ['ctgA', 'ctgB'],
    infoFields: ['AF', 'DP'],
    maxCandidates: 50_000,
    ...extra,
  })
}

test.each([
  ['tabix', tabixAdapter],
  ['plain', () => plainAdapter()],
])('%s: every record, in file order, with no genotypes', async (_l, make) => {
  const { candidates, truncated, duplicates } = await run(make())
  expect(truncated).toBe(false)
  expect(duplicates).toBe(0)
  expect(candidates).toHaveLength(45)
  const starts = candidates.map(c => c.start)
  expect(starts).toEqual([...starts].sort((a, b) => a - b))
  for (const c of candidates) {
    expect(c.refName).toBe('ctgA')
    expect(c.pos1).toBe(c.start + 1)
    // the file carries lower-case alleles (`ctt`), which the id upper-cases
    expect(c.id).toBe(
      `volvox:ctgA:${c.pos1}:${c.ref.toUpperCase()}:${c.alt.join(',').toUpperCase()}`,
    )
    expect(Object.keys(c.info).every(k => k === 'AF' || k === 'DP')).toBe(true)
  }
  const wire = JSON.stringify(candidates)
  expect(wire).not.toMatch(/samples|genotypes|"GT"/)
})

test('the plain and tabix adapters agree on ids', async () => {
  const a = await run(tabixAdapter())
  const b = await run(plainAdapter())
  expect(a.candidates.map(c => c.id)).toEqual(b.candidates.map(c => c.id))
})

test('an aliased contig files candidates under the canonical name', async () => {
  // this copy names the contig `ctga`; the region reaching the worker is
  // already renamed into the file's namespace, the canonical name rides beside
  const lower = await run(plainAdapter('volvox.filtered.lowercase.vcf'), {
    regions: [
      { assemblyName: 'volvox', refName: 'ctga', start: 0, end: 50001 },
    ],
    canonicalRefNames: ['ctgA'],
  })
  expect(lower.candidates).toHaveLength(45)
  const upper = await run(plainAdapter())
  expect(lower.candidates.map(c => c.id)).toEqual(
    upper.candidates.map(c => c.id),
  )
})

test('the canonical refName is what a candidate is filed under', async () => {
  const { candidates } = await run(tabixAdapter(), {
    canonicalRefNames: ['A', 'B'],
  })
  expect(candidates[0]!.refName).toBe('A')
  expect(candidates[0]!.id).toMatch(/^volvox:A:/)
})

test('truncates at maxCandidates', async () => {
  const { candidates, truncated } = await run(tabixAdapter(), {
    maxCandidates: 10,
  })
  expect(candidates).toHaveLength(10)
  expect(truncated).toBe(true)
})

test('applies the display filter chain', async () => {
  const all = await run(tabixAdapter())
  const firstStart = all.candidates[0]!.start
  const { candidates } = await run(tabixAdapter(), {
    filters: new SerializableFilterChain({
      filters: [`jexl:get(feature,'start') > ${firstStart}`],
      jexl: pluginManager.jexl,
    }),
  })
  expect(candidates.length).toBe(all.candidates.length - 1)
})
