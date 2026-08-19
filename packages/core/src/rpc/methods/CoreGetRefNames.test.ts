import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import CoreGetRefNames from './CoreGetRefNames.ts'

import type PluginManager from '../../PluginManager.ts'

jest.mock('../../data_adapters/dataAdapterCache.ts', () => ({
  getAdapter: jest.fn(),
}))

const mockGetAdapter = jest.mocked(getAdapter)

function run(dataAdapter: unknown, args?: Record<string, unknown>) {
  const method = new CoreGetRefNames({} as PluginManager)
  mockGetAdapter.mockResolvedValue({ dataAdapter } as Awaited<
    ReturnType<typeof getAdapter>
  >)
  return method.invoke({
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
    ...args,
  })
}

describe('CoreGetRefNames', () => {
  // The regression: refName lookup used to run through getFeatureAdapter, which
  // gates on `'getFeatures' in adapter`. An adapter serving something other than
  // features (PlinkLDTabixAdapter serves precomputed LD pairs) therefore
  // reported ZERO refNames, so the assembly's refName map came back empty, so
  // renaming silently did nothing, so every record was dropped by a later
  // exact-match refName test. A blank track, no error, on any assembly whose
  // contig naming differed from the file's.
  it('returns refNames from an adapter that serves no features', async () => {
    await expect(run({ getRefNames: async () => ['2L'] })).resolves.toEqual([
      '2L',
    ])
  })

  // toHaveBeenCalledWith, not toHaveBeenCalled: `run` used to pass no
  // sequenceAdapter, so the assertion was satisfied by a call carrying
  // undefined — which `setSequenceAdapterConfig` discards. It passed with the
  // arg replaced by a literal undefined, and only failed if the call was
  // deleted outright. What it means to wire the sequence adapter is that THIS
  // config arrives, and only the argument says so.
  it('returns refNames from a feature adapter, and wires its sequence adapter', async () => {
    const setSequenceAdapterConfig = jest.fn()
    const sequenceAdapter = { type: 'TestSequenceAdapter' }
    await expect(
      run(
        {
          getRefNames: async () => ['chr1'],
          getFeatures: () => {},
          setSequenceAdapterConfig,
        },
        { sequenceAdapter },
      ),
    ).resolves.toEqual(['chr1'])
    expect(setSequenceAdapterConfig).toHaveBeenCalledWith(sequenceAdapter)
  })

  it('returns nothing for an adapter that cannot name its contigs', async () => {
    await expect(run({ getSequence: () => {} })).resolves.toEqual([])
  })
})
