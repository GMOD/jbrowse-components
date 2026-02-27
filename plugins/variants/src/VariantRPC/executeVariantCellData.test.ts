import { executeVariantCellData } from './executeVariantCellData.ts'

// Minimal mock adapter that returns a configurable byte estimate
function mockCreateAdapter(bytes: number) {
  return {
    getMultiRegionFeatureDensityStats: async () => ({
      bytes,
      fetchSizeLimit: 1_000_000,
    }),
    getFeaturesInMultipleRegions: () => {
      const { Observable } = require('rxjs')
      return new Observable((subscriber: { complete: () => void }) => {
        subscriber.complete()
      })
    },
  }
}

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: async (
    _pluginManager: unknown,
    _sessionId: string,
    adapterConfig: { mockBytes: number },
  ) => ({
    dataAdapter: mockCreateAdapter(adapterConfig.mockBytes),
  }),
}))

const baseArgs = {
  mode: 'regular' as const,
  sources: [{ name: 'sample1' }],
  renderingMode: 'alleleCount',
  referenceDrawingMode: 'skip',
  minorAlleleFrequencyFilter: 0,
  lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
  regions: [
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'test' },
  ],
  sessionId: 'test-session',
  bpPerPx: 1,
  statusCallback: () => {},
}

describe('executeVariantCellData regionTooLarge', () => {
  it('returns regionTooLarge when bytes exceed limit', async () => {
    const result = await executeVariantCellData({
      pluginManager: {} as any,
      args: {
        ...baseArgs,
        adapterConfig: { mockBytes: 5_000_000 } as any,
        byteSizeLimit: 1_000_000,
      },
    })

    expect(result).toHaveProperty('regionTooLarge', true)
    expect(result).toHaveProperty('bytes', 5_000_000)
    expect(result).toHaveProperty('fetchSizeLimit', 1_000_000)
  })

  it('does not return regionTooLarge when bytes are within limit', async () => {
    const result = await executeVariantCellData({
      pluginManager: {} as any,
      args: {
        ...baseArgs,
        adapterConfig: { mockBytes: 500_000 } as any,
        byteSizeLimit: 1_000_000,
      },
    })

    expect(result).not.toHaveProperty('regionTooLarge')
  })

  it('skips byte check when byteSizeLimit is not provided', async () => {
    const result = await executeVariantCellData({
      pluginManager: {} as any,
      args: {
        ...baseArgs,
        adapterConfig: { mockBytes: 5_000_000 } as any,
      },
    })

    // Should proceed to fetch features (which returns empty), not regionTooLarge
    expect(result).not.toHaveProperty('regionTooLarge')
  })

  it('returns adapter fetchSizeLimit in regionTooLarge result', async () => {
    const result = await executeVariantCellData({
      pluginManager: {} as any,
      args: {
        ...baseArgs,
        adapterConfig: { mockBytes: 2_000_000 } as any,
        byteSizeLimit: 1_000_000,
      },
    })

    expect(result).toHaveProperty('regionTooLarge', true)
    // The mock adapter returns fetchSizeLimit: 1_000_000
    expect(result).toHaveProperty('fetchSizeLimit', 1_000_000)
  })
})
