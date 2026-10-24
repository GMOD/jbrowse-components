import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { executeRenderFeatureData } from './executeRenderFeatureData.ts'
import { mockDisplayConfig } from './testUtils.ts'
import { fitToParts, transcriptParts } from './transcriptFeatures.ts'

import type {
  FeatureDataResult,
  TranscriptFeatureTrackArg,
} from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

const ctgA = { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }

function cds(start: number, end: number) {
  return { uniqueId: `c${start}`, refName: 'ctgA', start, end, type: 'CDS' }
}

const transcript = new SimpleFeature({
  uniqueId: 'tx1',
  refName: 'ctgA',
  start: 100,
  end: 400,
  type: 'mRNA',
  id: 'rna-1',
  name: 'vav-RA',
  subfeatures: [cds(100, 160), cds(300, 400)],
})

let rowCount = 0

function row(blocks: [number, number][], fields: Record<string, unknown> = {}) {
  rowCount++
  return new SimpleFeature({
    uniqueId: `pfam-${rowCount}`,
    refName: 'ctgA',
    start: blocks[0]![0],
    end: blocks.at(-1)![1],
    name: 'SH2',
    ...fields,
    subfeatures: blocks.map(([start, end], i) => ({
      uniqueId: `pfam-${rowCount}-${i}`,
      refName: 'ctgA',
      start,
      end,
    })),
  })
}

const domain = (transcriptKey: string) =>
  row(
    [
      [120, 160],
      [300, 340],
    ],
    { transcript: transcriptKey },
  )

type DomainSource = Feature[] | Error

const domainQueries: { refName: string; start: number; end: number }[] = []

function run(
  domains: DomainSource,
  track: Partial<TranscriptFeatureTrackArg> = {},
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
      transcriptFeatures: {
        tracks: [
          {
            trackId: 'pfam',
            adapter: { type: 'Domains' },
            refName: 'chrA',
            on: 'cds',
            join: { field: 'transcript', transcriptField: 'id' },
            filter: [],
            ...track,
          },
        ],
        color: { value: 'red', field: '' },
      },
    },
  })
}

async function payload(
  domains: DomainSource,
  track?: Partial<TranscriptFeatureTrackArg>,
  byteLimit?: number,
) {
  const result = await run(domains, track, byteLimit)
  if (!('__rpcResult' in result)) {
    throw new Error('expected a payload, got the byte gate')
  }
  return result.value
}

function attachedRects(data: FeatureDataResult) {
  return data.subfeatureInfos.filter(s => s.domainId !== undefined)
}

test('a track that fails still draws the genes, with a notice', async () => {
  const healthy = await payload([domain('rna-1')])
  const failed = await payload(new Error('HTTP 404 fetching pfam.bed.gz'))
  expect(attachedRects(healthy).map(s => [s.domainId, s.domainTrack])).toEqual([
    ['pfam-1', 0],
    ['pfam-1', 0],
  ])
  expect(healthy.notices).toBeUndefined()
  expect(failed.notices).toEqual([
    'transcriptFeatures: HTTP 404 fetching pfam.bed.gz',
  ])
  expect(attachedRects(failed)).toEqual([])
  expect(failed.flatbushItems.map(f => f.featureId)).toEqual(['tx1'])
  expect(failed.rectPositions.length).toBe(
    healthy.rectPositions.length - 2 * attachedRects(healthy).length,
  )
})

test('an abort still rejects the region', async () => {
  const abort = new Error('aborted')
  abort.name = 'AbortError'
  await expect(run(abort)).rejects.toThrow('aborted')
})

describe('the join', () => {
  it('pairs a row by the fields it names', async () => {
    const byName = await payload([domain('vav-RA')], {
      join: { field: 'transcript', transcriptField: 'name' },
    })
    expect(attachedRects(byName)).toHaveLength(2)
    expect(byName.notices).toBeUndefined()
  })

  it('says so where rows met the transcript and none paired', async () => {
    const missed = await payload([domain('XM_006568477.3')])
    expect(attachedRects(missed)).toEqual([])
    expect(missed.notices).toEqual([
      'transcriptFeatures: no row of "pfam" here fits a transcript\'s coding exons with its id equal to the row\'s transcript',
    ])
  })

  it('fits by shape alone while it names no field', async () => {
    const data = await payload([domain('another-isoform')], {
      join: { field: '', transcriptField: 'id' },
    })
    expect(attachedRects(data)).toHaveLength(2)
  })

  it('draws a row once where another repeats its name and blocks', async () => {
    const data = await payload([domain('rna-1'), domain('rna-2')], {
      join: { field: '', transcriptField: 'id' },
    })
    expect(attachedRects(data)).toHaveLength(2)
  })

  it('skips a row with no block of any width, keeping the genes', async () => {
    const empty = row([[120, 120]], { transcript: 'rna-1' })
    const data = await payload([empty, domain('rna-1')])
    expect(attachedRects(data)).toHaveLength(2)
    expect(data.notices).toBeUndefined()
  })
})

