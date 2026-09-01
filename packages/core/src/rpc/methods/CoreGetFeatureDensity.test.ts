import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import CoreGetFeatureDensity from './CoreGetFeatureDensity.ts'

import type PluginManager from '../../PluginManager.ts'

jest.mock('../../data_adapters/dataAdapterCache.ts', () => ({
  getAdapter: jest.fn(),
}))

const mockGetAdapter = jest.mocked(getAdapter)

const regions = [
  { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
]

function run(dataAdapter: unknown) {
  const method = new CoreGetFeatureDensity({} as PluginManager)
  mockGetAdapter.mockResolvedValue({ dataAdapter } as Awaited<
    ReturnType<typeof getAdapter>
  >)
  return method.invoke({
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
    regions,
    bpPerPx: 50,
  })
}

test('hands the view bp/px to the feature adapter and returns its bins', async () => {
  const bins = [
    {
      starts: new Uint32Array([0]),
      ends: new Uint32Array([1000]),
      scores: new Float32Array([3]),
    },
  ]
  const getFeatureDensity = jest.fn(async () => bins)
  await expect(
    run({ getFeatures: () => {}, getFeatureDensity }),
  ).resolves.toEqual(bins)
  expect(getFeatureDensity).toHaveBeenCalledWith(
    regions,
    expect.objectContaining({ bpPerPx: 50 }),
  )
})

test('an adapter serving no features has no density to give', async () => {
  await expect(
    run({ getRefNames: async () => ['ctgA'] }),
  ).resolves.toBeUndefined()
})
