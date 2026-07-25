import { fetchMafAlignmentData, fetchMafSummaryData } from './fetchMafData.ts'

import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

const mockRpcCall = jest.fn()

jest.mock('@jbrowse/core/util', () => ({
  getSession: () => ({ rpcManager: { call: mockRpcCall } }),
}))
jest.mock('@jbrowse/core/util/tracks', () => ({
  getRpcSessionId: () => 'session-1',
}))

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
  return {
    statusKeys,
    self: {
      adapterConfig: {},
      orderedSampleIds: undefined,
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
      clearAlignmentData: () => {},
      setSamples: () => {},
    },
  }
}

beforeEach(() => {
  mockRpcCall.mockReset()
  mockRpcCall.mockResolvedValue({
    samples: [],
    treeNewick: undefined,
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