test("a track's filter drops the rows it fails", async () => {
  const reviewed = row([[120, 150]], { status: 'swissprot', name: 'A' })
  const unreviewed = row([[130, 160]], { status: 'trembl', name: 'B' })
  const data = await payload([reviewed, unreviewed], {
    join: { field: '', transcriptField: 'id' },
    filter: [{ field: 'status', equal: 'swissprot' }],
  })
  expect(attachedRects(data).map(s => s.displayLabel)).toEqual(['A'])
})

describe('the fetch', () => {
  it("spans the features, under the track's contig name", async () => {
    await payload([domain('rna-1')])
    expect(domainQueries).toEqual([{ refName: 'chrA', start: 100, end: 400 }])
  })

  it('skips a track over the byte budget, keeping the genes', async () => {
    const gated = await payload([domain('rna-1')], {}, 1000)
    expect(attachedRects(gated)).toEqual([])
    expect(gated.flatbushItems.map(f => f.featureId)).toEqual(['tx1'])
    expect(gated.notices).toEqual([
      'transcriptFeatures: 5000 bytes of "pfam" here, over the 1000-byte limit',
    ])
  })
})

describe('fitToParts', () => {
  const exons: [number, number][] = [
    [100, 160],
    [300, 400],
    [500, 600],
  ]

  it('fits blocks lying in consecutive exons', () => {
    expect(
      fitToParts(
        [
          [120, 160],
          [300, 340],
        ],
        exons,
      ),
    ).toEqual([
      [120, 160],
      [300, 340],
    ])
  })

  it('refuses a row that skips an exon, or that an exon sits inside', () => {
    expect(
      fitToParts(
        [
          [120, 160],
          [500, 540],
        ],
        exons,
      ),
    ).toBeUndefined()
  })

  it('fits blocks that end inside their exon, as an alignment gap does', () => {
    expect(
      fitToParts(
        [
          [110, 130],
          [140, 160],
          [300, 310],
        ],
        exons,
      ),
    ).toEqual([
      [110, 130],
      [140, 160],
      [300, 310],
    ])
  })

  it('clips a codon of overshoot and refuses more', () => {
    expect(fitToParts([[130, 163]], exons)).toEqual([[130, 160]])
    expect(fitToParts([[297, 320]], exons)).toEqual([[300, 320]])
    expect(fitToParts([[130, 164]], exons)).toBeUndefined()
  })

  it('refuses a row in an intron and fits a single codon in an exon', () => {
    expect(fitToParts([[200, 203]], exons)).toBeUndefined()
    expect(fitToParts([[350, 353]], exons)).toEqual([[350, 353]])
  })
})

describe('transcriptParts', () => {
  it('reads a BED transcript split at its thick ends as whole exons', () => {
    const bed = new SimpleFeature({
      uniqueId: 'bed',
      refName: 'ctgA',
      start: 50,
      end: 400,
      type: 'mRNA',
      subfeatures: [
        {
          uniqueId: 'u',
          refName: 'ctgA',
          start: 50,
          end: 100,
          type: 'five_prime_UTR',
        },
        cds(100, 160),
        cds(300, 400),
      ],
    })
    expect(transcriptParts(bed, 'exon')).toEqual([
      [50, 160],
      [300, 400],
    ])
    expect(transcriptParts(bed, 'cds')).toEqual([
      [100, 160],
      [300, 400],
    ])
  })

  it('gives a non-coding transcript no coding parts', () => {
    const lnc = new SimpleFeature({
      uniqueId: 'lnc',
      refName: 'ctgA',
      start: 50,
      end: 400,
      type: 'lnc_RNA',
      subfeatures: [
        { uniqueId: 'e', refName: 'ctgA', start: 50, end: 400, type: 'exon' },
      ],
    })
    expect(transcriptParts(lnc, 'cds')).toEqual([])
    expect(transcriptParts(lnc, 'exon')).toEqual([[50, 400]])
  })
})
