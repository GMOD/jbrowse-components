import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import createJexlInstance from '../../util/jexl.ts'
import SimpleFeature from '../../util/simpleFeature.ts'
import CoreEncodeFeatures from './CoreEncodeFeatures.ts'

import type PluginManager from '../../PluginManager.ts'
import type {
  CoreEncodeFeaturesArgs,
  EncodedFeaturesResult,
} from '../../util/markEncodingTypes.ts'
import type { RpcResult } from '../RpcServer.ts'

jest.mock('../../data_adapters/dataAdapterCache.ts', () => ({
  getAdapter: jest.fn(),
}))

const features = [10, 40, 25, 3].map(
  (score, i) =>
    new SimpleFeature({
      uniqueId: `f${i}`,
      refName: 'ctgA',
      start: i * 100,
      end: i * 100 + 50,
      score,
    }),
)

async function run(args: Partial<CoreEncodeFeaturesArgs>) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getFeatures: () => {},
      getFeaturesArray: async () => features,
      setSequenceAdapterConfig: () => {},
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const method = new CoreEncodeFeatures({
    jexl: createJexlInstance(),
  } as PluginManager)
  const result = await method.invoke({
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
    region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
    layers: [{ encoding: { y: 'score' }, lanes: ['y'] }],
    ...args,
  })
  return (result as RpcResult<EncodedFeaturesResult>).value.layers[0]!
}

test('a filter step keeps the features its expression admits, in order', async () => {
  const layer = await run({
    transform: [
      { type: 'filter', expr: "jexl:get(feature,'score') > 5" },
      { type: 'filter', expr: "jexl:get(feature,'score') < 30" },
    ],
  })
  expect(layer.count).toBe(2)
  expect([...layer.y!]).toEqual([10, 25])
})

test('filters is sugar for leading filter steps', async () => {
  const layer = await run({
    filters: ["jexl:get(feature,'score') > 5"],
    transform: [{ type: 'filter', expr: "jexl:get(feature,'score') < 30" }],
  })
  expect([...layer.y!]).toEqual([10, 25])
})

test('no transform encodes every feature', async () => {
  expect((await run({})).count).toBe(4)
})
