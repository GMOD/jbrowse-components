import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import CoreGetContigs from './CoreGetContigs.ts'

import type PluginManager from '../../PluginManager.ts'

jest.mock('../../data_adapters/dataAdapterCache.ts', () => ({
  getAdapter: jest.fn(),
}))

const mockGetAdapter = jest.mocked(getAdapter)

function run(dataAdapter: unknown) {
  mockGetAdapter.mockResolvedValue({ dataAdapter } as Awaited<
    ReturnType<typeof getAdapter>
  >)
  return new CoreGetContigs({} as PluginManager).invoke({
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
  })
}

// every fetch waits on this call, so it asks for no index walk
test('returns the contigs a file states, asking for lengths only', async () => {
  const contigs = [{ refName: 'chr1', length: 248_956_422 }]
  const getContigs = jest.fn(async () => contigs)
  await expect(
    run({ getContigs, getRefNames: async () => ['x'] }),
  ).resolves.toEqual(contigs)
  expect(getContigs).toHaveBeenCalledWith(
    expect.objectContaining({ contigLengthsOnly: true }),
  )
})

// the rename pass reads its names from here, so an adapter stating no lengths
// still has to name its contigs
test('falls back to the refNames of an adapter stating no lengths', async () => {
  await expect(
    run({ getRefNames: async () => ['ctgA', 'ctgB'] }),
  ).resolves.toEqual([{ refName: 'ctgA' }, { refName: 'ctgB' }])
})

test('returns nothing for an adapter that cannot name its contigs', async () => {
  await expect(run({ getSequence: () => {} })).resolves.toEqual([])
})
