import {
  fetchMafAlignmentData,
  fetchMafSummaryData,
  unionSampleSets,
} from './fetchMafData.ts'

import type { Sample } from '../types.ts'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

const mockRpcCall = jest.fn()

jest.mock('@jbrowse/core/util', () => ({
  getSession: () => ({ rpcManager: { call: mockRpcCall } }),
}))
jest.mock('@jbrowse/core/util/tracks', () => ({
  getRpcSessionId: () => 'session-1',
}))

function sample(id: string): Sample {
  return { id, label: id }
}

function result(...ids: string[]) {
  return {
    result: {
      samples: ids.map(sample),
      treeNewick: undefined,
      samplesCanonical: false,
    },
  }
}

describe('unionSampleSets', () => {
  test('skips a region that discovered nothing', () => {
    // A sample-discovery track over a viewport whose first buffered region is a
    // MAF gap (no blocks → no samples) but a later region has alignments.
    const set = unionSampleSets([result(), result('hg38', 'mm10')])
    expect(set?.samples.map(s => s.id)).toEqual(['hg38', 'mm10'])
  })

  test('unions regions that discovered different genomes, first-seen order', () => {
    // Neither region's set can stand for the batch: the worker drops samples
    // missing from the client's order, so picking one hides the other's rows.
    const set = unionSampleSets([result('hg38', 'mm10'), result('hg38', 'rn6')])
    expect(set?.samples.map(s => s.id)).toEqual(['hg38', 'mm10', 'rn6'])
  })

  test('collapses to the one set when every region reports it', () => {
    // Configured-samples tracks return the same complete set for every region.
    const set = unionSampleSets([result('hg38'), result('hg38')])
    expect(set?.samples.map(s => s.id)).toEqual(['hg38'])
  })

  test('is empty when every region is empty', () => {
    // All-gap viewport; `setSamples` unions this into the known rows, so an
    // empty batch leaves them alone rather than blanking them.
    const set = unionSampleSets([result(), result()])
    expect(set?.samples).toEqual([])
  })

  test('returns undefined when there are no results', () => {
    expect(unionSampleSets([])).toBeUndefined()
  })
})

const NEEDED = [
  {
    region: { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 0,
  },
  {
    region: { refName: 'ctgB', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 3,
  },
]

// Duck-typed stand-in for the display: `fetchRegions` normally comes from
// MultiRegionDisplayMixin and owns stop-token rotation + staleness, none of
// which this test exercises — it just runs the work callback with a fresh ctx.
function makeSelf() {
  const statusKeys: number[] = []
  const cleared: string[] = []
  return {
    statusKeys,
    cleared,
    self: {
      adapterConfig: {},
      annotationDataActive: false,
      annotationAdapterConfig: undefined,
      fetchRegions: (_needed: unknown, work: (ctx: FetchContext) => unknown) =>
        Promise.resolve(work({ stopToken: 'tok', isStale: () => false })).then(
          () => {},
        ),
      makeRegionStatusCallback: (key: number) => {
        statusKeys.push(key)
        return () => {}
      },
      setRpcData: () => {},
      setSummaryData: () => {},
      setFramesData: () => {},
      clearAlignmentData: () => {
        cleared.push('alignment')
      },
      setSamples: () => {},
    },
  }
}

beforeEach(() => {
  mockRpcCall.mockReset()
  mockRpcCall.mockResolvedValue({
    samples: [],
    treeNewick: undefined,
    samplesCanonical: false,
    regionData: { blocks: [] },
    records: [],
  })
})

// Regression: the MAF RPCs accept `statusCallback` (BaseMafRpcArgs), the
// executors forward it into the adapter opts, and the adapters wrap their reads
// in `updateStatus` — but the client call sites omitted it, so a MAF track's
// loading overlay showed no download progress at all. Pin the wiring at the one
// place that was missing.
describe('MAF fetch progress reporting', () => {
  test.each([
    ['alignment', fetchMafAlignmentData],
    ['summary', fetchMafSummaryData],
  ])('%s fetch passes a per-region statusCallback', async (_name, fetchFn) => {
    const { self, statusKeys } = makeSelf()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural test double
    await fetchFn(self as any, NEEDED)

    expect(mockRpcCall).toHaveBeenCalledTimes(2)
    for (const call of mockRpcCall.mock.calls) {
      expect(typeof call[2].statusCallback).toBe('function')
    }
    // keyed by displayedRegionIndex so the two concurrent per-region fetches
    // aggregate into one bar rather than clobbering each other
    expect(statusKeys).toEqual([0, 3])
  })
})

// The swap is one-directional on purpose. Entering summary mode drops the
// alignment blocks so the GPU sequence canvas paints nothing under the summary
// overlay; zooming back in keeps the summary records, because `isCacheValid`
// tests `summaryDataMap` in summary mode and that retention is what lets the
// zoom back out reuse the cache rather than re-read the summary adapter.
describe('summary/detail data swap', () => {
  test('the summary fetch drops alignment blocks', async () => {
    const { self, cleared } = makeSelf()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural test double
    await fetchMafSummaryData(self as any, NEEDED)
    expect(cleared).toEqual(['alignment'])
  })

  test('the alignment fetch keeps summary records', async () => {
    const { self, cleared } = makeSelf()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural test double
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(cleared).toEqual([])
  })
})
