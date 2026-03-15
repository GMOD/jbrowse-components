import { checkByteEstimate } from './fetchHelpers.ts'

import type { ByteEstimateConfig } from './fetchHelpers.ts'

function makeConfig(overrides: Partial<ByteEstimateConfig> = {}): ByteEstimateConfig {
  return {
    adapterConfig: { type: 'BamAdapter' },
    fetchSizeLimit: 1_000_000,
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
const regions = [{ refName: 'chr1', start: 0, end: 50000, assemblyName: 'hg38' }]

describe('checkByteEstimate', () => {
  it('skips check when visibleBp < AUTO_FORCE_LOAD_BP (20kbp)', async () => {
    const rpc = makeRpcManager({ bytes: 999_999_999 })
    const config = makeConfig({ visibleBp: 10_000 })

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).toBeNull()
    expect(rpc.call).not.toHaveBeenCalled()
  })

  it('returns tooLarge when bytes exceed display fetchSizeLimit', async () => {
    const rpc = makeRpcManager({ bytes: 2_000_000 })
    const config = makeConfig({ fetchSizeLimit: 1_000_000 })

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).not.toBeNull()
    expect(result!.tooLarge).toBe(true)
    expect(result!.reason).toContain('too much data')
  })

  it('uses adapter fetchSizeLimit when available and higher', async () => {
    // Adapter returns fetchSizeLimit=5MB, display config has 1MB.
    // Bytes are 3MB — should NOT be too large because adapter says 5MB is OK.
    const rpc = makeRpcManager({ bytes: 3_000_000, fetchSizeLimit: 5_000_000 })
    const config = makeConfig({ fetchSizeLimit: 1_000_000 })

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).not.toBeNull()
    expect(result!.tooLarge).toBe(false)
  })

  it('returns tooLarge when bytes exceed adapter fetchSizeLimit', async () => {
    // Adapter returns fetchSizeLimit=5MB, bytes are 6MB — too large.
    const rpc = makeRpcManager({ bytes: 6_000_000, fetchSizeLimit: 5_000_000 })
    const config = makeConfig({ fetchSizeLimit: 1_000_000 })

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).not.toBeNull()
    expect(result!.tooLarge).toBe(true)
  })

  it('uses display limit when adapter does not return fetchSizeLimit', async () => {
    // No fetchSizeLimit in stats — falls back to display config's 1MB.
    const rpc = makeRpcManager({ bytes: 1_500_000 })
    const config = makeConfig({ fetchSizeLimit: 1_000_000 })

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).not.toBeNull()
    expect(result!.tooLarge).toBe(true)
  })

  it('returns not tooLarge when bytes are within limit', async () => {
    const rpc = makeRpcManager({ bytes: 500_000 })
    const config = makeConfig({ fetchSizeLimit: 1_000_000 })

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).not.toBeNull()
    expect(result!.tooLarge).toBe(false)
  })

  it('returns null when context becomes stale during RPC call', async () => {
    const rpc = makeRpcManager({ bytes: 500_000 })
    const config = makeConfig()
    const staleCtx = { isStale: () => true }

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      staleCtx,
    )

    expect(result).toBeNull()
  })

  it('not tooLarge when stats have no bytes field', async () => {
    const rpc = makeRpcManager({ featureDensity: 0.5 })
    const config = makeConfig()

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).not.toBeNull()
    expect(result!.tooLarge).toBe(false)
  })

  it('uses higher of adapter and display limits', async () => {
    // Edge case: display config has higher limit than adapter.
    // Should use the higher one (display's 10MB > adapter's 5MB).
    const rpc = makeRpcManager({ bytes: 7_000_000, fetchSizeLimit: 5_000_000 })
    const config = makeConfig({ fetchSizeLimit: 10_000_000 })

    const result = await checkByteEstimate(
      rpc as any,
      'session1',
      regions,
      config,
      notStale,
    )

    expect(result).not.toBeNull()
    expect(result!.tooLarge).toBe(false)
  })
})
