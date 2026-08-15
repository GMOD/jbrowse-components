import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import GetScoreData from './GetScoreData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { StatusCallback } from '@jbrowse/core/util'

// The RPC guide tells plugin authors to pass `statusCallback` and `stopToken`
// down to whatever does the slow work rather than consuming them in the method,
// because the adapter is what knows when it is downloading and what can stop
// mid-fetch. Both are optional args, so dropping either compiles and looks
// right: the fetch simply reports nothing and ignores a cancel. Assert they
// reach the adapter.
jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')
const getFeaturesArray = jest.fn()
jest
  .mocked(getFeatureAdapterOrThrow)
  .mockResolvedValue({ getFeaturesArray } as never)

const region = { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' }

function args(statusCallback?: StatusCallback) {
  return {
    sessionId: 'test',
    adapterConfig: {},
    region,
    scoreColumn: 'score',
    stopToken: 'token-1',
    statusCallback,
  }
}

beforeEach(() => {
  getFeaturesArray.mockReset()
  getFeaturesArray.mockResolvedValue([
    new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 0,
      end: 10,
      score: 5,
    }),
  ])
})

test('the status callback and stop token reach the adapter', async () => {
  const statusCallback = jest.fn()
  const rpc = new GetScoreData({} as unknown as PluginManager)
  await rpc.invoke(args(statusCallback))

  const opts = getFeaturesArray.mock.calls[0]![1] as BaseOptions
  expect(opts.statusCallback).toBe(statusCallback)
  expect(opts.stopToken).toBe('token-1')
  // and the method's own message goes out before the adapter is asked, so the
  // UI is not blank for the length of the fetch
  expect(statusCallback).toHaveBeenCalledWith('Fetching features')
})

// A one-off call from a dialog has no loading UI to report into, so the arg is
// genuinely absent rather than a no-op function — the optional call has to
// survive that.
test('no status callback is not an error', async () => {
  const rpc = new GetScoreData({} as unknown as PluginManager)
  const result = await rpc.invoke(args())
  expect(result.numFeatures).toBe(1)
})
