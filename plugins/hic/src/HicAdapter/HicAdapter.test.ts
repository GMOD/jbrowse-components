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
function makeMockParser() {
  return {
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE']),
    getContactRecords: (
      _norm: string,
      ref: { chr: string },
      ref2: { chr: string },
    ) => {
      if (ref.chr !== ref2.chr) {
        throw new Error(`No data available for resolution: map ${ref.chr}-${ref2.chr}`)
      }
      return Promise.resolve([{ bin1: 0, bin2: 0, counts: 5 }])
    },
  }
}

function makeAdapter() {
  const adapter = new HicAdapter(
    configSchema.create({
      hicLocation: { uri: 'test.hic', locationType: 'UriLocation' },
    }),
  )
  ;(adapter as unknown as { hic: ReturnType<typeof makeMockParser> }).hic =
    makeMockParser()
  return adapter
}

test('a missing inter-chromosomal pair does not fail the whole multi-region fetch', async () => {
  const adapter = makeAdapter()
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
