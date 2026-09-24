import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import createJexlInstance from '../../util/jexl.ts'
import SimpleFeature from '../../util/simpleFeature.ts'
import CoreEncodeFeatures from './CoreEncodeFeatures.ts'

import type PluginManager from '../../PluginManager.ts'
import type {
  CoreEncodeFeaturesArgs,
  EncodedFeaturesResult,
  FacetSpec,
  LayerRequest,
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

test("the request's adapter options reach the adapter, under the zoom and signal", async () => {
  const getFeaturesArray = jest.fn(
    async (_region: unknown, _opts: object) => features,
  )
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getFeatures: () => {},
      getFeaturesArray,
      getZoomRange: async () => undefined,
      setSequenceAdapterConfig: () => {},
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  await new CoreEncodeFeatures({
    jexl: createJexlInstance(),
  } as PluginManager).invoke({
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
    region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
    layers: [{ encoding: { y: 'score' }, lanes: ['y'] }],
    bpPerPx: 500,
    opts: { ld: { refName: 'chr1' }, bpPerPx: 1 },
  })
  expect(getFeaturesArray.mock.calls[0]![1]).toMatchObject({
    ld: { refName: 'chr1' },
    bpPerPx: 500,
  })
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
        transform: [{ type: 'pileup' }],
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

// The reads carry a `row` field of their own, to pin that a layer nothing
// packs reads none rather than that field by its default name.
describe('a pileup is the row a layer stands in where its encoding names none', () => {
  const reads = (['a', 'b', 'c'] as const).map(
    (uniqueId, i) =>
      new SimpleFeature({
        uniqueId,
        refName: 'ctgA',
        start: i * 10,
        end: 100,
        source: 'k',
        row: 2,
      }),
  )
  async function rowsOf(
    layers: LayerRequest[],
    facet?: FacetSpec,
    transform?: CoreEncodeFeaturesArgs['transform'],
  ) {
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
      sessionId: 's',
      adapterConfig: { type: 'AnyAdapter' },
      region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
      layers,
      facet,
      transform,
    })
    const { value } = result as RpcResult<EncodedFeaturesResult>
    return value.layers.map(l => [...l.row!])
  }
  const packed = (row?: string): LayerRequest => ({
    encoding: row === undefined ? {} : { row },
    lanes: ['row'],
    transform: [{ type: 'pileup', as: 'lane' }],
  })
  const unpacked: LayerRequest = { encoding: {}, lanes: ['row'] }
  const SHARED: CoreEncodeFeaturesArgs['transform'] = [
    { type: 'pileup', as: 'lane' },
  ]

  test("the layer's own, without a facet", async () => {
    expect(await rowsOf([packed(), packed('score'), unpacked])).toEqual([
      [0, 1, 2],
      [0, 0, 0],
      [0, 0, 0],
    ])
  })

  test("the layer's own, under a facet", async () => {
    expect(await rowsOf([packed(), unpacked], { field: 'source' })).toEqual([
      [0, 1, 2],
      [0, 0, 0],
    ])
  })

  test("the display's, without a facet", async () => {
    expect(await rowsOf([unpacked], undefined, SHARED)).toEqual([[0, 1, 2]])
  })

  test("the display's, under a facet", async () => {
    expect(await rowsOf([unpacked], { field: 'source' }, SHARED)).toEqual([
      [0, 1, 2],
    ])
  })

  test("the facet's, per section", async () => {
    expect(
      await rowsOf([unpacked], { field: 'source', transform: SHARED }),
    ).toEqual([[0, 1, 2]])
  })

  test('none, where a layer of its own steps makes its features from nothing', async () => {
    const depth: LayerRequest = {
      encoding: {},
      lanes: ['row'],
      transform: [{ type: 'coverage' }],
    }
    expect(await rowsOf([depth], undefined, SHARED)).toEqual([[0, 0, 0]])
    expect(
      await rowsOf([depth], { field: 'source', transform: SHARED }),
    ).toEqual([[0, 0, 0]])
  })
})

// Three reads that all overlap, two of one source and one of another. The
// display's pileup runs before the split and packs all three, so each section
// keeps the row numbers the other's reads took; the facet's packs each
// section on its own.
describe("a facet's own pileup packs per section, the display's across every section", () => {
  const reads = (
    [
      ['a', 'k1', 0],
      ['b', 'k2', 10],
      ['c', 'k1', 20],
    ] as const
  ).map(
    ([uniqueId, source, start]) =>
      new SimpleFeature({
        uniqueId,
        refName: 'ctgA',
        start,
        end: 100,
        source,
      }),
  )
  async function stacked(args: Partial<CoreEncodeFeaturesArgs>) {
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
      sessionId: 's',
      adapterConfig: { type: 'AnyAdapter' },
      region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
      layers: [{ encoding: {}, lanes: ['row'] }],
      ...args,
    })
    const { value } = result as RpcResult<EncodedFeaturesResult>
    return { rows: [...value.layers[0]!.row!], sections: value.facet }
  }

  test("the facet's", async () => {
    expect(
      await stacked({
        facet: { field: 'source', transform: [{ type: 'pileup' }] },
      }),
    ).toEqual({
      rows: [0, 1, 2],
      sections: [
        { key: 'k1', firstRow: 0, rowCount: 2 },
        { key: 'k2', firstRow: 2, rowCount: 1 },
      ],
    })
  })

  test("the display's", async () => {
    expect(
      await stacked({
        transform: [{ type: 'pileup' }],
        facet: { field: 'source' },
      }),
    ).toEqual({
      rows: [0, 2, 4],
      sections: [
        { key: 'k1', firstRow: 0, rowCount: 3 },
        { key: 'k2', firstRow: 3, rowCount: 2 },
      ],
    })
  })
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
