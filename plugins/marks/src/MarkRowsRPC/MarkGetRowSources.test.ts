import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import MarkGetRowSources from './MarkGetRowSources.ts'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const args = {
  sessionId: 'test',
  adapterConfig: { type: 'MultiWiggleAdapter' },
}

test("a multi-BigWig's listing comes back as the adapter answers it", async () => {
  const listing = {
    field: 'source',
    sources: [
      { name: 'k1', color: '#f00' },
      { name: 'k2', label: 'Knockdown 2' },
    ],
  }
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    listRowSources: () => Promise.resolve(listing),
  } as never)
  expect(
    await new MarkGetRowSources(new PluginManager()).execute(args),
  ).toEqual(listing)
})

test('an adapter that lists no rows answers undefined and is asked nothing', async () => {
  const getSources = jest.fn()
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getMultiSourceFeatureArraysMulti: jest.fn(),
    getSources,
  } as never)
  expect(
    await new MarkGetRowSources(new PluginManager()).execute(args),
  ).toBeUndefined()
  expect(getSources).not.toHaveBeenCalled()
})
