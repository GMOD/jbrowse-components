import { isAbortException } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'

import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

import type { Region } from '@jbrowse/core/util/types'

const metadata = {
  chromosomes: [
    { name: '1', size: 1000000, index: 1 },
    { name: '2', size: 1000000, index: 2 },
  ],
  resolutions: [100000],
}

// Mock parser whose inter-chromosomal query throws (mirrors hic-straw throwing
// when a chr-pair matrix lacks the requested resolution), while intra-chrom
// queries succeed.
// Resolve a refName to the file chromosome index the way hic-straw does, so the
// adapter's transpose detection matches its query transpose.
function chrIndex(chr: string) {
  return Promise.resolve(metadata.chromosomes.find(c => c.name === chr)?.index)
}

function makeMockParser() {
  return {
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE']),
    getChromosomeIndex: chrIndex,
    getContactRecords: (
      _norm: string,
      ref: { chr: string },
      ref2: { chr: string },
    ) => {
      if (ref.chr !== ref2.chr) {
        throw new Error(
          `No data available for resolution: map ${ref.chr}-${ref2.chr}`,
        )
      }
      return Promise.resolve([{ bin1: 0, bin2: 0, counts: 5 }])
    },
  }
}

function makeAdapter(hic: {
  getMetaData: () => Promise<typeof metadata>
  getNormalizationOptions: () => Promise<string[]>
  getChromosomeIndex: (chr: string) => Promise<number | undefined>
  getContactRecords: (...args: never[]) => Promise<unknown>
}) {
  const adapter = new HicAdapter(
    configSchema.create({
      hicLocation: { uri: 'test.hic', locationType: 'UriLocation' },
    }),
  )
  ;(adapter as unknown as { hic: typeof hic }).hic = hic
  return adapter
}

test('a missing inter-chromosomal pair does not fail the whole multi-region fetch', async () => {
  const adapter = makeAdapter(makeMockParser())
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
  ]

  const { records } = await adapter.getMultiRegionContactRecords(regions, {
    resolution: 100000,
    normalization: 'NONE',
  })

  // both intra-chromosomal pairs (0,0) and (1,1) survive; the throwing inter
  // pair (0,1) contributes nothing instead of aborting the fetch
  expect(records).toHaveLength(2)
  expect(records.map(r => [r.region1Idx, r.region2Idx])).toEqual([
    [0, 0],
    [1, 1],
  ])
})

test('an already-stopped stopToken aborts the multi-region fetch', async () => {
  const adapter = makeAdapter(makeMockParser())
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
  ]
  const stopToken = createStopToken()
  stopStopToken(stopToken)

  const err = await adapter
    .getMultiRegionContactRecords(regions, {
      resolution: 100000,
      normalization: 'NONE',
      stopToken,
    })
    .then(() => undefined)
    .catch((e: unknown) => e)
  expect(err).toBeDefined()
  expect(isAbortException(err)).toBe(true)
})

test('un-swaps bin1/bin2 when hic-straw transposed the query (idx1 > idx2)', async () => {
  // region1 is the higher-index chromosome, so hic-straw transposes and returns
  // bins along the swapped axis; the adapter must un-swap using the index it
  // resolves through getChromosomeIndex so bin1 maps back to region1.
  const adapter = makeAdapter({
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE']),
    getChromosomeIndex: chrIndex,
    getContactRecords: () => Promise.resolve([{ bin1: 7, bin2: 3, counts: 9 }]),
  })
  const regions: Region[] = [
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
  ]

  const { records } = await adapter.getMultiRegionContactRecords(regions, {
    resolution: 100000,
    normalization: 'NONE',
  })

  const interPair = records.find(r => r.region1Idx === 0 && r.region2Idx === 1)
  expect(interPair).toEqual({
    bin1: 3,
    bin2: 7,
    counts: 9,
    region1Idx: 0,
    region2Idx: 1,
  })
})
