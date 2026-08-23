import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'

import type { RegionGateMeasurement } from '../shared/CanvasFeatureGateMixin.ts'
import type { RpcStatus } from '@jbrowse/core/util'

const mockRpcCall = jest.fn()

// the real barrel apart from the two session lookups: `fetchEachRegion` builds
// each region's status slot out of `createStatusFanOut` from here, and a stub
// would be testing the stub
jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
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
  const reported: RpcStatus[] = []
  // what `fetchEachRegion` marked loaded: a region the worker refused is
  // deliberately absent, so `loadedRegions` never claims a span nothing stored
  const loadedIndices: number[] = []
  const committed: RegionGateMeasurement[][] = []
  return {
    reported,
    committed,
    loadedIndices,
    self: {
      adapterConfig: {},
      // the whole settings payload, exactly as the model hands it over — the
      // fetch spreads this rather than re-reading the slots, so the bytes sent
      // and the cache key they are stored under stay one expression
      rpcProps: () => ({
        partitionField: 'name',
        lengthField: '',
        colorConfig: undefined,
      }),
      resolvedByteLimit: () => 1000,
      // stand-in for MultiRegionDisplayMixin's wrapper; staleness/stop-token
      // rotation is covered by that mixin's own tests
      fetchRegions: (_needed: unknown, work: (ctx: unknown) => unknown) =>
        Promise.resolve(
          work({
            stopToken: 'tok',
            isStale: () => false,
            statusCallback: (s: RpcStatus) => reported.push(s),
            // the real envelope, over this file's mocked rpcManager, so the
            // fetch under test exercises the same injection production does
            callRpc(
              this: { stopToken: string; statusCallback: unknown },
              method: string,
              args: Record<string, unknown>,
            ) {
              return mockRpcCall('session-1', method, {
                ...args,
                stopToken: this.stopToken,
                statusCallback: this.statusCallback,
              })
            },
            commitRegion: (idx: number) => {
              loadedIndices.push(idx)
            },
          }),
        ).then(() => {}),
      setRpcData: () => {},
      // the snapshot the mixin takes at issue; this stub stands in for a
      // measured view under an active gate
      gateFetchState: () => ({
        viewport: { spanBp: 10_000, key: 'k' },
        gated: true,
      }),
      commitGateMeasurements: (m: RegionGateMeasurement[]) => {
        committed.push(m)
      },
      // the byte half, which the fan-out helper commits for every display
      commitFetchBytes: () => {},
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
    const { self, reported } = makeSelf()
    await fetchMultiRowFeatures(self as any, NEEDED)

    expect(mockRpcCall).toHaveBeenCalledTimes(2)
    const sent = mockRpcCall.mock.calls.map(c => c[2].statusCallback)
    for (const cb of sent) {
      expect(typeof cb).toBe('function')
    }
    // a slot each, not the fetch's one callback twice, so concurrent per-region
    // fetches aggregate into one bar rather than clobbering each other
    expect(sent[0]).not.toBe(sent[1])
    sent[0]({ message: 'Downloading', current: 30, total: 100 })
    sent[1]({ message: 'Downloading', current: 10, total: 100 })
    expect(reported.at(-1)).toEqual({
      message: 'Downloading',
      current: 40,
      total: 200,
    })
  })

  // The payload's user settings come from `rpcProps()` — the same expression
  // `SettingsInvalidate` serializes into the cache key. Re-reading the slots
  // here instead let the two drift: a field added to only one side either never
  // invalidates or refetches for nothing. ARCHITECTURE.md, "the cache key is
  // the return value, not the reads".
  test('sends the rpcProps payload rather than re-reading the slots', async () => {
    const { self } = makeSelf()
    await fetchMultiRowFeatures(self as any, NEEDED)

    for (const call of mockRpcCall.mock.calls) {
      expect(call[2]).toMatchObject(self.rpcProps())
    }
  })

  test('commits each region measurement against its own span', async () => {
    const { self, committed } = makeSelf()
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

  // A refused region stores nothing, so it must not be marked loaded: with the
  // span claimed anyway, `isBlockCovered` reads the viewport as covered against
  // data nobody received, the plan answers `covered` forever, and the ordinary
  // fetch that IS the gate's re-measure never runs again. Invisible on a region
  // fetched for the first time, permanent on one the reader already had data
  // for. See `RegionFetchContext`.
  test('marks the regions that stored data, and only those', async () => {
    const { self, loadedIndices } = makeSelf()
    mockRpcCall.mockImplementation((_s, _m, args: any) =>
      Promise.resolve(
        args.region.start === NEEDED[0]!.region.start
          ? { regionTooLarge: true, bytes: 9_000_000 }
          : { bytes: 42, featureCount: 7 },
      ),
    )
    await fetchMultiRowFeatures(self as any, NEEDED)

    expect(loadedIndices).toEqual([NEEDED[1]!.displayedRegionIndex])
  })
})
