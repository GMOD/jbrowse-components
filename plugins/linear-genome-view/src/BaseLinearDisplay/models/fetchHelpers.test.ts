import { checkByteEstimate } from './fetchHelpers.ts'

import type { ByteEstimateConfig } from './fetchHelpers.ts'

// checkByteEstimate is now just the estimate RPC + the force-load-floor
// short-circuit; the too-large *verdict* (resolveByteLimit precedence,
// evaluateRegionTooLarge) is derived from the returned stats by
// RegionTooLargeMixin and unit-tested in regionTooLargeUtils.test.ts, so this
// only covers the RPC gating/plumbing.
function makeConfig(
  overrides: Partial<ByteEstimateConfig> = {},
): ByteEstimateConfig {
  return {
    adapterConfig: { type: 'BamAdapter' },
    visibleBp: 50_000,
    ...overrides,
  }
}

function makeRpcManager(stats: Record<string, unknown>) {
  return {
    call: jest.fn().mockResolvedValue(stats),
  }
}

const notStale = { isStale: () => false }
const regions = [
  { refName: 'chr1', start: 0, end: 50000, assemblyName: 'hg38' },
]

describe('checkByteEstimate', () => {
  it('skips the RPC below AUTO_FORCE_LOAD_BP (20kbp), returning undefined', async () => {
    const rpc = makeRpcManager({ bytes: 999_999_999 })

    const result = await checkByteEstimate(
      rpc,
      'session1',
      regions,
      makeConfig({ visibleBp: 19_999 }),
      notStale,
    )

    expect(result).toBeUndefined()
    expect(rpc.call).not.toHaveBeenCalled()
  })

  it('runs the RPC at exactly the threshold (visibleBp < 20,000 is false)', async () => {
    const rpc = makeRpcManager({ bytes: 999_999 })

    const result = await checkByteEstimate(
      rpc,
      'session1',
      regions,
      makeConfig({ visibleBp: 20_000 }),
      notStale,
    )

    expect(result).toEqual({ bytes: 999_999 })
    expect(rpc.call).toHaveBeenCalled()
  })

  it('returns the adapter stats verbatim above the threshold', async () => {
    const stats = { bytes: 10_000_000, fetchSizeLimit: 5_000_000 }
    const rpc = makeRpcManager(stats)

    const result = await checkByteEstimate(
      rpc,
      'session1',
      regions,
      makeConfig(),
      notStale,
    )

    expect(result).toEqual(stats)
  })

  it('returns undefined when the context becomes stale during the RPC', async () => {
    const rpc = makeRpcManager({ bytes: 500_000 })

    const result = await checkByteEstimate(
      rpc,
      'session1',
      regions,
      makeConfig(),
      { isStale: () => true },
    )

    expect(result).toBeUndefined()
  })

  it('passes the regions and adapterConfig through to the RPC', async () => {
    const rpc = makeRpcManager({ bytes: 100 })
    const adapterConfig = { type: 'CramAdapter', uri: 'test.cram' }
    const testRegions = [
      { refName: 'chr1', start: 100, end: 200, assemblyName: 'hg38' },
      { refName: 'chr2', start: 0, end: 500, assemblyName: 'hg38' },
    ]

    await checkByteEstimate(
      rpc,
      'session-abc',
      testRegions,
      makeConfig({ adapterConfig }),
      notStale,
    )

    expect(rpc.call).toHaveBeenCalledWith(
      'session-abc',
      'CoreGetRegionByteEstimate',
      { regions: testRegions, adapterConfig },
    )
  })
})
