import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { executeRenderFeatureData } from './executeRenderFeatureData.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { FeatureDataResult } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

const ctgA = { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }

const transcript = new SimpleFeature({
  uniqueId: 'tx1',
  refName: 'ctgA',
  start: 100,
  end: 400,
  type: 'mRNA',
  id: 'rna-1',
  name: 'vav-RA',
  subfeatures: [
    { uniqueId: 'c1', refName: 'ctgA', start: 100, end: 160, type: 'CDS' },
    { uniqueId: 'c2', refName: 'ctgA', start: 300, end: 400, type: 'CDS' },
  ],
})

function domain(transcriptKey: string) {
  return new SimpleFeature({
    uniqueId: 'pfam-0',
    refName: 'ctgA',
    start: 120,
    end: 340,
    name: 'SH2',
    transcript: transcriptKey,
    subfeatures: [
      { uniqueId: 'b1', refName: 'ctgA', start: 120, end: 160 },
      { uniqueId: 'b2', refName: 'ctgA', start: 300, end: 340 },
    ],
  })
}

type DomainSource = Feature[] | Error

const domainQueries: { refName: string; start: number; end: number }[] = []

function run(
  domains: DomainSource,
  proteinFeatures: Record<string, unknown> = {},
  byteLimit?: number,
) {
  domainQueries.length = 0
  jest
    .mocked(getFeatureAdapterOrThrow)
    .mockImplementation(async ({ adapterConfig }) => {
      const isDomains = adapterConfig.type === 'Domains'
      const rows = isDomains ? domains : [transcript]
      return {
        getRegionByteSize: async () => (isDomains ? 5000 : 100),
        getFeaturesArray: async ({
          refName,
          start,
          end,
        }: {
          refName: string
          start: number
          end: number
        }) => {
          if (isDomains) {
            domainQueries.push({ refName, start, end })
          }
          if (rows instanceof Error) {
            throw rows
          }
          return rows
        },
      } as never
    })
  return executeRenderFeatureData({
    pluginManager: { jexl: createJexlInstance() } as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: { type: 'Genes' },
      displayConfig: mockDisplayConfig(),
      geneGlyphMode: 'all',
      region: ctgA,
      bpPerPx: 1,
      byteLimit,
      proteinFeatures: {
        adapter: { type: 'Domains' },
        color: { value: 'red', field: '' },
        join: { domain: 'transcript', gene: 'id' },
        refName: 'chrA',
        ...proteinFeatures,
      },
    },
  })
}

async function payload(
  domains: DomainSource,
  proteinFeatures?: Record<string, unknown>,
  byteLimit?: number,
) {
  const result = await run(domains, proteinFeatures, byteLimit)
  if (!('__rpcResult' in result)) {
    throw new Error('expected a payload, got the byte gate')
  }
  return result.value
}

function domainRects(data: FeatureDataResult) {
  return data.subfeatureInfos.filter(s => s.type === 'protein_domain')
}

test('a domain track that fails still draws the genes, with a notice', async () => {
  const healthy = await payload([domain('rna-1')])
  const failed = await payload(new Error('HTTP 404 fetching pfam.bed.gz'))
  expect(domainRects(healthy).map(s => s.domainId)).toEqual([
    'pfam-0',
    'pfam-0',
  ])
  expect(healthy.notices).toBeUndefined()
  expect(failed.notices).toEqual([
    'proteinFeatures: HTTP 404 fetching pfam.bed.gz',
  ])
  expect(domainRects(failed)).toEqual([])
  expect(failed.flatbushItems.map(f => f.featureId)).toEqual(['tx1'])
  expect(failed.rectPositions.length).toBe(
    healthy.rectPositions.length - 2 * domainRects(healthy).length,
  )
})

test('an abort still rejects the region', async () => {
  const abort = new Error('aborted')
  abort.name = 'AbortError'
  await expect(run(abort)).rejects.toThrow('aborted')
})

describe('the join', () => {
  it('pairs a domain by the fields it names', async () => {
    const byName = await payload([domain('vav-RA')], {
      join: { domain: 'transcript', gene: 'name' },
    })
    expect(domainRects(byName)).toHaveLength(2)
    expect(byName.notices).toBeUndefined()
  })

  it('draws an unpaired row nowhere, without a notice', async () => {
    const missed = await payload([domain('XM_006568477.3')])
    expect(domainRects(missed)).toEqual([])
    expect(missed.notices).toBeUndefined()
  })

  it('skips a row with no block of any width, keeping the genes', async () => {
    const empty = new SimpleFeature({
      uniqueId: 'pfam-empty',
      refName: 'ctgA',
      start: 120,
      end: 120,
      transcript: 'rna-1',
      subfeatures: [{ uniqueId: 'e1', refName: 'ctgA', start: 120, end: 120 }],
    })
    const data = await payload([empty, domain('rna-1')])
    expect(domainRects(data)).toHaveLength(2)
    expect(data.notices).toBeUndefined()
  })
})

describe('the domain fetch', () => {
  it("spans the drawn transcripts, under the domain file's contig name", async () => {
    await payload([domain('rna-1')])
    expect(domainQueries).toEqual([{ refName: 'chrA', start: 100, end: 400 }])
  })

  it('skips the domains over the byte budget, keeping the genes', async () => {
    const gated = await payload([domain('rna-1')], {}, 1000)
    expect(domainQueries).toEqual([])
    expect(domainRects(gated)).toEqual([])
    expect(gated.flatbushItems.map(f => f.featureId)).toEqual(['tx1'])
    expect(gated.notices).toEqual([
      'proteinFeatures: 5000 bytes of domains here, over the 1000-byte limit',
    ])
  })
})
