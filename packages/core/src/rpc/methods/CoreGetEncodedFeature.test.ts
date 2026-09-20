import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import createJexlInstance from '../../util/jexl.ts'
import SimpleFeature from '../../util/simpleFeature.ts'
import CoreEncodeFeatures from './CoreEncodeFeatures.ts'
import CoreGetEncodedFeature from './CoreGetEncodedFeature.ts'

import type PluginManager from '../../PluginManager.ts'
import type {
  CoreEncodeFeaturesArgs,
  EncodedFeaturesResult,
} from '../../util/markEncodingTypes.ts'
import type { RpcResult } from '../RpcServer.ts'

jest.mock('../../data_adapters/dataAdapterCache.ts', () => ({
  getAdapter: jest.fn(),
}))

const reads = (
  [
    ['r1', 0, 100, '1', 5],
    ['r2', 0, 100, '2', 7],
    ['r3', 40, 140, '2', 9],
  ] as const
).map(
  ([name, start, end, HP, score]) =>
    new SimpleFeature({
      uniqueId: name,
      refName: 'ctgA',
      start,
      end,
      HP,
      name,
      score,
    }),
)

const pluginManager = { jexl: createJexlInstance() } as PluginManager

function request(args: Partial<CoreEncodeFeaturesArgs>) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getFeatures: () => {},
      getFeaturesArray: async () => reads,
      getZoomRange: async () => undefined,
      setSequenceAdapterConfig: () => {},
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  return {
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
    region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
    layers: [],
    ...args,
  }
}

async function drawnAndReadBack(args: Partial<CoreEncodeFeaturesArgs>) {
  const req = request(args)
  const encoded = (await new CoreEncodeFeatures(pluginManager).invoke(
    req,
  )) as RpcResult<EncodedFeaturesResult>
  const layer = encoded.value.layers[0]!
  const details = new CoreGetEncodedFeature(pluginManager)
  return Promise.all(
    Array.from({ length: layer.count }, async (_, i) => ({
      x: layer.x[i]!,
      x2: layer.x2[i]!,
      y: layer.y?.[i],
      feature: await details.invoke({
        ...req,
        layer: 0,
        featureIndex: layer.featureIndex[i]!,
      }),
    })),
  )
}

test('two reads over one span each read back as themselves', async () => {
  const drawn = await drawnAndReadBack({
    layers: [
      {
        encoding: { row: 'row' },
        lanes: ['row', 'color'],
        transform: [{ type: 'pileup' }],
      },
    ],
  })
  expect(drawn.map(d => d.feature?.name)).toEqual(['r1', 'r2', 'r3'])
})

test('a run counted inside a facet section reads back with that section depth', async () => {
  const drawn = await drawnAndReadBack({
    facet: { field: 'HP' },
    layers: [
      {
        encoding: { y: 'coverage' },
        lanes: ['y', 'row'],
        transform: [{ type: 'coverage' }],
      },
    ],
  })
  expect(drawn).toHaveLength(4)
  for (const { x, x2, y, feature } of drawn) {
    expect(feature).toMatchObject({ start: x, end: x2, coverage: y })
  }
  expect(drawn.map(d => Object.keys(d.feature!).sort())).toEqual(
    drawn.map(() => ['coverage', 'end', 'refName', 'start', 'uniqueId']),
  )
})

test('a bin reads back as the bin the steps made', async () => {
  const drawn = await drawnAndReadBack({
    layers: [
      {
        encoding: { y: 'count' },
        lanes: ['y'],
        transform: [
          { type: 'bin', step: 40 },
          {
            type: 'aggregate',
            groupby: ['start', 'end'],
            ops: [{ op: 'count' }, { op: 'sum', field: 'score' }],
          },
        ],
      },
    ],
  })
  expect(drawn.map(d => d.feature)).toEqual([
    {
      uniqueId: 'ctgA:0-40#0',
      refName: 'ctgA',
      start: 0,
      end: 40,
      count: 2,
      sum_score: 12,
    },
    {
      uniqueId: 'ctgA:40-80#1',
      refName: 'ctgA',
      start: 40,
      end: 80,
      count: 1,
      sum_score: 9,
    },
  ])
})

test('only the layer asked about runs its steps, and answers as it did beside the others', async () => {
  const stacked = {
    encoding: { row: 'row' },
    lanes: ['row' as const],
    transform: [{ type: 'pileup' as const }],
  }
  const throwing = {
    encoding: { y: 'sum' },
    lanes: ['y' as const],
    transform: [{ type: 'aggregate' as const, ops: [{ op: 'sum' as const }] }],
  }
  const details = new CoreGetEncodedFeature(pluginManager)
  const names = await Promise.all(
    [0, 1, 2].map(async featureIndex => {
      const feature = await details.invoke({
        ...request({ facet: { field: 'HP' }, layers: [stacked, throwing] }),
        layer: 0,
        featureIndex,
      })
      return feature?.name
    }),
  )
  expect(names).toEqual(['r1', 'r2', 'r3'])
})

test('an index past the layer answers nothing', async () => {
  const details = new CoreGetEncodedFeature(pluginManager)
  expect(
    await details.invoke({
      ...request({ layers: [{ encoding: {}, lanes: [] }] }),
      layer: 0,
      featureIndex: 99,
    }),
  ).toBeUndefined()
})
