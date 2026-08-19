import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { executeMultiRowGetFeatures } from './executeMultiRowGetFeatures.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

// `rpcResultWithArrayBuffers` derives the transfer list by walking the payload,
// so it cannot disagree with itself — but its walk stops one level down, and
// nothing here had ever run the deeper walk `checkTransferList` does over what
// this executor actually returns. That check runs under NODE_ENV=test for any
// method a test drives, and this method had no test.
const features = [
  new SimpleFeature({
    uniqueId: '1',
    refName: 'ctgA',
    start: 0,
    end: 50,
    sample: 'mom',
  }),
  new SimpleFeature({
    uniqueId: '2',
    refName: 'ctgA',
    start: 10,
    end: 30,
    sample: 'offspring01',
  }),
]

function run(byteLimit?: number) {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesArray: () => Promise.resolve(features),
    getRegionByteSize: () => Promise.resolve(1024),
  } as never)

  return executeMultiRowGetFeatures({
    pluginManager: { jexl: createJexlInstance() } as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      region: { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
      byteLimit,
      partitionField: 'sample',
      lengthField: '',
      colorConfig: 'goldenrod',
    } as RpcExecuteArgs<'MultiRowGetFeatures'>,
  })
}

// the executor returns the byte gate's plain object OR an rpcResult, so the two
// payload tests narrow rather than casting — a run that took the gate would
// otherwise assert nothing and pass
async function runPayload(byteLimit?: number) {
  const result = await run(byteLimit)
  if (!('__rpcResult' in result)) {
    throw new Error('expected a payload, got the byte gate')
  }
  return result
}

test('every buffer in the packed payload is in the transfer list', async () => {
  const { value, transferables } = await runPayload()
  expect(value.partitionValues).toEqual(['mom', 'offspring01'])
  expect(transferables).toContain(value.featureStarts.buffer)
  expect(transferables).toContain(value.featurePartitionIndex.buffer)
})

// the byte gate reports through the same wrapper, and `bytes` beside the arrays
// is the field a level-limited walk would trip over
test('the byte measurement rides along without upsetting the list', async () => {
  const { value, transferables } = await runPayload(1_000_000)
  expect(value.bytes).toBe(1024)
  expect(new Set(transferables).size).toBe(transferables.length)
})

// over budget the executor returns the gate's plain object rather than an
// rpcResult, so there is no list to check — and nothing that looks like one
test('an over-budget region returns the gate result, not a payload', async () => {
  const result = await run(1)
  expect(result).toEqual({ regionTooLarge: true, bytes: 1024 })
})
