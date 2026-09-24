import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import MarkGetRowSources from './MarkGetRowSources.ts'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const args = {
  sessionId: 'test',
  adapterConfig: { type: 'MultiWiggleAdapter' },
}

test("a multi-BigWig's files come back with their labels and colours", async () => {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getMultiSourceFeatureArraysMulti: jest.fn(),
    getSources: () =>
      Promise.resolve([
        { name: 'k1', source: 'k1', color: '#f00', group: 'g' },
        { name: 'k2', source: 'k2', label: 'Knockdown 2', color: '' },
      ]),
  } as never)
  expect(
    await new MarkGetRowSources(new PluginManager()).execute(args),
  ).toEqual([
    { name: 'k1', color: '#f00' },
    { name: 'k2', label: 'Knockdown 2' },
  ])
})

test('an adapter that lists no sources is not asked to scan its features', async () => {
  const getSources = jest.fn()
  jest
    .mocked(getFeatureAdapterOrThrow)
    .mockResolvedValue({ getSources } as never)
  expect(
    await new MarkGetRowSources(new PluginManager()).execute(args),
  ).toEqual([])
  expect(getSources).not.toHaveBeenCalled()
})
