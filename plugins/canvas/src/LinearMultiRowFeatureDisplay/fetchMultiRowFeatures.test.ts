import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'

import type { RegionGateMeasurement } from '../shared/CanvasFeatureGateMixin.ts'

const mockRpcCall = jest.fn()

jest.mock('@jbrowse/core/util', () => ({
  getSession: () => ({ rpcManager: { call: mockRpcCall } }),
  getContainingView: () => ({ bpPerPx: 10 }),
}))
jest.mock('@jbrowse/core/util/tracks', () => ({
  getRpcSessionId: () => 'session-1',
}))

const NEEDED = [
  {
    region: { refName: 'ctgA', start: 0, end: 500, assemblyName: 'volvox' },
    displayedRegionIndex: 0,
  },
  {
    region: { refName: 'ctgB', start: 100, end: 400, assemblyName: 'volvox' },
    displayedRegionIndex: 3,
  },
]

function makeSelf() {
  const statusKeys: number[] = []
  const committed: RegionGateMeasurement[][] = []
  return {
    statusKeys,
    committed,
    self: {
      adapterConfig: {},
      partitionField: 'name',
      colorConfig: undefined,
      resolvedByteLimit: () => 1000,
      maxFeatureDensity: undefined,
      // stand-in for MultiRegionDisplayMixin's wrapper; staleness/stop-token
      // rotation is covered by that mixin's own tests
      fetchRegions: (_needed: unknown, work: (ctx: unknown) => unknown) =>
        Promise.resolve(work({ stopToken: 'tok', isStale: () => false })).then(
          () => {},
        ),
      makeRegionStatusCallback: (key: number) => {
        statusKeys.push(key)
        return () => {}
      },
      setRpcData: () => {},
      commitGateMeasurements: (m: RegionGateMeasurement[]) => {
        committed.push(m)
      },
    },
  }
}

beforeEach(() => {
  mockRpcCall.mockReset()
  mockRpcCall.mockResolvedValue({ bytes: 42, featureCount: 7 })
})

describe('fetchMultiRowFeatures', () => {
  // Regression: MultiRowGetFeatures accepts statusCallback and threads it
  // through getRegionByteSize / getFeaturesArray / the packing progress
  // reporter, but the client call site omitted it — so the multi-row track's
  // loading overlay showed no download progress.
  test('passes a per-region statusCallback', async () => {
    const { self, statusKeys } = makeSelf()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural test double
    await fetchMultiRowFeatures(self as any, NEEDED)

    expect(mockRpcCall).toHaveBeenCalledTimes(2)
    for (const call of mockRpcCall.mock.calls) {
      expect(typeof call[2].statusCallback).toBe('function')
    }
    // keyed by displayedRegionIndex so concurrent per-region fetches aggregate
    // into one bar rather than clobbering each other
    expect(statusKeys).toEqual([0, 3])
  })

  test('commits each region measurement against its own span', async () => {
    const { self, committed } = makeSelf()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural test double
    await fetchMultiRowFeatures(self as any, NEEDED)

    // each region pairs with its own result by construction (both come from
    // `needed`), which is what retired the `?? 0` fallback that silently
    // reported a zero-width region — and so an infinite density — on a lookup
    // miss. The span arithmetic itself lives in the gate, not here.
    expect(committed).toEqual([
      [
        {
          displayedRegionIndex: 0,
          region: NEEDED[0]!.region,
          result: { bytes: 42, featureCount: 7 },
        },
        {
          displayedRegionIndex: 3,
          region: NEEDED[1]!.region,
          result: { bytes: 42, featureCount: 7 },
        },
      ],
    ])
  })
})
