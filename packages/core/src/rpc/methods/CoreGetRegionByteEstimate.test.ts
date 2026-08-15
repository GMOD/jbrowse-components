import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import CoreGetRegionByteEstimate from './CoreGetRegionByteEstimate.ts'

import type PluginManager from '../../PluginManager.ts'

jest.mock('../../data_adapters/dataAdapterCache.ts', () => ({
  getAdapter: jest.fn(),
}))

const mockGetAdapter = jest.mocked(getAdapter)

function run(dataAdapter: unknown) {
  const method = new CoreGetRegionByteEstimate({} as PluginManager)
  mockGetAdapter.mockResolvedValue({ dataAdapter } as Awaited<
    ReturnType<typeof getAdapter>
  >)
  return method.invoke({
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
    regions: [{ refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }],
  })
}

describe('CoreGetRegionByteEstimate', () => {
  it('returns the adapter estimate for an indexed feature adapter', async () => {
    await expect(
      run({ getFeatures: () => {}, getRegionByteSize: async () => 4096 }),
    ).resolves.toBe(4096)
  })

  // An adapter that caps what it returns at screen resolution (BigWig, HiC,
  // sequence) implements no estimate. `undefined` is not a failure — it is the
  // gate's "no byte axis", and `estimatedFetchBytes` being undefined is what
  // keeps such a track from ever bannering.
  it('returns undefined for a feature adapter with no index estimate', async () => {
    await expect(
      run({ getFeatures: () => {}, getRegionByteSize: async () => undefined }),
    ).resolves.toBeUndefined()
  })

  // The regression: this used to throw "Adapter does not support retrieving
  // features" for an adapter serving something other than features
  // (PlinkLD*/Ldmat serve precomputed LD pairs). That made "can this be
  // measured" a question the *display* had to answer before asking, and the
  // only tool it had was turning `measuresBytesPreFlight` off — abandoning the whole
  // gate for one adapter family. Answering `undefined` puts the capability
  // question where the capability lives, and lands it on the same "no byte
  // axis" path an estimate-less feature adapter already takes.
  it('returns undefined for an adapter that serves no features at all', async () => {
    await expect(
      run({ getRefNames: async () => ['ctgA'] }),
    ).resolves.toBeUndefined()
  })
})
