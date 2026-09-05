import { loadMafSamplesAdapter } from './loadMafSamplesAdapter.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const mockGetAdapter = jest.fn()
jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args) as unknown,
}))

// A MafTrack whose `adapter` names something that is not a MAF adapter — a
// hand-written config, or one whose `type` was renamed. The structural cast
// this replaced let the wrong adapter straight through, and the first thing the
// RPC did with it was call a method it does not have.
test('a non-MAF adapter is named, not called', async () => {
  mockGetAdapter.mockResolvedValue({ dataAdapter: { getFeatures: () => {} } })
  await expect(
    loadMafSamplesAdapter({} as PluginManager, 'session-1', {
      type: 'BigBedAdapter',
    }),
  ).rejects.toThrow(/BigBedAdapter is not a MAF adapter/)
})
