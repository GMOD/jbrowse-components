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
      getZoomRange: async () => undefined,
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

test('the zoom reaches the adapter, so one with zoom levels answers at it', async () => {
  const getFeaturesArray = jest.fn(
    async (_region: unknown, _opts: { bpPerPx?: number }) => features,
  )
  const zoomRange = { minBpPerPx: 250, maxBpPerPx: 1000 }
  const getZoomRange = jest.fn(async (_opts: { bpPerPx?: number }) => zoomRange)
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getFeatures: () => {},
      getFeaturesArray,
      getZoomRange,
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
    bpPerPx: 500,
  })
  expect(getFeaturesArray.mock.calls[0]![1]).toMatchObject({ bpPerPx: 500 })
  expect(getZoomRange.mock.calls[0]![0]).toMatchObject({ bpPerPx: 500 })
  expect((result as RpcResult<EncodedFeaturesResult>).value.zoomRange).toEqual(
    zoomRange,
  )
})

test('a facet runs every layer per section and stacks the sections', async () => {
  const reads = (
    [
      ['a', 0, 100, 'k2'],
      ['b', 10, 90, 'k2'],
      ['c', 20, 80, 'k1'],
    ] as const
  ).map(
    ([uniqueId, start, end, source]) =>
      new SimpleFeature({ uniqueId, refName: 'ctgA', start, end, source }),
  )
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getFeatures: () => {},
      getFeaturesArray: async () => reads,
      getZoomRange: async () => undefined,
      setSequenceAdapterConfig: () => {},
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const method = new CoreEncodeFeatures({
    jexl: createJexlInstance(),
  } as PluginManager)
  const result = await method.invoke({
    sessionId: 'test',
    adapterConfig: { type: 'AnyAdapter' },
    region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
    facet: { field: 'source' },
    layers: [
      {
        encoding: { row: 'row' },
        lanes: ['row'],
        transform: [{ type: 'stack' }],
      },
      {
        encoding: { y: 'coverage' },
        lanes: ['y', 'row'],
        transform: [{ type: 'coverage' }],
      },
    ],
  })
  const { layers, facet } = (result as RpcResult<EncodedFeaturesResult>).value
  expect(facet).toEqual([
    { key: 'k1', firstRow: 0, rowCount: 1 },
    { key: 'k2', firstRow: 1, rowCount: 2 },
  ])
  expect([...layers[0]!.row!]).toEqual([0, 1, 2])
  expect([...layers[1]!.row!]).toEqual([0, 1, 1, 1])
  expect([...layers[1]!.y!]).toEqual([1, 1, 2, 1])
})

test("a layer's own transform runs after the shared one, and the other layer sees neither", async () => {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getFeatures: () => {},
      getFeaturesArray: async () => features,
      getZoomRange: async () => undefined,
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
    transform: [{ type: 'filter', expr: "jexl:get(feature,'score') > 5" }],
    layers: [
      {
        encoding: { y: 'count' },
        lanes: ['y'],
        transform: [
          { type: 'bin', step: 200 },
          {
            type: 'aggregate',
            groupby: ['start', 'end'],
            ops: [{ op: 'count' }],
          },
        ],
      },
      { encoding: { y: 'score' }, lanes: ['y'] },
    ],
  })
  const { layers } = (result as RpcResult<EncodedFeaturesResult>).value
  expect([...layers[0]!.x]).toEqual([0, 200])
  expect([...layers[0]!.x2]).toEqual([200, 400])
  expect([...layers[0]!.y!]).toEqual([2, 1])
  expect([...layers[1]!.y!]).toEqual([10, 40, 25])
})
